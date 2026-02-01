import sys
import json
import struct
import os
import subprocess

def get_message():
    try:
        with open("c:/temp/host_debug_new.txt", "a", encoding='utf-8') as f:
            f.write("get_message: Waiting for stdin...\n")
            
        raw = sys.stdin.buffer.read(4)
        if not raw:
            with open("c:/temp/host_debug_new.txt", "a") as f:
                f.write("get_message: EOF reading length\n")
            sys.exit(0)
        msg_len = struct.unpack('@I', raw)[0]
        with open("c:/temp/host_debug_new.txt", "a") as f:
            f.write(f"get_message: Length={msg_len}\n")
            
        msg = sys.stdin.buffer.read(msg_len).decode('utf-8')
        with open("c:/temp/host_debug_new.txt", "a") as f:
            f.write(f"get_message: Payload read. Size={len(msg)}\n")
        return json.loads(msg)
    except Exception as e:
        with open("c:/temp/host_debug_new.txt", "a") as f:
            f.write(f"get_message ERROR: {e}\n")
        raise e

def send_message(content):
    res = json.dumps(content).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('@I', len(res)) + res)
    sys.stdout.buffer.flush()

if __name__ == "__main__":
    try:
        with open("c:/temp/host_debug_new.txt", "a") as f:
            f.write(f"HOST LAUNCHED PID:{os.getpid()}\n")
            
        data = get_message()
        with open("c:/temp/host_debug_new.txt", "a") as f:
            f.write(f"Message received: {json.dumps(data)}\n")

        # Create sessions directory if it doesn't exist
        sessions_dir = os.path.join(os.path.dirname(__file__), "..", "sessions")
        if not os.path.exists(sessions_dir):
            os.makedirs(sessions_dir)
            
        session_file = os.path.join(sessions_dir, f"session-{os.getpid()}.json")
        if 'logs' in data:
            with open(session_file, "w", encoding='utf-8') as f:
                json.dump(data['logs'], f, indent=2)
            
        # Trigger analysis
        analyst_script = os.path.join(os.path.dirname(__file__), "..", "workflow_analyst.py")
        
        cmd = [sys.executable, analyst_script]

        # Handle "test" action
        is_test = data.get('action') == 'test'
        if is_test:
            cmd.append("--test")
        
        # Add config args if present
        if 'config' in data:
            cfg = data['config']
            if 'url' in cfg and cfg['url']:
                cmd.extend(["--url", cfg['url']])
            if 'model' in cfg and cfg['model']:
                cmd.extend(["--model", cfg['model']])
            if 'prompt' in cfg and cfg['prompt']:
                cmd.extend(["--prompt", cfg['prompt']])
            if 'apiKey' in cfg and cfg['apiKey']:
                cmd.extend(["--api_key", cfg['apiKey']])
            if 'temperature' in cfg:
                cmd.extend(["--temperature", str(cfg['temperature'])])
            if 'startTime' in cfg and cfg['startTime']:
                cmd.extend(["--start_time", cfg['startTime']])
            if 'endTime' in cfg and cfg['endTime']:
                cmd.extend(["--end_time", cfg['endTime']])

        with open("c:/temp/host_debug_new.txt", "a") as f:
            f.write(f"Running cmd: {cmd}\n")

        # Sync run with capturing
        try:
            result = subprocess.run(cmd, cwd=os.path.dirname(analyst_script), capture_output=True, text=True, encoding='utf-8', timeout=300)
            
            with open("c:/temp/host_debug_new.txt", "a") as f:
                f.write(f"Analyst finished. RC={result.returncode}\nStdout: {result.stdout[:100]}...\nStderr: {result.stderr}\n")

            if result.returncode == 0:
                send_message({"status": "Success", "analysis": result.stdout})
            else:
                send_message({"status": "Error", "error": result.stderr})
        except subprocess.TimeoutExpired:
             with open("c:/temp/host_debug_new.txt", "a") as f:
                f.write(f"Analyst TIMEOUT\n")
             send_message({"status": "Error", "error": "Analysis timed out (Backend Unresponsive)."})
    except Exception as e:
        with open("c:/temp/host_debug_new.txt", "a") as f:
            f.write(f"CRITICAL ERROR: {e}\n")
        send_message({"status": "Error", "error": str(e)})
