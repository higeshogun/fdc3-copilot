from mock_app.ibkr_gateway_client import ibkr_gateway_client
import json

def test_search(symbol):
    print(f"\n--- Searching for {symbol} ---")
    res = ibkr_gateway_client.search_contract(symbol)
    print(json.dumps(res, indent=2))

if __name__ == "__main__":
    if ibkr_gateway_client.is_available():
        test_search("USD")
    else:
        print("IBKR Gateway not available")
