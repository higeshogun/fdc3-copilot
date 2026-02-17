"""
MCP Integration Test Script

Tests the connection to IB_MCP server and verifies available trading tools.
Run this script to diagnose MCP connectivity issues and verify IBKR integration.

Usage:
    python mock_app/test_mcp_integration.py
"""

import json
import sys
from mcp_client import mcp_client


def print_section(title):
    """Print a formatted section header"""
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


def test_mcp_connection():
    """Test basic MCP server connectivity"""
    print_section("MCP Server Connection Test")
    
    is_available = mcp_client.is_available()
    
    if is_available:
        print("✓ MCP server is reachable at http://localhost:5002/mcp/")
        return True
    else:
        print("✗ MCP server is NOT reachable")
        print("  Make sure IB_MCP Docker container is running:")
        print("  cd IB_MCP && docker-compose up -d")
        return False


def test_list_tools():
    """List all available MCP tools"""
    print_section("Available MCP Tools")
    
    tools = mcp_client.list_tools()
    
    if not tools:
        print("✗ No tools returned from MCP server")
        return False
    
    print(f"✓ Found {len(tools)} MCP tools:\n")
    
    for i, tool in enumerate(tools, 1):
        name = tool.get('name', 'Unknown')
        description = tool.get('description', 'No description')
        print(f"{i}. {name}")
        print(f"   {description}")
        
        # Show parameters if available
        if 'inputSchema' in tool:
            params = tool['inputSchema'].get('properties', {})
            if params:
                print(f"   Parameters: {', '.join(params.keys())}")
        print()
    
    return True


def test_get_positions():
    """Test getting portfolio positions"""
    print_section("Portfolio Positions Test")
    
    result = mcp_client.get_positions()
    
    if 'error' in result:
        print(f"✗ Error: {result['error']}")
        return False
    
    print("✓ Successfully retrieved positions")
    print(json.dumps(result, indent=2))
    return True


def test_get_account_summary():
    """Test getting account summary"""
    print_section("Account Summary Test")
    
    result = mcp_client.get_account_summary()
    
    if 'error' in result:
        print(f"✗ Error: {result['error']}")
        return False
    
    print("✓ Successfully retrieved account summary")
    print(json.dumps(result, indent=2))
    return True


def test_get_orders():
    """Test getting current orders"""
    print_section("Current Orders Test")
    
    result = mcp_client.get_orders()
    
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
    
    result = mcp_client.search_contract(test_symbol)
    
    if 'error' in result:
        print(f"✗ Error: {result['error']}")
        return False
    
    print(f"✓ Successfully searched for {test_symbol}")
    print(json.dumps(result, indent=2))
    return True


def main():
    """Run all MCP integration tests"""
    print("\n" + "="*60)
    print("  MCP Integration Diagnostic Report")
    print("="*60)
    print("\nThis script tests the connection between the Interop Trader")
    print("and the IB_MCP server for Interactive Brokers integration.")
    
    results = {
        "Connection": test_mcp_connection(),
    }
    
    # Only run other tests if connection succeeds
    if results["Connection"]:
        results["List Tools"] = test_list_tools()
        results["Get Positions"] = test_get_positions()
        results["Get Account"] = test_get_account_summary()
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
        print("\n🎉 All tests passed! MCP integration is working correctly.")
        return 0
    else:
        print("\n⚠️  Some tests failed. Check the errors above for details.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
