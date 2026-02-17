"""
IBKR Gateway Integration Test

Tests the direct connection to IBKR Client Portal Gateway.
This bypasses the broken FastMCP layer.
"""

import json
from ibkr_gateway_client import ibkr_gateway_client


def print_section(title):
    """Print a formatted section header"""
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


def test_gateway_connection():
    """Test basic gateway connectivity"""
    print_section("IBKR Gateway Connection Test")
    
    is_available = ibkr_gateway_client.is_available()
    
    if is_available:
        print("✓ IBKR Gateway is reachable at http://localhost:5000")
        return True
    else:
        print("✗ IBKR Gateway is NOT reachable")
        print("  Make sure api_gateway Docker container is running:")
        print("  cd IB_MCP && docker-compose up -d api_gateway")
        return False


def test_auth_status():
    """Test authentication status"""
    print_section("Authentication Status Test")
    
    result = ibkr_gateway_client.get_auth_status()
    
    print(f"Auth status: {json.dumps(result, indent=2)}")
    
    is_authenticated = result.get('authenticated', False)
    if is_authenticated:
        print("✓ Successfully authenticated")
        return True
    else:
        print("⚠️  Not authenticated or requires user action")
        print("  Open https://localhost:5000/ in your browser and complete login")
        return False


def test_get_accounts():
    """Test getting account list"""
    print_section("Accounts Test")
    
    accounts = ibkr_gateway_client.get_accounts()
    
    if accounts:
        print(f"✓ Found {len(accounts)} account(s):")
        for acc in accounts:
            print(f"   - {acc}")
        return True
    else:
        print("✗ No accounts found")
        return False


def test_get_positions():
    """Test getting portfolio positions"""
    print_section("Portfolio Positions Test")
    
    result = ibkr_gateway_client.get_positions()
    
    if 'error' in result:
        print(f"✗ Error: {result['error']}")
        return False
    
    print("✓ Successfully retrieved positions")
    print(json.dumps(result, indent=2))
    return True


def test_get_account_summary():
    """Test getting account summary"""
    print_section("Account Summary Test")
    
    result = ibkr_gateway_client.get_account_summary()
    
    if 'error' in result:
        print(f"✗ Error: {result['error']}")
        return False
    
    print("✓ Successfully retrieved account summary")
    print(json.dumps(result, indent=2))
    return True


def test_get_orders():
    """Test getting current orders"""
    print_section("Current Orders Test")
    
    result = ibkr_gateway_client.get_orders()
    
    if 'error' in result:
        print(f"✗ Error: {result['error']}")
        return False
    
    print("✓ Successfully retrieved orders")
    print(json.dumps(result, indent=2))
    return True


def test_search_contract():
    """Test contract search"""
    print_section("Contract Search Test")
    
    test_symbol = "AAPL"
    print(f"Searching for symbol: {test_symbol}")
    
    result = ibkr_gateway_client.search_contract(test_symbol)
    
    if 'error' in result:
        print(f"✗ Error: {result['error']}")
        return False
    
    print(f"✓ Successfully searched for {test_symbol}")
    print(json.dumps(result, indent=2))
    return True


def main():
    """Run all IBKR Gateway integration tests"""
    print("\n" + "="*60)
    print("  IBKR Gateway Integration Diagnostic Report")
    print("="*60)
    print("\nThis script tests the direct connection to IBKR Client")
    print("Portal Gateway, bypassing the broken FastMCP layer.")
    
    results = {
        "Gateway Connection": test_gateway_connection(),
    }
    
    # Only run other tests if connection succeeds
    if results["Gateway Connection"]:
        results["Authentication"] = test_auth_status()
        results["Get Accounts"] = test_get_accounts()
        results["Get Positions"] = test_get_positions()
        results["Get Account Summary"] = test_get_account_summary()
        results["Get Orders"] = test_get_orders()
        results["Search Contract"] = test_search_contract()
    
    # Print summary
    print_section("Test Summary")
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, passed_test in results.items():
        status = "✓ PASS" if passed_test else "✗ FAIL"
        print(f"{status} - {test_name}")
    
    print(f"\nPassed: {passed}/{total} tests")
    
    if passed == total:
        print("\n🎉 All tests passed! IBKR Gateway integration is working.")
        return 0
    elif passed > 0:
        print("\n⚠️  Some tests passed. Check details above.")
        return 0
    else:
        print("\n⚠️  All tests failed. Check the errors above for details.")
        return 1


if __name__ == "__main__":
    import sys
    sys.exit(main())
