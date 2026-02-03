# FDC3 Copilot

A sophisticated trading platform enhanced with AI-powered analysis, built to demonstrate agentic AI capabilities, FDC3 interoperability, and context-aware workflows.

![Status](https://img.shields.io/badge/Status-Production-brightgreen)

## 🏗️ Architecture

1.  **React Trading App** (`mock_app/static/`):
    *   Modern React-based UI with light/dark themes
    *   Features: Real-time price updates, Watchlist, Order Entry, Positions, Blotter, News Feed
    *   **Advanced**: Depth Ladder, Portfolio Beta, Risk Metrics (VaR), Context-aware News
    *   **AI Integration**: Streaming AI Assistant with suggested actions

2.  **Backend Server** (`mock_app/serve_mock.py`):
    *   Flask server serving the React app and AI analysis endpoints
    *   **Session Logging**: Automatically persists FDC3 logs to `analyst/sessions/`
    *   Supports Gemini, OpenAI, and local LLM providers

3.  **AI Analyst** (`analyst/`):
    *   Python-based workflow analyst (`workflow_analyst.py`)
    *   Analyzes FDC3 logs to provide trading insights, summaries, and compliance checks
    *   Optimized for AMD/CPU environments

4.  **Chrome Extension** (`extension/`):
    *   Side-panel companion tracking FDC3 context across applications
    *   Provides contextual suggestions based on user activity

---

## 🚀 Quick Start

### Prerequisites
*   **Python 3.10+** (Add to PATH during installation)
*   **Node.js 18+** (for frontend development only)
*   **Google Chrome** (or Edge/Brave)
*   **AI Provider** (Choose one):
    *   **Local (Free)**: [LM Studio](https://lmstudio.ai/) or `llama-server` (port `8081`)
    *   **Cloud**: Google Gemini API Key or OpenAI API Key

### Installation

1.  **Clone and Setup**
    ```bash
    git clone <repository-url>
    cd interop-ai-lab
    python -m venv .venv
    .venv\Scripts\activate  # Windows
    pip install -r analyst/requirements.txt
    ```

2.  **Configure Chrome Extension**
    *   Open Chrome → `chrome://extensions`
    *   Enable **Developer Mode**
    *   Click **Load unpacked** → select `extension/` folder
    *   Copy the extension ID
    *   Run: `python configure_host.py <EXTENSION_ID>`

3.  **Start the Application**
    ```bash
    start_stack.bat  # Windows
    ```
    Or manually:
    ```bash
    python mock_app/serve_mock.py
    ```
    Then visit **http://localhost:5500/**

---

## ✨ Key Features

### Trading Interface
*   **Live Depth Ladder**: Click any price level to instantly create limit orders
*   **Portfolio Analytics**: Net Liquidation, Portfolio Beta, Position-level VaR
*   **Smart News**: Contextual filtering based on selected instrument
*   **Theme Support**: Professional light and dark modes

### AI Assistant
*   **Streaming Responses**: Real-time AI analysis via Server-Sent Events
*   **Suggested Actions**: Interactive buttons for common queries
*   **Session Logging**: All interactions saved to `analyst/sessions/` for audit trails
*   **Context Awareness**: AI knows your current positions, orders, and selected instruments

### FDC3 Integration
*   **Context Broadcasting**: Instrument, Order, Position, Trade contexts
*   **Intent Handling**: ViewInstrument, ViewNews, ViewChart
*   **Extension Tracking**: Browser extension captures all FDC3 activity

---

## 📁 Project Structure

```
interop-ai-lab/
├── mock_app/
│   ├── static/          # Production React build
│   ├── legacy/          # Archived legacy app (reference)
│   └── serve_mock.py    # Flask backend server
├── frontend/
│   ├── src/             # React source code
│   │   ├── mock_app/    # Trading app components
│   │   └── extension/   # Extension UI components
│   └── package.json     # Frontend dependencies
├── analyst/
│   ├── workflow_analyst.py  # AI analysis engine
│   ├── sessions/        # FDC3 log storage
│   └── knowledge/       # Domain knowledge base
├── extension/           # Chrome extension
└── start_stack.bat      # Startup script
```

---

## 🛠️ Development

### Frontend Development
```bash
cd frontend
npm install
npm run dev  # Dev server on port 5173
npm run build  # Build to mock_app/static
```

### Backend Development
The Flask server auto-reloads on file changes:
```bash
python mock_app/serve_mock.py
```

---

## 🧠 How It Works

### Session Logging & RAG
1.  **Event Capture**: Chrome Extension sniffs all FDC3 broadcasts
2.  **Automatic Persistence**: Every AI query saves the current FDC3 context to `analyst/sessions/`
3.  **Context Injection**: AI receives full session state in its prompt
4.  **Historical Analysis**: Analyst can review past sessions for compliance and insights

### AI Workflow
1.  User interacts with trading app (clicks, orders, etc.)
2.  FDC3 contexts are broadcast and logged
3.  User asks AI a question
4.  Backend saves session log and sends context + query to LLM
5.  AI streams response with suggested follow-up actions

---

## ⚙️ Configuration

### AI Provider Settings
*   Click ⚙️ in the AI Assistant panel
*   **Local LLM**: Set URL to `http://localhost:8081`
*   **Gemini/OpenAI**: Select provider and paste API key
*   **Privacy**: All data processed locally, keys stored in browser

### Session Logs
*   Location: `analyst/sessions/`
*   Format: JSON files with timestamp
*   Usage: Compliance audits, historical analysis, debugging

---

## 🔗 FDC3 Resources
*   **FDC3 Standard**: [finos.org/fdc3](https://finos.org/fdc3)
*   **Context Types**: Instrument, Order, Position, Trade, Portfolio
*   **Intents**: ViewInstrument, ViewNews, ViewChart

---

*FDC3 Copilot - Production Ready - 2026*
