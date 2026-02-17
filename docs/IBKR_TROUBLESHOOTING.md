# IBKR Connectivity Troubleshooting

## 1. Gateway Status Indicator is "OFFLINE"

### Cause: Backend Stale or Gateway Not Running (or Wrong Port)
If the "IBKR GATEWAY" indicator in the top right is RED (Offline):

1.  **Check the Backend Server**:
    The UI relies on the Python backend (`serve_mock.py`) to check the gateway status.
    Ensure "serve_mock.py" is running.

2.  **Check the Gateway Process**:
    Ensure the **IBKR Client Portal Gateway** (not just TWS!) is running.
    - Our app uses the REST API, which runs on port `5000` (default).
    - You must run the **Client Portal Web API Gateway** (Java runtime), distinct from the standard TWS desktop app.
    - You should be able to visit `https://localhost:5000` in your browser.
    - If it's not running, download and run the CP Gateway.

### IMPORTANT: TWS vs Client Portal Gateway
- **TWS (Trader Workstation)**: Uses a socket API (port 7496). This is NOT what we use for fetching account/order data via REST.
- **Client Portal Gateway**: Uses a REST API (port 5000). **This is required.**
    - Download: [IBKR CP Web API](https://interactivebrokers.github.io/cpwebapi/)
    - Run: `bin\run.bat root`


## 2. "Active" but Data is Missing or Zeros

### Cause: Not Authenticated
If the indicator is GREEN (Active) but Account Balance is $0 or errors appear:

1.  **Re-authenticate**:
    - Go to **[https://localhost:5000/](https://localhost:5000/)** in your browser.
    - You may see a "Your connection is not private" warning (because it uses a self-signed certificate). Click "Advanced" -> "Proceed".
    - Login with your IBKR credentials.
    - Once you see "Client login succeeds", the widget should update automatically within 30 seconds.

## 3. "System Failure" or Connection Refused

- Ensure you are running the **Client Portal Gateway** component.

## 4. "Session Replaced" / Disconnections

### Cause: Concurrent Login Conflict
**You cannot run TWS (Trader Workstation) and the API Gateway simultaneously with the same username.**

Interactive Brokers enforces a STRICT **one active session per user** policy.
- If you log into TWS, it will disconnect your Gateway session.
- If you log into the Gateway, it will disconnect your TWS session.

### Solutions:
1.  **Use Only Gateway**: Close TWS and rely on our app + Gateway for all trading.
2.  **Second Username (Recommended)**:
    - Log into IBKR Website -> **Settings** -> **User Settings**.
    - Create a second username (Linked User) for your account.
    - Use User A for TWS and User B for the Gateway (API).
3.  **Paper Trading**: Use your Live account for TWS and Paper Trading account for the Gateway (if they have distinct logins, though typically they share the main login).
