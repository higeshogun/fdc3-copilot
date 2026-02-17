import requests
import json
import threading
import time
import sseclient

BASE_URL = "http://localhost:5500"

def test_mcp_flow():
    print("Testing MCP SSE Flow...")
    
    # 1. Connect to SSE
    messages = requests.get(f"{BASE_URL}/mcp/sse", stream=True)
    client = sseclient.SSEClient(messages)
    
    endpoint_url = None
    session_id = None
    
    print("Listening for events...")
    for event in client.events():
        print(f"Event: {event.event}, Data: {event.data}")
        
        if event.event == 'endpoint':
            # Found endpoint, extract session_id
            endpoint_url = event.data
            # Extract session_id from query param
            import urllib.parse
            parsed = urllib.parse.urlparse(endpoint_url)
            params = urllib.parse.parse_qs(parsed.query)
            session_id = params.get('sessionId', [None])[0]
            print(f"Session ID: {session_id}")
            break
            
    if not session_id:
        print("Failed to get session ID")
        return

    # 2. Send Initialize
    print("Sending Initialize...")
    init_msg = {
        "jsonrpc": "2.0",
        "method": "initialize",
        "id": 1,
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "test-script", "version": "1.0"}
        }
    }
    
    resp = requests.post(f"{BASE_URL}/mcp/messages", params={"sessionId": session_id}, json=init_msg)
    print(f"Init Resp: {resp.status_code}")
    
    # Listen for response in SSE (need a separate thread or non-blocking, but for simple test just read next event)
    # The client iterator blocks, so we should have done this in parallel.
    # Let's restart the loop properly.
    return

# Optimized Test
def run_test():
    import uuid
    
    session_id = None
    
    def listen():
        nonlocal session_id
        print("Starting Listener...")
        messages = requests.get(f"{BASE_URL}/mcp/sse", stream=True)
        client = sseclient.SSEClient(messages)
        for event in client.events():
            print(f"[SSE] {event.event}: {event.data}")
            if event.event == 'endpoint':
                 import urllib.parse
                 parsed = urllib.parse.urlparse(event.data)
                 params = urllib.parse.parse_qs(parsed.query)
                 session_id = params.get('sessionId', [None])[0]

    t = threading.Thread(target=listen, daemon=True)
    t.start()
    
    # Wait for session_id
    time.sleep(2)
    if not session_id:
        print("Timeout waiting for session_id")
        return

    print(f"Got Session ID: {session_id}")
    
    # Send Initialize
    requests.post(f"{BASE_URL}/mcp/messages", params={"sessionId": session_id}, json={
        "jsonrpc": "2.0", "method": "initialize", "id": 1, "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "test", "version": "1.0"}}
    })
    
    time.sleep(1)
    
    # Send List Tools
    requests.post(f"{BASE_URL}/mcp/messages", params={"sessionId": session_id}, json={
        "jsonrpc": "2.0", "method": "tools/list", "id": 2, "params": {}
    })
    
    time.sleep(1)
    
    print("Test Finished")

if __name__ == "__main__":
    try:
        run_test()
    except Exception as e:
        print(e)
