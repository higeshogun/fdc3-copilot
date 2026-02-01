# Institutional Trading Domain Knowledge

## Asset Classes

### 1. Equities (Stocks)
- **Definition**: Shares representing ownership in a corporation.
- **Key Concepts**:
  - **Ticker**: Unique symbol (e.g., AAPL, MSFT, 7203.T).
  - **Venues**: Primary Exchanges (NYSE, Nasdaq, LSE) vs. MTFs/Dark Pools.
  - **Block Trade**: A large order (often >10k shares) arranged privately to minimize market impact.

### 2. Fixed Income (Bonds)
- **Definition**: Debt securities where an issuer owes the holder a debt and pays interest (coupons).
- **Key Types**:
  - **Government**: Treasuries (US), Gilts (UK), Bunds (DE). Low risk.
  - **Corporate**: Issued by companies. Credit spread risk is key.
  - **High Yield**: Lower credit rating, higher spread.
- **Trading Conventions**:
  - Typically traded OTC (Over-the-Counter).
  - Quotes in **Yield** (YTM) or **Price** (% of par).

### 3. Foreign Exchange (FX)
- **Definition**: Trading of currencies in pairs (e.g., EUR/USD).
- **Key Instruments**:
  - **Spot**: Immediate delivery (usually T+2).
  - **Forward**: Exchange at a fast future date.
  - **Swap**: Simultaneous purchase and sale of identical amounts of one currency for another with two different value dates.
- **Conventions**:
  - **Base/Quote**: In EUR/USD (1.1000), EUR is base, USD is quote. You buy Base, sell Quote.

## Order Management

### Order Lifecycle
1.  **New**: Order created but not yet sent to venue.
2.  **Open/Working**: Accepted by venue, waiting for a fill.
3.  **Partially Filled**: Some quantity executed, remainder still working.
4.  **Filled**: Fully executed.
5.  **Canceled**: Withdrawn by trader.
6.  **Rejected**: Denied by venue or risk check.

### Order Types
- **Market**: Buy/Sell immediately at best available current price.
- **Limit**: Buy/Sell at a specific price or better.
- **Stop**: Trigger a Market order when a price level is breached.
- **Stop Limit**: Trigger a Limit order when a price level is breached.
- **Iceberg**: Display only a portion of the total size to hide intent.

### Execution Strategies (Algos)
- **VWAP (Volume Weighted Average Price)**: Execute over time to match the volume profile of the stock.
- **TWAP (Time Weighted Average Price)**: Execute evenly over a specified time period.
- **POV (Percentage of Volume)**: Participate as a % of real-time market volume.
- **Implementation Shortfall**: Minimize slippage from the arrival price.

## Trading Workflow Context (OMS/EMS)
- **OMS (Order Management System)**: High-level handling of orders, compliance, position keeping.
- **EMS (Execution Management System)**: Low-level connectivity to venues, algos, and fast routing.
- **DESK**: Refers to the trading desk (e.g., "Equity Desk", "High Touch").
