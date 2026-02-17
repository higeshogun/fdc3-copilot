# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FDC3 Copilot — an AI-enhanced trading platform demonstrating agentic AI capabilities and FDC3 interoperability. React frontend served by a Flask backend, with optional IBKR brokerage integration and multi-provider LLM analysis.

## Build & Run Commands

### Frontend (from `frontend/`)

```bash
npm install              # install dependencies
npm run dev              # Vite dev server on port 5173
npm run build            # TypeScript check + Vite build → output to mock_app/static/
npm run lint             # ESLint
npm run preview          # preview production build
```

### Backend (from repo root)

```bash
# 1. Create and activate virtual environment
python -m venv .venv
.venv\Scripts\activate

# 2. Install dependencies (including flask, requests, etc.)
pip install -r analyst/requirements.txt

# 3. Run server (ensure venv python is used)
python mock_app/serve_mock.py
```

### Full Stack (Windows)

```bash
start_stack.bat          # Launches Flask backend (5500) + analyst layer in parallel, opens browser
```

### Analyst Standalone

```bash
python analyst/workflow_analyst.py --model mistral --url http://localhost:8081
```

## Architecture

```
Browser (localhost:5500)
├── React App (Vite build served by Flask)
│   ├── Widgets (13+ trading components in mock_app/widgets/)
│   ├── FloatingChat (AI assistant with streaming)
│   └── Zustand stores (simulation state + IBKR market data)
│
Flask Backend (mock_app/serve_mock.py)
├── /ibkr/*           IBKR Gateway proxy (REST + WebSocket relay → SSE)
├── /mcp/*            MCP protocol (orders, positions, accounts, tool discovery)
├── /analyze          LLM streaming analysis (Gemini, OpenAI, or local)
├── /models           LLM connectivity test
└── Static file serving (mock_app/static/)

Analyst Engine (analyst/workflow_analyst.py)
├── RAG pipeline: LangChain + FAISS over session logs + knowledge base
├── Knowledge: analyst/knowledge/ (FDC3 specs, trading domain)
└── Session logs: analyst/sessions/ (auto-persisted JSON)

Chrome Extension (extension/)
├── Manifest V3 side-panel companion
├── FDC3 context detection + polyfill injection
└── Native messaging to IBKR gateway client
```

### Key data flow

1. **Market data**: IBKR Gateway (port 5000) → Flask WebSocket client → SSE `/ibkr/stream` → React `useIBKRMarketData` store → widget re-renders
2. **Order submission**: React form → POST `/mcp/place_order` → Flask → IBKR REST API; optimistic UI update with rollback on failure
3. **AI analysis**: FloatingChat collects FDC3 logs + portfolio snapshot → POST `/analyze` → Flask streams LLM response via SSE → parses "Suggested Actions" from response
4. **FDC3 broadcasting**: All user actions (select instrument, submit order, etc.) call `window.fdc3.broadcast()` and append to the FDC3 log store (max 50 entries)

## Key Source Locations

| Area | Path | Notes |
|------|------|-------|
| Trading widgets | `frontend/src/mock_app/widgets/` | Each widget is a self-contained React component |
| Core state | `frontend/src/mock_app/store/useSimulationStore.ts` | Zustand store: instruments, positions, orders, trades, FDC3 logs, AI config. Persists `aiConfig` + `theme` to localStorage |
| Market data hook | `frontend/src/mock_app/store/useIBKRMarketData.ts` | SSE connection to `/ibkr/stream`, parses IBKR data format |
| MCP client | `frontend/src/mock_app/services/MCPClient.ts` | Custom `BrowserSSETransport` (no Node.js polyfills) over JSON-RPC 2.0 |
| API config | `frontend/src/mock_app/config.ts` | `API_BASE_URL`: localhost:5500 in dev, `window.location.origin` in prod |
| Shared layout | `frontend/src/shared/components/DraggableGrid.tsx` | React Grid Layout wrapper for widget drag/resize |
| Flask server | `mock_app/serve_mock.py` | ~1500 lines: all backend routes, IBKR WebSocket relay, MCP server, LLM streaming |
| IBKR client | `mock_app/ibkr_gateway_client.py` | REST wrapper for IBKR Client Portal Gateway API |
| AI analyst | `analyst/workflow_analyst.py` | RAG pipeline, multi-provider LLM, session log analysis |
| Knowledge base | `analyst/knowledge/` | `fdc3_specs.md`, `trading_domain.md` — injected into RAG context |
| Extension | `extension/` | Manifest V3: `background.js`, `bridge.js` (content script), `injector.js` (FDC3 polyfill), `sidepanel.js` |

## Tech Stack

- **Frontend**: React 19, TypeScript 5.9, Vite 7, Zustand 5, Tailwind CSS 4, Recharts, Lucide icons
- **Backend**: Flask (Python 3.10+), CORS, SSE streaming
- **AI/RAG**: LangChain, FAISS-CPU, Sentence-Transformers, supports Ollama/LM Studio (port 8081), Gemini, OpenAI
- **MCP**: `@modelcontextprotocol/sdk` on frontend, custom Flask MCP server on backend
- **Build**: Vite builds two entry points (`mock_app.html`, `extension.html`) into `mock_app/static/`

## Important Patterns

- **Vite output directory**: `npm run build` outputs to `mock_app/static/` (not `frontend/dist/`). Flask serves from there.
- **Dual entry points**: Vite config has two inputs — `mock_app.html` (main trading app) and `extension.html` (Chrome extension UI). Both build to the same output dir.
- **MCP over HTTP**: The MCP protocol uses SSE for endpoint discovery (`GET /mcp/sse`) then JSON-RPC 2.0 messages via `POST /mcp/messages`. The frontend uses a custom `BrowserSSETransport` class instead of the SDK's default Node.js transport.
- **FDC3 log-driven AI**: The AI assistant receives the latest 50 FDC3 broadcast logs plus a portfolio snapshot as context with every query. Session logs are auto-saved to `analyst/sessions/` as timestamped JSON files.
- **IBKR Gateway dependency**: Live market data and real order execution require IBKR Client Portal Gateway running on port 5000 with valid authentication. The app works without it (simulated data mode).

## Testing

There is no formal test suite. Test files in the repo root (`test_ibkr_ws.py`, `test_mcp_integration.py`, etc.) are exploratory/debug scripts for manual verification.
