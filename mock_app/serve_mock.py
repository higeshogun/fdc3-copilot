from flask import Flask, request, jsonify, send_from_directory, Response
from flask_cors import CORS
import os
import requests
import json
import threading
import time
import ssl
import queue
import uuid
import random
# Import IBKR Gateway client (bypasses broken FastMCP)
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
from ibkr_gateway_client import ibkr_gateway_client as mcp_client

log_lock = threading.Lock()
def log_to_file(message):
    log_path = os.path.join(DIRECTORY, "ibkr_proxy.log")
    with log_lock:
        try:
            with open(log_path, "a", encoding='utf-8') as f:
                f.write(f"[{time.ctime()}] {message}\n")
        except:
            pass

app = Flask(__name__)
CORS(app)


# ═══════════════════════════════════════════════════════════
# PENDING TRADES STORAGE (for AI-proposed trades awaiting confirmation)
# ═══════════════════════════════════════════════════════════
pending_trades = {}  # token -> trade_proposal

# ═══════════════════════════════════════════════════════════
# IBKR TOOLS DEFINITION (OpenAI Function Calling Format)
# ═══════════════════════════════════════════════════════════
IBKR_TOOLS_OPENAI = [
    {
        "type": "function",
        "function": {
            "name": "get_orders",
            "description": "Get list of current orders from Interactive Brokers",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_positions",
            "description": "Get current portfolio positions from Interactive Brokers",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_account_summary",
            "description": "Get account balance and buying power from Interactive Brokers",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "place_order",
            "description": "Place a BUY or SELL order (requires user confirmation before execution)",
            "parameters": {
                "type": "object",
                "properties": {
                    "symbol": {
                        "type": "string",
                        "description": "The ticker symbol (e.g., AAPL, EUR/USD)"
                    },
                    "side": {
                        "type": "string",
                        "enum": ["BUY", "SELL"],
                        "description": "Order side"
                    },
                    "quantity": {
                        "type": "number",
                        "description": "Number of shares/contracts"
                    },
                    "order_type": {
                        "type": "string",
                        "enum": ["MARKET", "LIMIT"],
                        "description": "Order type"
                    },
                    "price": {
                        "type": "number",
                        "description": "Limit price (required for LIMIT orders)"
                    }
                },
                "required": ["symbol", "side", "quantity", "order_type"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "cancel_order",
            "description": "Cancel a pending order",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {
                        "type": "string",
                        "description": "The order ID to cancel"
                    }
                },
                "required": ["order_id"]
            }
        }
    }
]

# ═══════════════════════════════════════════════════════════
# IBKR PROXY CONFIGURATION
# ═══════════════════════════════════════════════════════════
IBKR_BASE_URL = "https://127.0.0.1:5000"
IBKR_WS_URL = "wss://127.0.0.1:5000/v1/api/ws"

# Symbol -> ConId mapping (starts with common symbols, dynamically expands)
SYMBOL_CONID_MAP = {
    'AAPL': 265598,
    'MSFT': 272093,
    'TSLA': 76792991,
    'NVDA': 4516593,
    'GOOGL': 208813720,
    'AMZN': 3691937,
    'META': 107113386,
    # FX (IDEALPRO cash contracts)
    'EUR/USD': 12087792,
    'GBP/USD': 12087797,
    'USD/JPY': 15016059,
}
CONID_SYMBOL_MAP = {v: k for k, v in SYMBOL_CONID_MAP.items()}
IBKR_FIELDS = ['31', '84', '85', '86', '88', '83', '7059', '6509']

def subscribe_to_symbol(symbol, ws=None):
    """Subscribe to market data for a symbol (looks up conid if needed)"""
    global SYMBOL_CONID_MAP, CONID_SYMBOL_MAP, ibkr_ws
    
    # Already subscribed
    if symbol in SYMBOL_CONID_MAP:
        conid = SYMBOL_CONID_MAP[symbol]
        log_to_file(f"[IBKR] Symbol {symbol} already mapped to conid {conid}")
    else:
        # Look up conid from IBKR
        try:
            search_results = mcp_client.search_contracts(symbol)
            if search_results and len(search_results) > 0:
                conid = search_results[0].get('conid')
                if conid:
                    SYMBOL_CONID_MAP[symbol] = int(conid)
                    CONID_SYMBOL_MAP[int(conid)] = symbol
                    log_to_file(f"[IBKR] Mapped {symbol} to conid {conid}")
                else:
                    log_to_file(f"[IBKR] No conid found for {symbol}")
                    return False
            else:
                log_to_file(f"[IBKR] No search results for {symbol}")
                return False
        except Exception as e:
            log_to_file(f"[IBKR] Error looking up {symbol}: {e}")
            return False
    
    # Subscribe via websocket if connected
    websocket = ws or ibkr_ws
    if websocket and ibkr_ws_connected:
        try:
            conid = SYMBOL_CONID_MAP[symbol]
            sub_msg = f'smd+{conid}+{json.dumps({"fields": IBKR_FIELDS})}'
            websocket.send(sub_msg)
            log_to_file(f"[IBKR] Subscribed to {symbol} (conid: {conid})")
            return True
        except Exception as e:
            log_to_file(f"[IBKR] Error subscribing to {symbol}: {e}")
            return False
    else:
        log_to_file(f"[IBKR] WebSocket not connected, will subscribe when connected")
        return True  # Will subscribe when WS connects


# Session to maintain cookies across IBKR requests
ibkr_session = requests.Session()
ibkr_session.verify = False  # Self-signed cert

# Suppress SSL warnings for IBKR self-signed cert
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Global state for WebSocket relay
ibkr_ws_clients = []  # List of SSE queues for connected clients
ibkr_ws = None
ibkr_ws_lock = threading.Lock()
ibkr_ws_connected = False
ibkr_sts_received = False
ibkr_market_data = {}  # conid -> {field: value}

PORT = 5500
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

# ═══════════════════════════════════════════════════════════
# IBKR PROXY ENDPOINTS
# ═══════════════════════════════════════════════════════════

@app.route('/ibkr/auth/status', methods=['POST'])
def ibkr_auth_status():
    """Proxy for IBKR auth status check"""
    try:
        resp = ibkr_session.post(
            f"{IBKR_BASE_URL}/v1/api/iserver/auth/status",
            json={},
            timeout=10
        )
        return jsonify(resp.json()), resp.status_code
    except Exception as e:
        print(f"[IBKR Proxy] Auth status error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/ibkr/auth/ssodh/init', methods=['POST'])
def ibkr_ssodh_init():
    """Proxy for IBKR SSO DH init"""
    try:
        resp = ibkr_session.post(
            f"{IBKR_BASE_URL}/v1/api/iserver/auth/ssodh/init",
            json={"publish": True, "compete": True},
            timeout=10
        )
        return jsonify(resp.json()), resp.status_code
    except Exception as e:
        print(f"[IBKR Proxy] SSO init error: {e}")
        return jsonify({"error": str(e)}), 500

def broadcast_to_clients(message):
    """Send message to all connected SSE clients"""
    dead_clients = []
    for q in ibkr_ws_clients:
        try:
            q.put_nowait(message)
        except queue.Full:
            dead_clients.append(q)
    for q in dead_clients:
        if q in ibkr_ws_clients:
            ibkr_ws_clients.remove(q)

def parse_ibkr_price(value):
    """Strip leading letter prefix from IBKR delayed prices (e.g., 'C270.01' -> 270.01)"""
    if value is None:
        return None
    s = str(value)
    # Strip leading letters
    cleaned = ''.join(c for i, c in enumerate(s) if c.isdigit() or c == '.' or c == '-' or (i > 0 and c == 'e'))
    if not cleaned:
        return None
    try:
        return float(cleaned)
    except:
        return None

def process_market_data(data):
    """Process incoming market data and broadcast updates"""
    global ibkr_market_data

    conid = data.get('conid')
    if not conid:
        return

    # Merge with existing state
    if conid not in ibkr_market_data:
        ibkr_market_data[conid] = {}

    for key, value in data.items():
        if key != 'conid':
            ibkr_market_data[conid][key] = value

    # Build update message for frontend
    symbol = CONID_SYMBOL_MAP.get(conid)
    if not symbol:
        log_to_file(f"[IBKR] No symbol for conid {conid}")
        return

    state = ibkr_market_data[conid]
    last = parse_ibkr_price(state.get('31'))
    bid = parse_ibkr_price(state.get('84'))
    ask = parse_ibkr_price(state.get('86'))
    chg = parse_ibkr_price(state.get('83'))
    is_delayed = 'D' in str(state.get('6509', ''))

    if last is not None:
        update = {
            'type': 'marketData',
            'symbol': symbol,
            'last': last,
            'bid': bid,
            'ask': ask,
            'chg': chg,
            'isDelayed': is_delayed
        }
        broadcast_to_clients(json.dumps(update))

def ibkr_websocket_thread():
    """Background thread that maintains IBKR WebSocket connection"""
    global ibkr_ws, ibkr_ws_connected, ibkr_sts_received

    try:
        import websocket
    except ImportError:
        log_to_file("[IBKR WS] Installing websocket-client...")
        import subprocess
        subprocess.check_call(['.venv/Scripts/pip.exe', 'install', 'websocket-client'])
        import websocket

    def on_message(ws, message):
        global ibkr_sts_received

        try:
            if isinstance(message, bytes):
                message = message.decode('utf-8')
            data = json.loads(message)
            log_to_file(f"[IBKR WS] Received message: {message[:100]}...")

            # Handle arrays of updates
            if isinstance(data, list):
                for item in data:
                    if isinstance(item, dict) and 'conid' in item:
                        process_market_data(item)

            # Handle sts message
            elif isinstance(data, dict):
                topic = data.get('topic')
                if topic == 'sts':
                    log_to_file(f"[IBKR WS] Received sts: {data}")
                    if not ibkr_sts_received:
                        ibkr_sts_received = True
                        # Subscribe to all symbols
                        for symbol, conid in SYMBOL_CONID_MAP.items():
                            sub_msg = f'smd+{conid}+{json.dumps({"fields": IBKR_FIELDS})}'
                            log_to_file(f"[IBKR WS] Subscribing: {sub_msg}")
                            ws.send(sub_msg)
                        broadcast_to_clients(json.dumps({'type': 'connected', 'status': True}))

                elif 'conid' in data:
                    process_market_data(data)

        except json.JSONDecodeError:
            # Non-JSON message (heartbeat response, etc.)
            pass
        except Exception as e:
            log_to_file(f"[IBKR WS] Message error: {e}")

    def on_error(ws, error):
        log_to_file(f"[IBKR WS] Error: {error}")
        broadcast_to_clients(json.dumps({'type': 'error', 'message': str(error)}))

    def on_close(ws, close_status_code, close_msg):
        global ibkr_ws_connected, ibkr_sts_received
        ibkr_ws_connected = False
        ibkr_sts_received = False
        log_to_file(f"[IBKR WS] Closed: {close_status_code} {close_msg}")
        broadcast_to_clients(json.dumps({'type': 'connected', 'status': False}))

    def on_open(ws):
        global ibkr_ws_connected
        ibkr_ws_connected = True
        log_to_file("[IBKR WS] Connected, waiting for sts...")

    while True:
        try:
            # Get cookies from session
            cookies = "; ".join([f"{c.name}={c.value}" for c in ibkr_session.cookies])
            log_to_file(f"[IBKR WS] Starting connection with {len(ibkr_session.cookies)} cookies")

            ibkr_ws = websocket.WebSocketApp(
                IBKR_WS_URL,
                on_message=on_message,
                on_error=on_error,
                on_close=on_close,
                on_open=on_open,
                cookie=cookies if cookies else None
            )

            # Run with heartbeat thread
            def heartbeat():
                while ibkr_ws_connected:
                    time.sleep(10)
                    try:
                        if ibkr_ws and ibkr_ws_connected:
                            ibkr_ws.send("hb")
                    except:
                        pass

            hb_thread = threading.Thread(target=heartbeat, daemon=True)
            hb_thread.start()

            ibkr_ws.run_forever(sslopt={"cert_reqs": ssl.CERT_NONE})

        except Exception as e:
            log_to_file(f"[IBKR WS] Main Loop Error: {e}")

        print("[IBKR WS] Reconnecting in 5 seconds...")
        time.sleep(5)

@app.route('/ibkr/stream')
def ibkr_stream():
    """SSE endpoint that streams IBKR market data to frontend"""

    # Create a queue for this client
    client_queue = queue.Queue(maxsize=100)
    ibkr_ws_clients.append(client_queue)
    print(f"[IBKR SSE] Client connected. Total clients: {len(ibkr_ws_clients)}")

    def generate():
        try:
            # Send current connection status
            yield f"data: {json.dumps({'type': 'connected', 'status': ibkr_ws_connected})}\n\n"

            # Send current market data snapshot
            for conid, state in ibkr_market_data.items():
                symbol = CONID_SYMBOL_MAP.get(conid)
                if symbol:
                    last = parse_ibkr_price(state.get('31'))
                    if last is not None:
                        update = {
                            'type': 'marketData',
                            'symbol': symbol,
                            'last': last,
                            'bid': parse_ibkr_price(state.get('84')),
                            'ask': parse_ibkr_price(state.get('86')),
                            'isDelayed': 'D' in str(state.get('6509', ''))
                        }
                        yield f"data: {json.dumps(update)}\n\n"

            while True:
                try:
                    message = client_queue.get(timeout=5)
                    yield f"data: {message}\n\n"
                except queue.Empty:
                    # Send keepalive comment
                    yield ": keepalive\n\n"
        finally:
            if client_queue in ibkr_ws_clients:
                ibkr_ws_clients.remove(client_queue)
            print(f"[IBKR SSE] Client disconnected. Total clients: {len(ibkr_ws_clients)}")

    return Response(
        generate(),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
        }
    )

@app.route('/ibkr/connect', methods=['POST'])
def ibkr_connect():
    """Initialize IBKR connection (auth + start WebSocket)"""
    global ibkr_ws_connected

    try:
        # Step 1: Auth status
        print("[IBKR] Checking auth status...")
        auth_resp = ibkr_session.post(
            f"{IBKR_BASE_URL}/v1/api/iserver/auth/status",
            json={},
            timeout=10
        )
        log_to_file(f"[IBKR] Auth status check completed. Cookies: {len(ibkr_session.cookies)}")
        print(f"[IBKR] Auth status: {auth_resp.json()}", flush=True)

        # Step 2: SSO DH init
        print("[IBKR] Initializing SSO DH...")
        sso_resp = ibkr_session.post(
            f"{IBKR_BASE_URL}/v1/api/iserver/auth/ssodh/init",
            json={"publish": True, "compete": True},
            timeout=10
        )
        print(f"[IBKR] SSO init: {sso_resp.json()}", flush=True)

        # Step 3: Start WebSocket thread if not running
        ws_thread = None
        for t in threading.enumerate():
            if t.name == 'ibkr_ws_thread':
                ws_thread = t
                break

        if ws_thread is None or not ws_thread.is_alive():
            print("[IBKR] Starting WebSocket thread...", flush=True)
            t = threading.Thread(target=ibkr_websocket_thread, name='ibkr_ws_thread', daemon=True)
            t.start()

        return jsonify({
            "success": True,
            "authStatus": auth_resp.json(),
            "ssoStatus": sso_resp.json()
        })

    except Exception as e:
        print(f"[IBKR] Connect error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/ibkr/debug/cookies')
def ibkr_debug_cookies():
    """Debug route to check current session cookies"""
    return jsonify({
        "cookie_count": len(ibkr_session.cookies),
        "cookies": ibkr_session.cookies.get_dict()
    })

@app.route('/ibkr/status')
def ibkr_status():
    """Get current IBKR connection status"""
    return jsonify({
        "connected": ibkr_ws_connected,
        "stsReceived": ibkr_sts_received,
        "clientCount": len(ibkr_ws_clients),
        "symbols": list(ibkr_market_data.keys())
    })

@app.route('/all_status')
def all_status():
    """Get all connectivity statuses in one call"""
    gateway_available = mcp_client.is_available()
    return jsonify({
        "marketData": {
            "connected": ibkr_ws_connected,
            "stsReceived": ibkr_sts_received,
        },
        "gateway": {
            "available": gateway_available,
        }
    })

@app.route('/ibkr/search/<symbol>')
def ibkr_search(symbol):
    """Search for a contract by symbol to find its conid"""
    try:
        # Search for the symbol
        resp = ibkr_session.get(
            f"{IBKR_BASE_URL}/v1/api/iserver/secdef/search",
            params={"symbol": symbol},
            timeout=10
        )
        if resp.status_code == 200:
            return jsonify(resp.json())
        return jsonify({"error": f"Search failed: {resp.status_code}"}), resp.status_code
    except Exception as e:
        print(f"[IBKR] Search error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/ibkr/secdef/<conid>')
def ibkr_secdef(conid):
    """Get security definition for a conid"""
    try:
        resp = ibkr_session.get(
            f"{IBKR_BASE_URL}/v1/api/iserver/contract/{conid}/info",
            timeout=10
        )
        if resp.status_code == 200:
            return jsonify(resp.json())
        return jsonify({"error": f"Secdef failed: {resp.status_code}"}), resp.status_code
    except Exception as e:
        print(f"[IBKR] Secdef error: {e}")
        return jsonify({"error": str(e)}), 500

# ═══════════════════════════════════════════════════════════
# MCP INTEGRATION - IB_MCP PROXY ENDPOINTS
# ═══════════════════════════════════════════════════════════

@app.route('/mcp/status')
def mcp_status():
    """Check if MCP server is reachable"""
    available = mcp_client.is_available()
    if available:
        tools = mcp_client.list_tools()
        return jsonify({
            "available": True,
            "tools_count": len(tools),
            "url": "http://localhost:5002/mcp/"
        })
    return jsonify({
        "available": False,
        "error": "MCP server not reachable. Is IB_MCP running?"
    })

@app.route('/mcp/tools')
def mcp_tools():
    """List available MCP tools"""
    tools = mcp_client.list_tools()
    return jsonify({"tools": tools})

@app.route('/mcp/positions')
def mcp_positions():
    """Get current positions from IBKR via MCP"""
    try:
        result = mcp_client.get_positions()
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/mcp/account')
def mcp_account():
    """Get account summary from IBKR via MCP"""
    try:
        result = mcp_client.get_account_summary()
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/mcp/orders')
def mcp_orders():
    """Get current orders from IBKR via MCP"""
    try:
        result = mcp_client.get_orders()
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/mcp/search')
def mcp_search():
    """Search for IBKR contracts"""
    symbol = request.args.get('symbol', '')
    if not symbol:
        return jsonify([])
    
    try:
        # Use IBKR Gateway search endpoint
        result = mcp_client.search_contracts(symbol)
        if result and len(result) > 0:
            return jsonify(result)
    except Exception as e:
        print(f"[MCP] Search error: {e}")
    
    # Fallback: Common instruments database (works without IBKR connection)
    common_instruments = {
        # Major Stocks
        'AAPL': {'name': 'Apple Inc.', 'assetClass': 'STK'},
        'MSFT': {'name': 'Microsoft Corporation', 'assetClass': 'STK'},
        'GOOGL': {'name': 'Alphabet Inc.', 'assetClass': 'STK'},
        'AMZN': {'name': 'Amazon.com Inc.', 'assetClass': 'STK'},
        'TSLA': {'name': 'Tesla Inc.', 'assetClass': 'STK'},
        'META': {'name': 'Meta Platforms Inc.', 'assetClass': 'STK'},
        'NVDA': {'name': 'NVIDIA Corporation', 'assetClass': 'STK'},
        'JPM': {'name': 'JPMorgan Chase & Co.', 'assetClass': 'STK'},
        'V': {'name': 'Visa Inc.', 'assetClass': 'STK'},
        'WMT': {'name': 'Walmart Inc.', 'assetClass': 'STK'},
        'DIS': {'name': 'The Walt Disney Company', 'assetClass': 'STK'},
        'NFLX': {'name': 'Netflix Inc.', 'assetClass': 'STK'},
        'BA': {'name': 'Boeing Company', 'assetClass': 'STK'},
        'GS': {'name': 'Goldman Sachs Group Inc.', 'assetClass': 'STK'},
        'IBM': {'name': 'International Business Machines', 'assetClass': 'STK'},
        # Major FX Pairs
        'EUR/USD': {'name': 'Euro / US Dollar', 'assetClass': 'CASH'},
        'GBP/USD': {'name': 'British Pound / US Dollar', 'assetClass': 'CASH'},
        'USD/JPY': {'name': 'US Dollar / Japanese Yen', 'assetClass': 'CASH'},
        'AUD/USD': {'name': 'Australian Dollar / US Dollar', 'assetClass': 'CASH'},
        'USD/CAD': {'name': 'US Dollar / Canadian Dollar', 'assetClass': 'CASH'},
        'EUR/GBP': {'name': 'Euro / British Pound', 'assetClass': 'CASH'},
        # Indices
        'SPY': {'name': 'SPDR S&P 500 ETF', 'assetClass': 'STK'},
        'QQQ': {'name': 'Invesco QQQ Trust', 'assetClass': 'STK'},
        'DIA': {'name': 'SPDR Dow Jones Industrial Average ETF', 'assetClass': 'STK'},
    }
    
    # Search in fallback database
    symbol_upper = symbol.upper()
    results = []
    
    # Exact match
    if symbol_upper in common_instruments:
        results.append({
            'symbol': symbol_upper,
            'name': common_instruments[symbol_upper]['name'],
            'conid': '',
            'assetClass': common_instruments[symbol_upper]['assetClass']
        })
    
    # Partial matches
    for key, value in common_instruments.items():
        if symbol_upper in key and key != symbol_upper:
            results.append({
                'symbol': key,
                'name': value['name'],
                'conid': '',
                'assetClass': value['assetClass']
            })
            if len(results) >= 10:
                break
    
    # If no matches, allow adding as custom stock
    if len(results) == 0:
        results.append({
            'symbol': symbol_upper,
            'name': f'{symbol_upper} - Add as Stock',
            'conid': '',
            'assetClass': 'STK'
        })
    
    return jsonify(results)

@app.route('/mcp/subscribe', methods=['POST'])
def mcp_subscribe():
    """Subscribe to market data for a symbol"""
    data = request.get_json()
    symbol = data.get('symbol', '')
    
    if not symbol:
        return jsonify({'success': False, 'error': 'No symbol provided'})
    
    success = subscribe_to_symbol(symbol)
    return jsonify({'success': success, 'symbol': symbol})

@app.route('/mcp/place_order', methods=['POST'])
def mcp_place_order():
    """Place an order via IBKR Gateway (including advanced order types)"""
    data = request.json
    symbol = data.get('symbol')
    side = data.get('side')
    quantity = int(data.get('quantity', 0))
    order_type = data.get('type', 'MKT')
    price = data.get('price')
    
    # Advanced order fields
    aux_price = data.get('auxPrice')
    trailing_amt = data.get('trailingAmt')
    trailing_type = data.get('trailingType')
    all_or_none = data.get('allOrNone')
    outside_rth = data.get('outsideRTH')

    if not symbol or not side or not quantity:
        return jsonify({"error": "Missing required fields: symbol, side, quantity"}), 400

    print(f"[IBKR] Placing Order: {side} {quantity} {symbol} {order_type} @ {price or 'MKT'}")
    
    try:
        result = mcp_client.place_order(
            symbol=symbol,
            side=side,
            quantity=quantity,
            order_type=order_type,
            limit_price=float(price) if price else None,
            aux_price=float(aux_price) if aux_price else None,
            trailing_amt=float(trailing_amt) if trailing_amt else None,
            trailing_type=trailing_type,
            all_or_none=all_or_none,
            outside_rth=outside_rth
        )
        return jsonify(result)
    except Exception as e:
        print(f"[IBKR] Order Placement Failed: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/mcp/cancel_order', methods=['POST'])
def mcp_cancel_order():
    """Cancel an order via IBKR"""
    data = request.json
    order_id = data.get('order_id')
    
    if not order_id:
        return jsonify({"error": "Missing order_id"}), 400
        
    try:
        result = mcp_client.cancel_order(order_id)
        return jsonify(result)
    except Exception as e:
        print(f"[IBKR] Cancel Order Failed: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/mcp/modify_order', methods=['POST'])
def mcp_modify_order():
    """Modify an order via IBKR"""
    data = request.json
    order_id = data.get('order_id')
    symbol = data.get('symbol')
    side = data.get('side')
    quantity = data.get('quantity')
    order_type = data.get('type', 'MKT')
    limit_price = data.get('price')
    
    if not all([order_id, symbol, side, quantity]):
        return jsonify({"error": "Missing required fields"}), 400
        
    try:
        result = mcp_client.modify_order(
            order_id=order_id,
            symbol=symbol,
            side=side,
            quantity=int(quantity),
            order_type=order_type,
            limit_price=float(limit_price) if limit_price else None
        )
        return jsonify(result)
    except Exception as e:
        print(f"[IBKR] Modify Order Failed: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/mcp/execute', methods=['POST'])
def mcp_execute():
    """Execute an MCP tool call directly"""
    data = request.json
    tool_name = data.get('tool')
    arguments = data.get('arguments', {})

    if not tool_name:
        return jsonify({"error": "tool name required"}), 400

    result = mcp_client.call_tool(tool_name, arguments)
    return jsonify(result)

@app.route('/mcp/confirm', methods=['POST'])
def mcp_confirm():
    """
    Execute a previously proposed trade after user confirmation.
    Expects: { "token": "<pending_trade_token>" }
    """
    global pending_trades
    data = request.json
    token = data.get('token')

    if not token:
        return jsonify({"error": "token required"}), 400

    if token not in pending_trades:
        return jsonify({"error": "Invalid or expired trade token"}), 404

    trade = pending_trades.pop(token)

    # Execute the trade via MCP
    result = mcp_client.place_order(
        symbol=trade['symbol'],
        side=trade['side'],
        quantity=trade['quantity'],
        order_type=trade.get('order_type', 'MKT'),
        limit_price=trade.get('limit_price')
    )

    return jsonify({
        "executed": True,
        "trade": trade,
        "result": result
    })

@app.route('/mcp/cancel-proposal', methods=['POST'])
def mcp_cancel_proposal():
    """Cancel a pending trade proposal"""
    global pending_trades
    data = request.json
    token = data.get('token')

    if token and token in pending_trades:
        pending_trades.pop(token)

    return jsonify({"cancelled": True})

# ═══════════════════════════════════════════════════════════
# STANDARD MCP-OVER-SSE TRANSPORT
# ═══════════════════════════════════════════════════════════

# Store active MCP SSE clients: sessionId -> queue
mcp_sse_clients = {}
mcp_sse_lock = threading.Lock()

@app.route('/mcp/sse')
def mcp_sse_endpoint():
    """
    Standard MCP SSE Endpoint.
    Establishes the connection and returns the endpoint for sending messages.
    """
    session_id = str(uuid.uuid4())
    client_queue = queue.Queue()
    
    with mcp_sse_lock:
        mcp_sse_clients[session_id] = client_queue
        
    print(f"[MCP SSE] New client connected: {session_id}")
    
    def generate():
        try:
            # Send the endpoint event as per MCP spec
            # The client should POST messages to this URL
            endpoint_url = f"/mcp/messages?sessionId={session_id}"
            yield f"event: endpoint\ndata: {endpoint_url}\n\n"
            
            # Keep connection open
            while True:
                try:
                    message = client_queue.get(timeout=5)
                    yield f"event: message\ndata: {json.dumps(message)}\n\n"
                except queue.Empty:
                    # Keepalive
                    yield ": keepalive\n\n"
        finally:
            with mcp_sse_lock:
                if session_id in mcp_sse_clients:
                    del mcp_sse_clients[session_id]
            print(f"[MCP SSE] Client disconnected: {session_id}")

    return Response(
        generate(),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
        }
    )

def send_mcp_response(sid, mid, response):
    """
    Send an MCP response back to the client via SSE.
    """
    with mcp_sse_lock:
        if sid in mcp_sse_clients:
            mcp_sse_clients[sid].put(response)
        else:
            print(f"[MCP] Session {sid} not found for async response {mid}")

@app.route('/mcp/messages', methods=['POST'])
def mcp_messages_endpoint():
    """
    Handle incoming MCP JSON-RPC messages from clients.
    """
    session_id = request.args.get('sessionId')
    log_to_file(f"[MCP POST] Incoming request for session: {session_id}")
    
    if not session_id or session_id not in mcp_sse_clients:
        log_to_file(f"[MCP POST] Error: Session {session_id} not found in {list(mcp_sse_clients.keys())}")
        return jsonify({"error": "Session not found"}), 404
        
    try:
        message = request.json
        log_to_file(f"[MCP POST] Received from {session_id}: {json.dumps(message)}")
        
        # Handle JSON-RPC message
        jsonrpc = message.get("jsonrpc")
        method = message.get("method")
        msg_id = message.get("id")
        params = message.get("params", {})
        
        response = None
        
        if method == "initialize":
            response = {
                "jsonrpc": "2.0",
                "id": msg_id,
                "result": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {
                        "tools": {}
                    },
                    "serverInfo": {
                        "name": "IBKR-Mock-MCP",
                        "version": "1.0.0"
                    }
                }
            }
        
        elif method == "notifications/initialized":
            # Just acknowledgement, no response needed for notification
            pass
            
        elif method == "ping":
            response = {
                "jsonrpc": "2.0",
                "id": msg_id,
                "result": {}
            }
            
        elif method == "tools/list":
            tools = mcp_client.list_tools()
            response = {
                "jsonrpc": "2.0",
                "id": msg_id,
                "result": {
                    "tools": [{
                        "name": t["name"],
                        "description": t["description"],
                        "inputSchema": t.get("inputSchema", {})
                    } for t in tools]
                }
            }
            
        elif method == "tools/call":
            name = params.get("name")
            args = params.get("arguments", {})

            # Execute tool in background thread to avoid blocking the HTTP request
            def run_tool_background(sid, mid, t_name, t_args):
                log_to_file(f"[BG Tool] [MCP-MW] Starting {t_name} for session {sid}...")
                try:
                    # New MCP Tool: ask_analyst
                    if t_name == "ask_analyst":
                        query = t_args.get("query", "")
                        logs = t_args.get("logs", [])
                        config = t_args.get("config", {})
                        enable_trading = t_args.get("enable_trading", False)
                        # Ask analyst non-streaming
                        log_to_file(f"[BG Tool] Calling process_analysis for ask_analyst")
                        result = process_analysis(query, logs, config, stream=False, enable_trading=enable_trading)
                        log_to_file(f"[BG Tool] process_analysis returned: {str(result)[:100]}...")
                    else:
                        # Existing Call to IBKR Client
                        result = mcp_client.call_tool(t_name, t_args)
                    
                    log_to_file(f"[BG Tool] [MCP-MW] Finished {t_name}")
                    
                    # Format for MCP tool result
                    content = []
                    if isinstance(result, (dict, list)):
                        content.append({
                            "type": "text",
                            "text": json.dumps(result)
                        })
                    else:
                        content.append({
                            "type": "text",
                            "text": str(result)
                        })
                        
                    response = {
                        "jsonrpc": "2.0",
                        "id": mid,
                        "result": {
                            "content": content,
                            "isError": False if "error" not in str(result) else True
                        }
                    }
                except Exception as e:
                    log_to_file(f"[BG Tool] Error in {t_name}: {e}")
                    response = {
                        "jsonrpc": "2.0",
                        "id": mid,
                        "error": {
                            "code": -32000,
                            "message": str(e)
                        }
                    }

                # Send response back via SSE
                with mcp_sse_lock:
                    if sid in mcp_sse_clients:
                        mcp_sse_clients[sid].put(response)

            threading.Thread(
                target=run_tool_background,
                args=(session_id, msg_id, name, args),
                daemon=True
            ).start()
            
            # Return accepted immediately while tool runs in background
            return "Accepted", 202

        else:
            # Unknown method
            if msg_id is not None:
                response = {
                    "jsonrpc": "2.0",
                    "id": msg_id,
                    "error": {
                        "code": -32601,
                        "message": "Method not found"
                    }
                }

        # Send response back via SSE for all methods that produced one
        # (tools/call sends its own response from the background thread)
        if response:
            with mcp_sse_lock:
                if session_id in mcp_sse_clients:
                    mcp_sse_clients[session_id].put(response)

        return "Accepted", 202
        
    except Exception as e:
        print(f"[MCP MSG] Error: {e}")
        return jsonify({"error": str(e)}), 500

# ═══════════════════════════════════════════════════════════
# TRADING TOOLS FOR GEMINI FUNCTION CALLING
# ═══════════════════════════════════════════════════════════

TRADING_TOOLS = [
    {
        "name": "place_order",
        "description": "Place a stock order through Interactive Brokers. This will propose the trade for user confirmation before execution.",
        "parameters": {
            "type": "object",
            "properties": {
                "symbol": {
                    "type": "string",
                    "description": "Stock symbol (e.g., AAPL, MSFT, TSLA)"
                },
                "side": {
                    "type": "string",
                    "enum": ["BUY", "SELL"],
                    "description": "Order side: BUY or SELL"
                },
                "quantity": {
                    "type": "integer",
                    "description": "Number of shares to trade"
                },
                "order_type": {
                    "type": "string",
                    "enum": ["MKT", "LMT"],
                    "description": "Order type: MKT (market) or LMT (limit)"
                },
                "limit_price": {
                    "type": "number",
                    "description": "Limit price (required for LMT orders)"
                }
            },
            "required": ["symbol", "side", "quantity", "order_type"]
        }
    },
    {
        "name": "get_positions",
        "description": "Get current portfolio positions from Interactive Brokers account",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    {
        "name": "get_account_summary",
        "description": "Get account balance, buying power, and other account metrics from Interactive Brokers",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    {
        "name": "cancel_order",
        "description": "Cancel a pending order by its order ID",
        "parameters": {
            "type": "object",
            "properties": {
                "order_id": {
                    "type": "string",
                    "description": "The order ID to cancel"
                }
            },
            "required": ["order_id"]
        }
    },
    {
        "name": "get_orders",
        "description": "Get list of current/recent orders from Interactive Brokers",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": []
        }
    }
]

def convert_tools_to_gemini_format():
    """Convert TRADING_TOOLS to Gemini function declaration format"""
    return [{
        "function_declarations": [{
            "name": tool["name"],
            "description": tool["description"],
            "parameters": tool["parameters"]
        } for tool in TRADING_TOOLS]
    }]

def execute_tool_call(tool_name: str, arguments: dict) -> dict:
    """
    Execute a tool call from the LLM.
    For place_order, creates a pending trade for confirmation.
    For other tools, executes directly via MCP.
    """
    global pending_trades

    if tool_name == "place_order":
        # Create a pending trade for user confirmation
        token = str(uuid.uuid4())
        trade_proposal = {
            "symbol": arguments.get("symbol", "").upper(),
            "side": arguments.get("side", "BUY").upper(),
            "quantity": int(arguments.get("quantity", 0)),
            "order_type": arguments.get("order_type", "MKT").upper(),
            "limit_price": arguments.get("limit_price"),
            "timestamp": time.time()
        }
        pending_trades[token] = trade_proposal

        return {
            "type": "pending_trade",
            "token": token,
            "proposal": trade_proposal,
            "message": f"Trade proposal created: {trade_proposal['side']} {trade_proposal['quantity']} {trade_proposal['symbol']} ({trade_proposal['order_type']}). Awaiting user confirmation."
        }

    elif tool_name == "get_positions":
        return mcp_client.get_positions()

    elif tool_name == "get_account_summary":
        return mcp_client.get_account_summary()

    elif tool_name == "cancel_order":
        order_id = arguments.get("order_id")
        if not order_id:
            return {"error": "order_id required"}
        return mcp_client.cancel_order(order_id)

    elif tool_name == "get_orders":
        return mcp_client.get_orders()

    else:
        return {"error": f"Unknown tool: {tool_name}"}

# ═══════════════════════════════════════════════════════════
# ORIGINAL MOCK APP ROUTES
# ═══════════════════════════════════════════════════════════

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'mock_app.html')

@app.route('/assets/<path:path>')
def send_assets(path):
    return send_from_directory(os.path.join(app.static_folder, 'assets'), path)


def parse_openai_sse(resp):
    """
    Parse OpenAI-compatible SSE streaming response.
    Yields text strings for each content delta.
    Works with OpenAI, local LLMs (LM Studio, Ollama, llama.cpp).
    """
    for line in resp.iter_lines():
        if not line:
            continue
        line_str = line.decode('utf-8').strip() if isinstance(line, bytes) else line.strip()
        if not line_str.startswith("data: "):
            continue
        content = line_str[6:]
        if content == "[DONE]":
            break
        try:
            chunk = json.loads(content)
            choices = chunk.get('choices', [])
            if choices:
                delta = choices[0].get('delta', {})
                text = delta.get('content', '')
                if text:
                    yield text
        except Exception:
            pass


def parse_gemini_sse(resp):
    """
    Parse Gemini SSE streaming response, handling multi-line JSON events.
    Yields text strings for each text chunk found.
    Gemini 2.5+ models may send multi-line JSON in SSE data events.
    """
    event_data = ""
    event_count = 0
    text_count = 0

    def _try_parse_event(data):
        nonlocal text_count
        try:
            chunk = json.loads(data)
            parts = chunk.get('candidates', [{}])[0].get('content', {}).get('parts', [])
            for part in parts:
                text = part.get('text', '')
                if text:
                    text_count += 1
                    return text
        except Exception as e:
            log_to_file(f"[Gemini SSE] Parse error: {e} | Data: {data[:200]}")
        return None

    for line in resp.iter_lines():
        if not line:  # Empty line = end of SSE event
            if event_data:
                event_count += 1
                text = _try_parse_event(event_data)
                if text:
                    yield text
                event_data = ""
        else:
            line_str = line.decode('utf-8') if isinstance(line, bytes) else line
            if line_str.startswith('data: '):
                # If we already have pending data, flush it first (back-to-back events without blank line)
                if event_data:
                    event_count += 1
                    text = _try_parse_event(event_data)
                    if text:
                        yield text
                event_data = line_str[6:]
            elif event_data:
                # Continuation of multi-line JSON data
                event_data += line_str

    # Handle final event (may not have trailing blank line)
    if event_data:
        event_count += 1
        text = _try_parse_event(event_data)
        if text:
            yield text

    log_to_file(f"[Gemini SSE] Done: {event_count} events, {text_count} text chunks")


def gemini_call(prompt, api_key, model, temp, system_prompt, stream=False, enable_tools=False):
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:{'streamGenerateContent' if stream else 'generateContent'}?key={api_key}"
        # Use SSE format for streaming (easier to parse than JSON array)
        if stream:
            url += "&alt=sse"
        payload = {
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": temp}
        }

        # Add function calling tools if enabled
        if enable_tools:
            payload["tools"] = convert_tools_to_gemini_format()

        resp = requests.post(url, json=payload, timeout=60, stream=stream)
        if resp.status_code == 200:
            if stream: return resp
            return resp.json()
        raise Exception(f"Gemini {resp.status_code}: {resp.text}")
    except requests.exceptions.RequestException as e:
        raise Exception(f"Gemini Network Error: {str(e)}")

def openai_call(prompt, api_key, model, temp, system_prompt, base_url, stream=False, tools=None):
    try:
        base_url = base_url.rstrip('/')
        if not base_url.endswith('/v1'):
             base_url += '/v1'

        url = f"{base_url}/chat/completions"
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

        # Add tools if provided (for function calling)
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"

        resp = requests.post(url, headers=headers, json=payload, timeout=120, stream=stream)
        if resp.status_code == 200:
            if stream: return resp
            result = resp.json()
            message = result['choices'][0]['message']
            # Return full message (may contain tool_calls)
            log_to_file(f"[LLM Success] Received message: {str(message)[:100]}...")
            return message
        log_to_file(f"[LLM Error] Status {resp.status_code}: {resp.text}")
        raise Exception(f"OpenAI/Local {resp.status_code}: {resp.text}")
    except requests.exceptions.ConnectionError:
        raise Exception(f"Connection Refused. Is your local LLM server running at {base_url}?")
    except requests.exceptions.Timeout:
        raise Exception("Request timed out. Try a faster model or check your server load.")
    except requests.exceptions.RequestException as e:
        log_to_file(f"[LLM Error] Local LLM Request Failed: {e}")
        raise Exception(f"Local LLM Error: {str(e)}")

def process_analysis(query, logs, config, stream=False, enable_trading=True):
    """
    Core analysis logic shared between HTTP /analyze endpoint and MCP 'ask_analyst' tool.
    Retuns a generator if stream=True, or a dict if stream=False.
    """
    # Session Persistence Logic
    if logs:
        try:
            # Locate analyst/sessions relative to this script
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            sessions_dir = os.path.join(base_dir, "analyst", "sessions")

            if not os.path.exists(sessions_dir):
                os.makedirs(sessions_dir)

            # Use timestamp and random suffix to avoid collisions if multiple requests arrive at the same second
            ts = int(time.time() * 1000)
            rand = random.randint(1000, 9999)
            session_file = os.path.join(sessions_dir, f"session-{ts}-{rand}.json")

            with open(session_file, "w", encoding='utf-8') as f:
                json.dump(logs, f, indent=2)
            print(f"Session saved: {os.path.basename(session_file)}")
        except Exception as e:
            print(f"Failed to save session: {e}")

    provider = config.get('provider', 'gemini')
    api_key = config.get('key', '')
    model_name = config.get('model', 'gemini-1.5-flash')
    temp = config.get('temp', 0.7)
    system_prompt = config.get('prompt', 'You are an expert financial AI assistant.')
    base_url = config.get('url', '')

    # Enhance system prompt with IBKR tool instructions when trading is enabled
    enhanced_system_prompt = system_prompt
    tool_addendum = """

IBKR TOOL USAGE (MANDATORY):
You have live access to Interactive Brokers. Call these tools — do NOT guess or fabricate data.

| Tool | Use when asked about |
|------|---------------------|
| get_positions | Holdings, portfolio, "what do I own", P&L |
| get_orders | Open/pending/recent orders, order status |
| get_account_summary | Balance, buying power, margin, net liquidation, equity |
| place_order | Buying or selling (always requires user confirmation) |
| cancel_order | Cancelling a pending order |

RULES:
1. ALWAYS call the appropriate tool before answering data questions. Tool output is ground truth.
2. NEVER invent positions, prices, balances, or order IDs. If a tool call fails, tell the user.
3. FDC3 logs show UI activity (clicks, selections) and periodic portfolio.summary snapshots. They are contextual — not authoritative for current holdings. Always prefer tool data.
4. Present tool results clearly: use tables for multiple items, include quantities and prices.
5. For trade suggestions, state the instrument, side, quantity, order type, and your rationale.
"""
    if enable_trading:
        enhanced_system_prompt += tool_addendum

    log_context = ""
    for entry in logs:
        log_context += f"[{entry.get('origin')}] {entry.get('type')}: {json.dumps(entry.get('data'))}\\n"

    prompt = f"Captured FDC3 Contexts:\\n{log_context}\\n\\nUser Question: {query}"

    if not api_key and provider != 'local':
        if not stream:
            return {"analysis": "API Key Missing. Please go to Settings."}

    # Streaming Logic Wrapper (Inner Generator)
    def stream_generator():
        if not api_key and provider != 'local':
             yield f"data: {json.dumps({'error': 'API Key Missing'})}\n\n"
             return

        log_to_file(f"[Native Stream] Starting: provider={provider}, model={model_name}, trading={enable_trading}")

        try:
            target_resp = None
            if provider == 'gemini':
                # For streaming with function calling, we need a different approach
                # First try with function calling (non-streaming)
                if enable_trading:
                    try:
                        response = gemini_call(prompt, api_key, model_name, temp, enhanced_system_prompt, stream=False, enable_tools=True)
                        candidate = response.get('candidates', [{}])[0]
                        content = candidate.get('content', {})
                        parts = content.get('parts', [])

                        # Scan ALL parts for function calls first (Gemini 2.5+ may return text + functionCall together)
                        func_call_part = next((p for p in parts if 'functionCall' in p), None)
                        text_parts = [p.get('text', '') for p in parts if 'text' in p and p.get('text')]

                        if func_call_part:
                            func_call = func_call_part['functionCall']
                            tool_name = func_call.get('name')
                            arguments = func_call.get('args', {})

                            log_to_file(f"[MCP-MW] [Function Call] {tool_name}: {arguments}")

                            # Stream any preamble text (e.g. "I am calling get_orders...")
                            for t in text_parts:
                                yield f"data: {json.dumps({'text': t + chr(10) + chr(10)})}\n\n"

                            # Execute the tool
                            tool_result = execute_tool_call(tool_name, arguments)

                            # If it's a pending trade, send special response
                            if tool_result.get('type') == 'pending_trade':
                                yield f"data: {json.dumps({'pending_trade': tool_result})}\n\n"
                                yield f"data: {json.dumps({'text': tool_result['message']})}\n\n"
                            elif tool_result.get('error'):
                                # Tool returned an error — show it directly
                                err_msg = tool_result['error']
                                log_to_file(f"[Native Stream] Tool error: {err_msg}")
                                yield f"data: {json.dumps({'text': 'IBKR Error: ' + err_msg})}\n\n"
                            else:
                                # For data queries, call LLM again to summarize
                                tool_result_str = json.dumps(tool_result, indent=2)
                                summary_prompt = f"User asked: {query}\n\nHere is the data from IBKR:\n{tool_result_str}\n\nPlease provide a clear, formatted summary of this data for the user."
                                summary_resp = gemini_call(summary_prompt, api_key, model_name, temp, enhanced_system_prompt, stream=True, enable_tools=False)

                                got_text = False
                                for text in parse_gemini_sse(summary_resp):
                                    got_text = True
                                    yield f"data: {json.dumps({'text': text})}\n\n"
                                if not got_text:
                                    yield f"data: {json.dumps({'text': f'IBKR Data:\\n```json\\n{tool_result_str}\\n```'})}\n\n"
                        elif text_parts:
                            # No function call — just stream the text
                            for t in text_parts:
                                yield f"data: {json.dumps({'text': t})}\n\n"

                    except Exception as e:
                        print(f"Function calling error, falling back to regular: {e}")
                        # Fall back to regular streaming
                        target_resp = gemini_call(prompt, api_key, model_name, temp, system_prompt, stream=True)
                        for text in parse_gemini_sse(target_resp):
                            yield f"data: {json.dumps({'text': text})}\n\n"
                else:
                    # No function calling, regular streaming
                    target_resp = gemini_call(prompt, api_key, model_name, temp, system_prompt, stream=True)
                    for text in parse_gemini_sse(target_resp):
                        yield f"data: {json.dumps({'text': text})}\n\n"
            else:
                # OpenAI / Local LLM path
                if enable_trading:
                    # Query-based intent detection — local LLMs are unreliable with tool calling,
                    # so detect common IBKR data questions and call tools directly
                    query_lower = query.lower()
                    direct_tool = None
                    if any(kw in query_lower for kw in ['position', 'holding', 'portfolio', 'what do i own', 'what do i hold', 'my stock']):
                        direct_tool = 'get_positions'
                    elif any(kw in query_lower for kw in ['order', 'pending', 'open order', 'my order']):
                        direct_tool = 'get_orders'
                    elif any(kw in query_lower for kw in ['account', 'balance', 'buying power', 'margin', 'equity', 'net liquid']):
                        direct_tool = 'get_account_summary'

                    if direct_tool:
                        log_to_file(f"[Local LLM] Query intent detected → {direct_tool}")
                        tool_result = execute_tool_call(direct_tool, {})
                        if tool_result.get('error'):
                            yield f"data: {json.dumps({'text': 'IBKR Error: ' + tool_result['error']})}\n\n"
                        else:
                            tool_result_str = json.dumps(tool_result, indent=2)
                            summary_prompt = f"User asked: {query}\n\nHere is the real-time data from Interactive Brokers:\n{tool_result_str}\n\nProvide a clear, formatted summary. Only use the data above — do NOT make up any numbers or positions."
                            try:
                                summary_resp = openai_call(summary_prompt, api_key, model_name, temp, enhanced_system_prompt, base_url, stream=True)
                                for text in parse_openai_sse(summary_resp):
                                    yield f"data: {json.dumps({'text': text})}\n\n"
                            except Exception as e:
                                log_to_file(f"[Local LLM] Summary failed: {e}")
                                yield f"data: {json.dumps({'text': f'IBKR Data:\\n```json\\n{tool_result_str}\\n```'})}\n\n"
                    else:
                        # No direct intent match — just stream from LLM directly
                        target_resp = openai_call(prompt, api_key, model_name, temp, enhanced_system_prompt, base_url, stream=True)
                        for text in parse_openai_sse(target_resp):
                            yield f"data: {json.dumps({'text': text})}\n\n"
                else:
                    # No trading enabled, just stream
                    target_resp = openai_call(prompt, api_key, model_name, temp, system_prompt, base_url, stream=True)
                    for text in parse_openai_sse(target_resp):
                        yield f"data: {json.dumps({'text': text})}\n\n"
        except Exception as inner_e:
            print(f"Streaming Exception: {inner_e}")
            yield f"data: {json.dumps({'error': str(inner_e)})}\n\n"

    if stream:
        return stream_generator()
    else:
        # NON-STREAMING Implementation (MCP mode) - uses function calling
        try:
            if provider == 'gemini':
                # Call Gemini with function calling enabled
                response = gemini_call(prompt, api_key, model_name, temp, enhanced_system_prompt, enable_tools=enable_trading)
                log_to_file(f"[Gemini] Raw response: {json.dumps(response)[:500]}")

                candidate = response.get('candidates', [{}])[0]
                content = candidate.get('content', {})
                parts = content.get('parts', [])

                # Scan ALL parts for function calls first (Gemini 2.5+ returns text + functionCall together)
                func_call_part = next((p for p in parts if 'functionCall' in p), None)
                text_parts = [p.get('text', '') for p in parts if 'text' in p and p.get('text')]
                preamble = "\n\n".join(text_parts)

                if func_call_part:
                    func_call = func_call_part['functionCall']
                    tool_name = func_call.get('name')
                    arguments = func_call.get('args', {})

                    log_to_file(f"[Gemini] Function call: {tool_name}({arguments})")
                    tool_result = execute_tool_call(tool_name, arguments)

                    if tool_result.get('type') == 'pending_trade':
                        return {
                            "analysis": (preamble + "\n\n" + tool_result['message']).strip(),
                            "pending_trade": tool_result
                        }

                    if tool_result.get('error'):
                        err_msg = f"IBKR Error: {tool_result['error']}"
                        return {"analysis": (preamble + "\n\n" + err_msg).strip() if preamble else err_msg}

                    # Second call to summarize the tool result
                    tool_result_str = json.dumps(tool_result, indent=2)
                    summary_prompt = f"User asked: {query}\n\nHere is the data from IBKR:\n{tool_result_str}\n\nPlease provide a clear, formatted summary of this data for the user."
                    summary_response = gemini_call(summary_prompt, api_key, model_name, temp, enhanced_system_prompt, stream=False, enable_tools=False)
                    summary_candidate = summary_response.get('candidates', [{}])[0]
                    summary_parts = summary_candidate.get('content', {}).get('parts', [])
                    summary_text = "".join(p.get('text', '') for p in summary_parts)

                    return {"analysis": summary_text if summary_text else f"IBKR Data:\n```json\n{tool_result_str}\n```"}

                elif preamble:
                    return {"analysis": preamble}

                return {"analysis": "No response from AI."}

            else:
                # Local / OpenAI path — query intent detection first
                query_lower = query.lower()
                direct_tool = None
                if enable_trading:
                    if any(kw in query_lower for kw in ['position', 'holding', 'portfolio', 'what do i own', 'what do i hold', 'my stock']):
                        direct_tool = 'get_positions'
                    elif any(kw in query_lower for kw in ['order', 'pending', 'open order', 'my order']):
                        direct_tool = 'get_orders'
                    elif any(kw in query_lower for kw in ['account', 'balance', 'buying power', 'margin', 'equity', 'net liquid']):
                        direct_tool = 'get_account_summary'

                if direct_tool:
                    log_to_file(f"[Local LLM MCP] Query intent → {direct_tool}")
                    tool_result = execute_tool_call(direct_tool, {})
                    if tool_result.get('error'):
                        return {"analysis": f"IBKR Error: {tool_result['error']}"}
                    tool_result_str = json.dumps(tool_result, indent=2)
                    summary_prompt = f"User asked: {query}\n\nHere is the real-time data from Interactive Brokers:\n{tool_result_str}\n\nProvide a clear, formatted summary. Only use the data above — do NOT make up any numbers."
                    try:
                        summary_msg = openai_call(summary_prompt, api_key, model_name, temp, enhanced_system_prompt, base_url)
                        summary_text = summary_msg.get('content', '') if isinstance(summary_msg, dict) else str(summary_msg)
                        return {"analysis": summary_text if summary_text else f"IBKR Data:\n```json\n{tool_result_str}\n```"}
                    except Exception:
                        return {"analysis": f"IBKR Data:\n```json\n{tool_result_str}\n```"}

                tools = IBKR_TOOLS_OPENAI if enable_trading else None
                message = openai_call(prompt, api_key, model_name, temp, enhanced_system_prompt, base_url, tools=tools)
                log_to_file(f"[Local LLM] Full response: {json.dumps(message, indent=2)}")

                if isinstance(message, dict) and 'tool_calls' in message and message['tool_calls']:
                    tool_call = message['tool_calls'][0]
                    function = tool_call.get('function', {})
                    tool_name = function.get('name')
                    try:
                        arguments = json.loads(function.get('arguments', '{}'))
                    except:
                        arguments = {}

                    log_to_file(f"[Local LLM] Tool call: {tool_name}({arguments})")
                    tool_result = execute_tool_call(tool_name, arguments)

                    if tool_result.get('type') == 'pending_trade':
                        return {"analysis": tool_result['message'], "pending_trade": tool_result}

                    if tool_result.get('error'):
                        return {"analysis": f"IBKR Error: {tool_result['error']}"}

                    # Call LLM again to summarize the tool result
                    tool_result_str = json.dumps(tool_result, indent=2)
                    summary_prompt = f"User asked: {query}\n\nHere is the data from IBKR:\n{tool_result_str}\n\nPlease provide a clear, formatted summary of this data for the user."
                    try:
                        summary_msg = openai_call(summary_prompt, api_key, model_name, temp, enhanced_system_prompt, base_url)
                        summary_text = summary_msg.get('content', '') if isinstance(summary_msg, dict) else str(summary_msg)
                        return {"analysis": summary_text if summary_text else f"IBKR Data:\n```json\n{tool_result_str}\n```"}
                    except Exception:
                        return {"analysis": f"IBKR Data:\n```json\n{tool_result_str}\n```"}

                # No formal tool_calls — check for text-based tool call
                content = message.get('content', '') if isinstance(message, dict) else str(message)
                if content:
                    known_tools = ['get_positions', 'get_orders', 'get_account_summary']
                    detected_tool = next((t for t in known_tools if t in content), None)
                    if detected_tool:
                        log_to_file(f"[Local LLM MCP] Detected text-based tool call: {detected_tool}")
                        tool_result = execute_tool_call(detected_tool, {})
                        if tool_result.get('error'):
                            return {"analysis": f"IBKR Error: {tool_result['error']}"}
                        tool_result_str = json.dumps(tool_result, indent=2)
                        summary_prompt = f"User asked: {query}\n\nHere is the real-time data from IBKR:\n{tool_result_str}\n\nPlease provide a clear, formatted summary of this data for the user. Do NOT make up any data."
                        try:
                            summary_msg = openai_call(summary_prompt, api_key, model_name, temp, enhanced_system_prompt, base_url)
                            summary_text = summary_msg.get('content', '') if isinstance(summary_msg, dict) else str(summary_msg)
                            return {"analysis": summary_text if summary_text else f"IBKR Data:\n```json\n{tool_result_str}\n```"}
                        except Exception:
                            return {"analysis": f"IBKR Data:\n```json\n{tool_result_str}\n```"}

                return {"analysis": content if content else "No response from AI."}

        except Exception as e:
            log_to_file(f"[MCP Error] {str(e)}")
            return {"analysis": f"Error: {str(e)}"}

@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.json
    logs = data.get('logs', [])
    query = data.get('query', '')
    config = data.get('config', {})
    stream = data.get('stream', False)
    enable_trading = data.get('enable_trading', True)

    if stream:
        return app.response_class(process_analysis(query, logs, config, stream=True, enable_trading=enable_trading), mimetype='text/event-stream')
    else:
        result = process_analysis(query, logs, config, stream=False, enable_trading=enable_trading)
        return jsonify(result)

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
        if provider == 'gemini':
            gemini_call("ping", api_key, model_name, 0.1, "Respond only with 'pong'")
        else:
            openai_call("ping", api_key, model_name, 0.1, "Respond only with 'pong'", base_url)
        return jsonify({"success": True, "message": f"Successfully connected to {provider.upper()}!"})
    except Exception as e:
        return jsonify({"success": False, "message": f"Connection failed: {str(e)}"})

@app.route('/')
def serve_index():
    return send_from_directory(os.path.join(DIRECTORY, 'static'), 'mock_app.html')

@app.route('/<path:path>')
def static_files(path):
    try:
        return send_from_directory(os.path.join(DIRECTORY, 'static'), path)
    except:
        return jsonify({"error": "File not found"}), 404

if __name__ == '__main__':
    print(f"Mock FDC3 App (Flask) running at http://0.0.0.0:{PORT}")
    print(f"IBKR Proxy endpoints available at /ibkr/*")
    print(f"MCP Integration endpoints available at /mcp/*")
    print(f"  - Ensure IB_MCP is running at http://localhost:5002/mcp/")
    app.run(host='0.0.0.0', port=PORT, debug=False, threaded=True)
