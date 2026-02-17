import requests
import json
import time

URL = "http://localhost:8081/v1/chat/completions"
MODEL = "Mistral-Nemo-Instruct-2407-Q5_K_M.gguf"

payload = {
    "model": MODEL,
    "messages": [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Say hello."}
    ],
    "temperature": 0.7,
    "stream": False
}

print(f"Sending non-streaming request to {URL}...")
start = time.time()
try:
    resp = requests.post(URL, json=payload, timeout=60)
    print(f"Status Code: {resp.status_code}")
    print(f"Time Taken: {time.time() - start:.2f}s")
    
    try:
        data = resp.json()
        print("\nResponse JSON:")
        print(json.dumps(data, indent=2))
        
        # Verify access path
        content = data['choices'][0]['message']['content']
        print(f"\nExtracted Content: {content}")
        
    except Exception as e:
        print(f"Error parsing JSON: {e}")
        print(f"Raw Text: {resp.text}")

except Exception as e:
    print(f"Request failed: {e}")
