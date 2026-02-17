"""
Direct IBKR Gateway Client

Bypasses the broken FastMCP layer and connects directly to the IBKR Client Portal Gateway REST API.

Usage:
    from ibkr_gateway_client import ibkr_gateway_client

    if ibkr_gateway_client.is_available():
        positions = ibkr_gateway_client.get_positions()
        account = ibkr_gateway_client.get_account_summary()
        result = ibkr_gateway_client.place_order("AAPL", "BUY", 1, "MKT")
"""

import requests
from typing import Optional, Dict, List, Any
import time
import sys
import json
import threading


class IBKRGatewayClient:
    """Client for Interactive Brokers Client Portal Gateway REST API"""

    CACHE_TTL = 30  # seconds

    def __init__(self, base_url: str = "https://localhost:5000"):
        self.base_url = base_url.rstrip('/')
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        # Thread-local sessions instead of a single locked session
        self._local = threading.local()
        # Cache: key -> (timestamp, data)
        self._cache = {}
        self._cache_lock = threading.Lock()

    def _get_session(self) -> requests.Session:
        """Get or create a per-thread requests.Session"""
        session = getattr(self._local, 'session', None)
        if session is None:
            session = requests.Session()
            session.headers.update({'User-Agent': 'FDC3-Copilot/1.0'})
            adapter = requests.adapters.HTTPAdapter(pool_connections=5, pool_maxsize=5)
            session.mount('https://', adapter)
            session.mount('http://', adapter)
            session.verify = False
            self._local.session = session
        return session

    def _rebuild_session(self):
        """Force-rebuild the current thread's session"""
        session = requests.Session()
        session.headers.update({'User-Agent': 'FDC3-Copilot/1.0'})
        adapter = requests.adapters.HTTPAdapter(pool_connections=5, pool_maxsize=5)
        session.mount('https://', adapter)
        session.mount('http://', adapter)
        session.verify = False
        self._local.session = session
        return session

    def _request(self, method, url, **kwargs):
        """Per-thread request with automatic retry on SSL/socket errors"""
        kwargs.setdefault('timeout', 20)
        last_err = None
        for attempt in range(2):
            try:
                session = self._get_session() if attempt == 0 else self._rebuild_session()
                resp = getattr(session, method)(url, **kwargs)
                return resp
            except Exception as e:
                last_err = e
                err_str = str(e)
                if any(s in err_str for s in ('Errno 22', 'Invalid argument', 'Connection aborted', 'RemoteDisconnected')):
                    continue
                raise
        raise last_err

    def _cache_get(self, key: str):
        """Get cached value if still valid"""
        with self._cache_lock:
            entry = self._cache.get(key)
            if entry and (time.time() - entry[0]) < self.CACHE_TTL:
                return entry[1]
        return None

    def _cache_set(self, key: str, value):
        """Store value in cache"""
        with self._cache_lock:
            self._cache[key] = (time.time(), value)

    def invalidate_cache(self, key: str = None):
        """Clear cache entry or all cache"""
        with self._cache_lock:
            if key:
                self._cache.pop(key, None)
            else:
                self._cache.clear()

    def is_available(self) -> bool:
        """Check if the IBKR Gateway is reachable and authenticated"""
        try:
            resp = self._request('get',
                f"{self.base_url}/v1/api/iserver/auth/status",
                timeout=5
            )
            if resp.status_code == 200:
                data = resp.json()
                authenticated = data.get('authenticated', False)
                if not authenticated:
                    print(f"[IBKR Gateway] Reachable but NOT authenticated", flush=True)
                return authenticated
            return False
        except Exception as e:
            print(f"[IBKR Gateway] Not available: {e}", flush=True)
            return False

    def get_auth_status(self) -> Dict[str, Any]:
        """Get authentication status"""
        try:
            resp = self._request('post',
                f"{self.base_url}/v1/api/iserver/auth/status",
                json={},
                timeout=10
            )
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            return {"error": str(e), "authenticated": False}

    def list_tools(self) -> List[Dict[str, Any]]:
        """List available IBKR operations as MCP-compatible tool definitions"""
        return [
            {
                "name": "get_positions",
                "description": "Get current portfolio positions",
                "inputSchema": {"type": "object", "properties": {"account_id": {"type": "string"}}}
            },
            {
                "name": "get_account_summary",
                "description": "Get account summary with balance and buying power",
                "inputSchema": {"type": "object", "properties": {"account_id": {"type": "string"}}}
            },
            {
                "name": "get_orders",
                "description": "Get list of current orders",
                "inputSchema": {"type": "object", "properties": {}}
            },
            {
                "name": "place_order",
                "description": "Place a stock order",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "symbol": {"type": "string"},
                        "side": {"type": "string", "enum": ["BUY", "SELL"]},
                        "quantity": {"type": "integer"},
                        "order_type": {"type": "string", "enum": ["MKT", "LMT"]},
                        "limit_price": {"type": "number"}
                    },
                    "required": ["symbol", "side", "quantity", "order_type"]
                }
            },
            {
                "name": "cancel_order",
                "description": "Cancel an existing order",
                "inputSchema": {
                    "type": "object",
                    "properties": {"order_id": {"type": "string"}},
                    "required": ["order_id"]
                }
            }
        ]

    def call_tool(self, name: str, arguments: Dict[str, Any]) -> Any:
        """Call a tool by name with arguments"""
        if name == "get_accounts":
            return self.get_accounts()
        elif name == "get_positions":
            return self.get_positions(arguments.get('account_id'))
        elif name == "get_account_summary":
            return self.get_account_summary(arguments.get('account_id'))
        elif name == "get_orders":
            return self.get_orders()
        elif name == "place_order":
            return self.place_order(
                arguments.get('symbol'),
                arguments.get('side'),
                arguments.get('quantity'),
                arguments.get('order_type', 'MKT'),
                arguments.get('limit_price')
            )
        elif name == "cancel_order":
            return self.cancel_order(arguments.get('order_id'))
        elif name == "modify_order":
            return self.modify_order(
                arguments.get('order_id'),
                arguments.get('symbol'),
                arguments.get('side'),
                arguments.get('quantity'),
                arguments.get('order_type', 'MKT'),
                arguments.get('limit_price')
            )
        elif name == "search_contract":
            return self.search_contract(arguments.get('symbol'))
        else:
            return {"error": f"Tool not found: {name}"}

    def get_accounts(self) -> List[str]:
        """Get list of available trading accounts"""
        cached = self._cache_get('accounts')
        if cached is not None:
            return cached
        try:
            resp = self._request('get',
                f"{self.base_url}/v1/api/portfolio/accounts",
                timeout=10
            )
            resp.raise_for_status()
            data = resp.json()
            result = [acc.get('id', acc) if isinstance(acc, dict) else acc for acc in data] if isinstance(data, list) else []
            self._cache_set('accounts', result)
            return result
        except Exception as e:
            print(f"[IBKR Gateway] Error getting accounts: {e}")
            return []

    def get_positions(self, account_id: Optional[str] = None) -> Dict[str, Any]:
        """Get current portfolio positions (cached 30s)"""
        cache_key = f'positions:{account_id or "default"}'
        cached = self._cache_get(cache_key)
        if cached is not None:
            return cached
        try:
            if not account_id:
                accounts = self.get_accounts()
                if not accounts:
                    return {"error": "No accounts available"}
                account_id = accounts[0]

            resp = self._request('get',
                f"{self.base_url}/v1/api/portfolio/{account_id}/positions/0",
                timeout=20
            )
            resp.raise_for_status()
            data = resp.json()
            result = {"positions": data, "account_id": account_id}
            self._cache_set(cache_key, result)
            return result
        except Exception as e:
            return {"error": str(e)}

    def get_account_summary(self, account_id: Optional[str] = None) -> Dict[str, Any]:
        """Get account summary with balance and buying power (cached 30s)"""
        cache_key = f'summary:{account_id or "default"}'
        cached = self._cache_get(cache_key)
        if cached is not None:
            return cached
        try:
            if not account_id:
                accounts = self.get_accounts()
                if not accounts:
                    return {"error": "No accounts available"}
                account_id = accounts[0]

            resp = self._request('get',
                f"{self.base_url}/v1/api/portfolio/{account_id}/summary",
                timeout=20
            )
            resp.raise_for_status()
            result = {"summary": resp.json(), "account_id": account_id}
            self._cache_set(cache_key, result)
            return result
        except Exception as e:
            return {"error": str(e)}

    def get_orders(self) -> Dict[str, Any]:
        """Get list of current orders (cached 30s)"""
        cached = self._cache_get('orders')
        if cached is not None:
            return cached
        try:
            resp = self._request('get',
                f"{self.base_url}/v1/api/iserver/account/orders",
                timeout=20
            )
            resp.raise_for_status()
            data = resp.json()
            self._cache_set('orders', data)
            return data
        except Exception as e:
            return {"error": str(e)}

    def search_contracts(self, symbol: str) -> List[Dict[str, Any]]:
        """Search for contracts by symbol"""
        try:
            resp = self._request('get',
                f"{self.base_url}/v1/api/iserver/secdef/search",
                params={"symbol": symbol},
                timeout=10
            )
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, list):
                return [{
                    'symbol': item.get('symbol', symbol),
                    'name': item.get('companyName', item.get('description', '')),
                    'conid': str(item.get('conid', '')),
                    'assetClass': item.get('assetClass', item.get('secType', 'STK'))
                } for item in data]
            return []
        except Exception as e:
            print(f"[IBKR Gateway] Search error: {e}")
            return []

    def search_contract(self, symbol: str) -> Dict[str, Any]:
        """Search for a contract by symbol"""
        try:
            resp = self._request('get',
                f"{self.base_url}/v1/api/iserver/secdef/search",
                params={"symbol": symbol},
                timeout=15
            )
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            return {"error": str(e)}

    def get_contract_info(self, conid: int) -> Dict[str, Any]:
        """Get contract information"""
        try:
            resp = self._request('get',
                f"{self.base_url}/v1/api/iserver/contract/{conid}/info",
                timeout=10
            )
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            return {"error": str(e)}

    def place_order(
        self,
        symbol: str,
        side: str,
        quantity: int,
        order_type: str = "MKT",
        limit_price: Optional[float] = None,
        aux_price: Optional[float] = None,
        trailing_amt: Optional[float] = None,
        trailing_type: Optional[str] = None,
        all_or_none: Optional[bool] = None,
        outside_rth: Optional[bool] = None,
        account_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Place an order — invalidates orders cache on success"""
        try:
            if not account_id:
                accounts = self.get_accounts()
                if not accounts:
                    return {"error": "No accounts available"}
                account_id = accounts[0]

            search_result = self.search_contract(symbol)
            if "error" in search_result or not search_result:
                return {"error": f"Contract not found for symbol: {symbol}"}

            contracts = search_result if isinstance(search_result, list) else search_result.get('contracts', [])

            # FX handling
            if '/' in symbol or ' ' in symbol:
                alt_symbol = symbol.replace('/', '.').replace(' ', '.')
                search_result = self.search_contract(alt_symbol)
                contracts = search_result if isinstance(search_result, list) else search_result.get('contracts', [])

                fx_contracts = []
                for c in contracts:
                    if c.get('secType') == 'CASH':
                        fx_contracts.append(c)
                        continue
                    if 'sections' in c:
                        for s in c['sections']:
                            if s.get('secType') == 'CASH':
                                c_copy = c.copy()
                                if s.get('conid'):
                                    c_copy['conid'] = s['conid']
                                c_copy['secType'] = 'CASH'
                                fx_contracts.append(c_copy)
                                break
                if fx_contracts:
                    contracts = fx_contracts

            if not contracts:
                return {"error": f"No valid contracts found for symbol: {symbol}"}

            conid = contracts[0].get('conid')
            sec_type = contracts[0].get('secType', 'STK')

            if not conid:
                return {"error": "Could not resolve contract ID"}

            try:
                conid = int(conid)
            except ValueError:
                return {"error": f"Invalid conid format: {conid}"}

            order_type = order_type.upper()
            if order_type == "LIMIT": order_type = "LMT"
            elif order_type == "MARKET": order_type = "MKT"
            elif order_type == "STOP": order_type = "STP"

            exchange = contracts[0].get('exchange', 'SMART')
            if sec_type == 'CASH' and exchange == 'SMART':
                exchange = 'IDEALPRO'

            import random
            order = {
                "conid": int(conid),
                "secType": sec_type,
                "orderType": str(order_type),
                "side": str(side),
                "quantity": float(quantity),
                "tif": "DAY",
                "cOID": f"Exp-{random.randint(1000,9999)}",
                "listingExchange": exchange,
                "totalQuantity": int(quantity)
            }

            if order_type == "LMT":
                if limit_price is None:
                    return {"error": "Limit price required for LMT orders"}
                order["price"] = limit_price

            resp = self._request('post',
                f"{self.base_url}/v1/api/iserver/account/{account_id}/orders",
                json={"orders": [order]},
                timeout=30
            )

            if not resp.ok:
                return {"error": f"IBKR Error {resp.status_code}: {resp.text}"}

            data = resp.json()
            if isinstance(data, list) and len(data) > 0:
                data = data[0]

            # Handle confirmation questions
            max_retries = 3
            while max_retries > 0 and 'id' in data and 'messageIds' in data:
                reply_id = data['id']
                confirm_resp = self._request('post',
                    f"{self.base_url}/v1/api/iserver/reply/{reply_id}",
                    json={"confirmed": True},
                    timeout=30
                )
                if not confirm_resp.ok:
                    return {"error": f"Confirmation Failed: {confirm_resp.text}"}
                data = confirm_resp.json()
                if isinstance(data, list) and len(data) > 0:
                    data = data[0]
                max_retries -= 1

            # Invalidate caches after order placement
            self.invalidate_cache('orders')
            self.invalidate_cache()  # positions/account may change too

            return data

        except Exception as e:
            return {"error": str(e)}

    def cancel_order(self, order_id: str, account_id: Optional[str] = None) -> Dict[str, Any]:
        """Cancel an existing order"""
        try:
            if not account_id:
                accounts = self.get_accounts()
                if not accounts:
                    return {"error": "No accounts available"}
                account_id = accounts[0]

            resp = self._request('delete',
                f"{self.base_url}/v1/api/iserver/account/{account_id}/order/{order_id}",
                timeout=30
            )

            if not resp.ok:
                return {"error": f"IBKR Error {resp.status_code}: {resp.text}"}

            self.invalidate_cache('orders')
            return resp.json()
        except Exception as e:
            return {"error": str(e)}

    def modify_order(
        self,
        order_id: str,
        symbol: str,
        side: str,
        quantity: int,
        order_type: str = "MKT",
        limit_price: Optional[float] = None,
        account_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Modify an existing order"""
        try:
            if not account_id:
                accounts = self.get_accounts()
                if not accounts:
                    return {"error": "No accounts available"}
                account_id = accounts[0]

            search_result = self.search_contract(symbol)
            if "error" in search_result or not search_result:
                return {"error": f"Contract not found for symbol: {symbol}"}

            contracts = search_result if isinstance(search_result, list) else search_result.get('contracts', [])
            if not contracts:
                return {"error": f"No contracts found for symbol: {symbol}"}

            conid = contracts[0].get('conid')
            sec_type = contracts[0].get('secType', 'STK')

            if not conid:
                return {"error": "Could not resolve contract ID"}

            order_type = order_type.upper()
            if order_type == "LIMIT": order_type = "LMT"
            elif order_type == "MARKET": order_type = "MKT"

            order = {
                "conid": int(conid),
                "secType": sec_type,
                "orderType": str(order_type),
                "side": str(side),
                "quantity": float(quantity),
                "tif": "DAY"
            }

            if order_type == "LMT":
                if limit_price is None:
                    return {"error": "Limit price required for LMT orders"}
                order["price"] = limit_price

            resp = self._request('post',
                f"{self.base_url}/v1/api/iserver/account/{account_id}/order/{order_id}",
                json=order,
                timeout=15
            )

            if not resp.ok:
                return {"error": f"IBKR Error {resp.status_code}: {resp.text}"}

            self.invalidate_cache('orders')
            return resp.json()

        except Exception as e:
            return {"error": str(e)}

    def get_market_data_snapshot(self, conids: List[int], fields: Optional[List[str]] = None) -> Dict[str, Any]:
        """Get market data snapshot for one or more contracts"""
        try:
            params = {"conids": ",".join(map(str, conids))}
            if fields:
                params["fields"] = ",".join(fields)

            resp = self._request('get',
                f"{self.base_url}/v1/api/iserver/marketdata/snapshot",
                params=params,
                timeout=10
            )
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            return {"error": str(e)}


# Global singleton instance
ibkr_gateway_client = IBKRGatewayClient()
