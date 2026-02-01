import struct
import json
import subprocess
import sys
import os
import time

# Path to host.bat
HOST_SCRIPT = r"c:\interop io intelligence\interop io intelligence\interop-ai-lab\analyst\host\host.bat"

def encode_message(content):
    json_bytes = json.dumps(content).encode('utf-8')
    # Use native order (@I) to match host.py's unpack
    header = struct.pack('@I', len(json_bytes))
    return header + json_bytes

def decode_message(stdout):
    if len(stdout) < 4:
        return None, stdout
    length = struct.unpack('@I', stdout[:4])[0]
    payload = stdout[4:4+length]
    return json.loads(payload)

print(f"Launching {HOST_SCRIPT}...")
process = subprocess.Popen(
    [HOST_SCRIPT],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=None # Inherit stderr to see debug output immediately
)

msg = {
    "logs": [
        {
            "origin": "TEST_E2E",
            "type": "TestBroadcast",
            "data": {"ticker": "TEST"},
            "timestamp": 123456789
        }
    ]
}

encoded = encode_message(msg)
print("Sending message...")
stdout, stderr = process.communicate(input=encoded)

print("\n--- STDERR (Debug Info) ---")
print(stderr.decode('utf-8', errors='replace'))

print("\n--- STDOUT (Response) ---")
try:
    response = decode_message(stdout)
    print(json.dumps(response, indent=2))
except Exception as e:
    print(f"Failed to decode: {e}")
    print(f"Raw stdout: {stdout}")

if process.returncode != 0:
    print(f"\nHost exited with code {process.returncode}")
