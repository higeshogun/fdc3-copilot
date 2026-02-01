# FDC3 Copilot

A sophisticated mock trading platform enhanced with an AI Assistant, built to demonstrate agentic AI capabilities, FDC3 interoperability, and context-aware workflows.

![Trailer](https://img.shields.io/badge/Status-Released-brightgreen)

## 🏗️ Components

1.  **Mock OMS App** (`mock_app/`):
    *   Features: Real-time price updates (simulated), Watchlist, Order Entry, Blotter, News Feed.
    *   **New**: Context-aware News, Settlement Date tracking (T+2), AI Integration.

2.  **AI Analyst Backend** (`analyst/`):
    *   Python-based server (`workflow_analyst.py`) interfacing with Local LLMs (via `llama.cpp` or OpenAI).
    *   Analyzes FDC3 logs to provide trading insights, summary, and compliance checks.
    *   Optimized for AMD/CPU environments.

3.  **Chrome Extension** (`extension/`):
    *   A side-panel companion that tracks user context (FDC3) across the productivity suite.
    *   Provides "Contextual Suggestions" (Chips) based on user activity.

---

## 🚀 Easy Setup Guide

### 1. Prerequisites
*   **Python 3.10+** (Make sure to check "Add Python to PATH" during install)
*   **Google Chrome** (or Edge/Brave)
*   **Local LLM** (Optional but recommended): Install [LM Studio](https://lmstudio.ai/) or `llama-server` and run a server on port **8081**.

### 2. Configure the Extension
This enables the Native Messaging connection between Chrome and Python.

1.  Open Chrome and go to `chrome://extensions`.
2.  Enable **Developer Mode** (top right).
3.  Click **Load unpacked** and select the `extension/` folder in this repo.
4.  Copy the **ID** of the newly loaded extension (e.g., `abc...xyz`).
5.  In your terminal, run the setup script:
    ```bash
    python configure_host.py <YOUR_EXTENSION_ID>
    ```
    *Example: `python configure_host.py nodaoclodcflmbjknlmochcicdkjndbk`*

### 3. Start the Backend
1.  Open a terminal in the project root.
2.  Run the startup script:
    *   **Windows**: `.\start_lab.bat`
    *   **Mac/Linux**: `python analyst/workflow_analyst.py`
3.  You should see "✅ LLM Server Online" (or a warning if no LLM is found, which is fine for testing the UI).

### 4. Run the App
1.  Open `mock_app/index.html` directly in your browser.
2.  **Or** (Recommended) use a simple HTTP server:
    ```bash
    cd mock_app
    python -m http.server 5500
    ```
    Then visit `http://localhost:5500`.

---

## ✨ Key Features to Try
*   **Context Awareness**: Click "AAPL" in the Watchlist -> The AI Panel knows you are looking at Apple.
*   **Smart Suggestions**: Click the suggested chips (e.g., "Summarize activity") to get instant analysis.
*   **News Filtering**: In the News Panel, toggle `[x] FILTER` to see only news relevant to your active stock.
*   **Settlement Logic**: Trades placed now will automatically calculate T+2 settlement dates (skipping weekends/holidays).

## ⚙️ Configuration
*   **Change LLM**: Click the ⚙️ Settings icon in the Web App or Extension to point to OpenAI or a different Local URL.
*   **Privacy**: All logs are processed locally. No data leaves your machine unless you configure an external API.

---
*FDC3 Copilot - 2026*
