# FDC3 Copilot

A sophisticated mock trading platform enhanced with an AI Assistant, built to demonstrate agentic AI capabilities, FDC3 interoperability, and context-aware workflows.

## Components

1.  **Mock OMS App** (`mock_app/`):
    *   A simulated Order Management System.
    *   Features: Real-time price updates (simulated), Watchlist, Order Entry, Blotter, News Feed.
    *   **New**: Context-aware News, Settlement Date tracking (T+2), AI Integration.

2.  **AI Analyst Backend** (`analyst/`):
    *   Python-based server (`workflow_analyst.py`) interfacing with LLMs (e.g., `llama.cpp` or OpenAI).
    *   Analyzes FDC3 logs to provide trading insights, summary, and compliance checks.
    *   Optimized for AMD/CPU environments (Torch dependency removed).

3.  **Chrome Extension** (`extension/`):
    *   A side-panel companion that tracks user context (FDC3) across the productivity suite.
    *   Provides "Contextual Suggestions" (Chips) based on user activity.

## setup & Run

### Prerequisites
- Python 3.10+
- `numpy` (for backend)
- `llama-server` (running on port 8081 for AI features)

### Installation
1.  **Mock App**:
    *   Open `mock_app/index.html` in a browser or serve with Live Server (`port 5500`).

2.  **Backend**:
    *   Install requirements: `pip install -r requirements.txt` (create if missing, mainly `requests`, `openai`).
    *   Run default startup: `start_lab.bat`.

3.  **Extension**:
    *   Load unpacked extension in Chrome from `extension/` directory.

## Key Features
- **Context Awareness**: The AI knows what stock you are looking at.
- **Smart Suggestions**: Suggests relevant actions (e.g., "Analyze Risk") based on your context.
- **News Filtering**: Filter news by the active instrument.
- **Settlement Logic**: Automatic holiday-aware T+2 settlement dates.

## Configuration
- **LLM**: Defaults to `http://localhost:8081`. Configure via the UI Settings icon.
- **API Keys**: Stored locally in browser/extension storage. Never hardcoded.

---
*Generated for GitHub Release*
