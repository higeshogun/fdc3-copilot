
import requests
import json
import websocket
import ssl
import time

IBKR_BASE_URL = "https://localhost:5000"
IBKR_WS_URL = "wss://localhost:5000/v1/api/ws"

session = requests.Session()
session.verify = False

print("Checking Auth Status...")
try:
    resp = session.post(f"{IBKR_BASE_URL}/v1/api/iserver/auth/status", json={}, timeout=10)
    print(f"Auth Response: {resp.status_code}")
    print(f"Auth Body: {resp.text}")
    print(f"Cookies: {session.cookies.get_dict()}")
except Exception as e:
    print(f"Auth Error: {e}")

cookies = "; ".join([f"{c.name}={c.value}" for c in session.cookies])
print(f"Cookie string for WS: {cookies}")

def on_message(ws, message):
    print(f"WS Message: {message}")

def on_error(ws, error):
    print(f"WS Error: {error}")

def on_close(ws, status, msg):
    print(f"WS Closed: {status} {msg}")

def on_open(ws):
    print("WS Opened")

ws = websocket.WebSocketApp(
    IBKR_WS_URL,
    on_message=on_message,
    on_error=on_error,
    on_close=on_close,
    on_open=on_open,
    cookie=cookies if cookies else None
)

print("Starting WS connection (5 second timeout)...")
import threading
t = threading.Thread(target=ws.run_forever, kwargs={"sslopt": {"cert_reqs": ssl.CERT_NONE}})
t.daemon = True
t.start()

time.sleep(5)
print("Done.")
