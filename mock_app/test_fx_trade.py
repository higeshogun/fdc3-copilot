import sys
import os

# Ensure we can import the client
sys.path.insert(0, os.path.dirname(__file__))
from ibkr_gateway_client import ibkr_gateway_client
import json

def test_fx_trade():
    print("\n--- FX TEST TRADE ---")
    print("---------------------------------")
    
    if not ibkr_gateway_client.is_available():
        print("X Gateway NOT connected or NOT authenticated.")
        print("   Please run start_stack.bat and ensure https://localhost:5000 is authenticated.")
        return

    symbol = "USD/JPY"
    side = "SELL"
    qty = 1000 
    
    print(f"Attempting to Trade: {side} {qty} {symbol} (Market Order)...")

    # 1. Check Account
    print("\n1. Fetching Account...")
    acct = ibkr_gateway_client.get_account_summary()
    if 'error' in acct:
        print(f"   Error: {acct['error']}")
        return
    print(f"   Account ID: {acct.get('account_id')}")

    # 2. Place Order
    print("\n2. Placing Order...")
    result = ibkr_gateway_client.place_order(
        symbol=symbol,
        side=side,
        quantity=qty,
        order_type="MKT"
    )

    print("\n3. Order Result:")
    print(json.dumps(result, indent=2))
    
    if 'error' in result:
        print("\n[FAILED] Trade Failed.")
    else:
        print("\n[SUCCESS] Trade Submitted Successfully!")
        print("Check your Blotter or TWS for execution details.")

if __name__ == "__main__":
    test_fx_trade()
