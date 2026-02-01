import urllib.request
import sys
import time

def check_llm_server():
    # llama.cpp server usually provides a health endpoint, or we can check root
    url = "http://localhost:8081/health"
    
    print(f"Checking LLM Server connectivity at {url}...")
    
    # Simple retry logic
    max_retries = 3
    for i in range(max_retries):
        try:
            with urllib.request.urlopen(url, timeout=2) as response:
                if response.status == 200:
                    print(f"✅ LLM Server is ONLINE (Port 8081)")
                    print(f"   Response: {response.read().decode('utf-8')}")
                    return True
        except urllib.error.HTTPError as e:
            # 404/500 means server is reachable but didn't like the path
            print(f"✅ LLM Server is ONLINE (Port 8081) - Status {e.code}")
            return True
        except Exception as e:
            print(f"   Attempt {i+1}/{max_retries}: Connection failed...")
            time.sleep(1)

    print("\n❌ LLM Server Unreachable at localhost:8081")
    print("   Please ensure 'llama-server.exe' is running.")
    print("   If you are running it manually, ensure you used '--port 8081'.")
    sys.exit(1)

if __name__ == "__main__":
    check_llm_server()
