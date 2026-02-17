# Patch for ibkr_gateway_client.py to add advanced order support
# This code should replace lines 414-421

# Add price fields based on order type
if order_type in ["LMT", "STOP_LIMIT", "TRAILLMT"]:
    if limit_price is None:
        return {"error": f"Limit price required for {order_type} orders"}
    order["price"] = limit_price

# Add aux price for STOP_LIMIT and TRAILLMT
if order_type in ["STP", "STOP_LIMIT", "TRAILLMT"]:
    if aux_price is None:
        return {"error": f"Stop price (aux_price) required for {order_type} orders"}
    order["auxPrice"] = aux_price

# Add trailing fields for TRAIL and TRAILLMT
if order_type in ["TRAIL", "TRAILLMT"]:
    if trailing_amt is None or trailing_type is None:
        return {"error": f"Trailing amount and type required for {order_type} orders"}
    order["trailingAmt"] = trailing_amt
    order["trailingType"] = trailing_type

# Add all or none flag
if all_or_none is not None:
    order["allOrNone"] = bool(all_or_none)

# Add outside RTH flag  
if outside_rth is not None:
    order["outsideRTH"] = bool(outside_rth)
