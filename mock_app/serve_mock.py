from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import requests
import json

app = Flask(__name__, static_folder='static', static_url_path='')
CORS(app)

PORT = 5500
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'mock_app.html')

@app.route('/assets/<path:path>')
def send_assets(path):
    return send_from_directory(os.path.join(app.static_folder, 'assets'), path)


def gemini_call(prompt, api_key, model, temp, system_prompt, stream=False):
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:{'streamGenerateContent' if stream else 'generateContent'}?key={api_key}"
        payload = {
            "contents": [{"parts": [{"text": f"{system_prompt}\n\n{prompt}"}]}],
            "generationConfig": {"temperature": temp}
        }
        resp = requests.post(url, json=payload, timeout=60, stream=stream)
        if resp.status_code == 200:
            if stream: return resp
            return resp.json()['candidates'][0]['content']['parts'][0]['text']
        raise Exception(f"Gemini {resp.status_code}: {resp.text}")
    except requests.exceptions.RequestException as e:
        raise Exception(f"Gemini Network Error: {str(e)}")

def openai_call(prompt, api_key, model, temp, system_prompt, base_url, stream=False):
    try:
        url = f"{base_url if base_url else 'https://api.openai.com/v1'}/chat/completions"
        headers = {"Authorization": f"Bearer {api_key}"}
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            "temperature": temp,
            "stream": stream
        }
        resp = requests.post(url, headers=headers, json=payload, timeout=60, stream=stream)
        if resp.status_code == 200:
            if stream: return resp
            return resp.json()['choices'][0]['message']['content']
        raise Exception(f"OpenAI/Local {resp.status_code}: {resp.text}")
    except requests.exceptions.ConnectionError:
        raise Exception(f"Connection Refused. Is your local LLM server running at {base_url}?")
    except requests.exceptions.Timeout:
        raise Exception("Request timed out. Try a faster model or check your server load.")
    except requests.exceptions.RequestException as e:
        raise Exception(f"Local LLM Error: {str(e)}")

@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.json
    logs = data.get('logs', [])
    query = data.get('query', '')
    config = data.get('config', {})
    stream = data.get('stream', False)
    
    # Session Persistence Logic
    if logs:
        try:
            # Locate analyst/sessions relative to this script
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            sessions_dir = os.path.join(base_dir, "analyst", "sessions")
            
            if not os.path.exists(sessions_dir):
                os.makedirs(sessions_dir)
            
            # Use timestamp and random suffix to avoid collisions if multiple requests arrive at the same second
            import time, random
            ts = int(time.time() * 1000)
            rand = random.randint(1000, 9999)
            session_file = os.path.join(sessions_dir, f"session-{ts}-{rand}.json")
            
            with open(session_file, "w", encoding='utf-8') as f:
                json.dump(logs, f, indent=2)
            print(f"✅ Session saved: {os.path.basename(session_file)}")
        except Exception as e:
            print(f"❌ Failed to save session: {e}")
    
    provider = config.get('provider', 'gemini')
    api_key = config.get('key', '')
    model_name = config.get('model', 'gemini-1.5-flash')
    temp = config.get('temp', 0.7)
    system_prompt = config.get('prompt', 'You are an expert financial AI assistant.')
    base_url = config.get('url', '')
    
    log_context = ""
    for entry in logs:
        log_context += f"[{entry.get('origin')}] {entry.get('type')}: {json.dumps(entry.get('data'))}\n"
    
    prompt = f"Captured FDC3 Contexts:\n{log_context}\n\nUser Question: {query}"
    
    try:
        if not api_key and provider != 'local':
            return jsonify({"analysis": "⚠️ **API Key Missing**. Please go to Settings (⚙️)."})

        if stream:
            def generate():
                try:
                    target_resp = None
                    if provider == 'gemini':
                        target_resp = gemini_call(prompt, api_key, model_name, temp, system_prompt, stream=True)
                        for line in target_resp.iter_lines():
                            if line:
                                try:
                                    chunk = json.loads(line.decode('utf-8'))
                                    text = chunk.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '')
                                    if text:
                                        print(f"Streaming [Gemini]: {text[:20]}...")
                                        yield f"data: {json.dumps({'text': text})}\n\n"
                                except Exception as e:
                                    print(f"Error parsing Gemini chunk: {e}")
                    else:
                        target_resp = openai_call(prompt, api_key, model_name, temp, system_prompt, base_url, stream=True)
                        for line in target_resp.iter_lines():
                            if line:
                                line_str = line.decode('utf-8').strip()
                                if line_str.startswith("data: "):
                                    content = line_str[6:]
                                    if content == "[DONE]": break
                                    try:
                                        chunk = json.loads(content)
                                        choices = chunk.get('choices', [])
                                        if choices:
                                            delta = choices[0].get('delta', {})
                                            text = delta.get('content', '')
                                            if text:
                                                print(f"Streaming [OpenAI/Local]: {text[:20]}...")
                                                yield f"data: {json.dumps({'text': text})}\n\n"
                                    except Exception as e:
                                        print(f"Error parsing OpenAI chunk: {e} | Line: {line_str}")
                except Exception as inner_e:
                    print(f"Streaming Exception: {inner_e}")
                    yield f"data: {json.dumps({'error': str(inner_e)})}\n\n"
            
            return app.response_class(generate(), mimetype='text/event-stream')
        else:
            if provider == 'gemini':
                result = gemini_call(prompt, api_key, model_name, temp, system_prompt)
            else:
                result = openai_call(prompt, api_key, model_name, temp, system_prompt, base_url)
            return jsonify({"analysis": result})

    except Exception as e:
        print(f"Analysis Error: {e}")
        return jsonify({"analysis": f"❌ **Error**: {str(e)}"}), 500

@app.route('/models', methods=['POST'])
def fetch_models():
    data = request.json
    config = data.get('config', {})
    provider = config.get('provider', 'gemini')
    api_key = config.get('key', '')
    base_url = config.get('url', '')

    try:
        if provider == 'openai' or provider == 'local':
            url = f"{base_url if base_url else 'https://api.openai.com/v1'}/models"
            headers = {"Authorization": f"Bearer {api_key}"}
            # Increased timeout for discovery as well
            resp = requests.get(url, headers=headers, timeout=30)
            if resp.status_code == 200:
                models = [m['id'] for m in resp.json().get('data', [])]
                return jsonify({"models": models})
            return jsonify({"error": f"Error: {resp.status_code} - {resp.text}"}), resp.status_code
        
        elif provider == 'gemini':
            url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
            resp = requests.get(url, timeout=30)
            if resp.status_code == 200:
                models = [m['name'].replace('models/', '') for m in resp.json().get('models', []) 
                         if 'generateContent' in m.get('supportedGenerationMethods', [])]
                return jsonify({"models": models})
            return jsonify({"error": f"Error: {resp.status_code} - {resp.text}"}), resp.status_code
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/test', methods=['POST'])
def test_connection():
    data = request.json
    config = data.get('config', {})
    provider = config.get('provider', 'gemini')
    api_key = config.get('key', '')
    model_name = config.get('model', 'gemini-1.5-flash')
    base_url = config.get('url', '')
    
    if not api_key and provider != 'local':
        return jsonify({"success": False, "message": "API Key is missing."})
    
    try:
        # Use simple timeout for ping
        if provider == 'gemini':
            gemini_call("ping", api_key, model_name, 0.1, "Respond only with 'pong'")
        else:
            openai_call("ping", api_key, model_name, 0.1, "Respond only with 'pong'", base_url)
        return jsonify({"success": True, "message": f"Successfully connected to {provider.upper()}!"})
    except Exception as e:
        return jsonify({"success": False, "message": f"Connection failed: {str(e)}"})

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory(DIRECTORY, path)

if __name__ == '__main__':
    print(f"Mock FDC3 App (Flask) running at http://0.0.0.0:{PORT}")
    app.run(host='0.0.0.0', port=PORT, debug=False)
