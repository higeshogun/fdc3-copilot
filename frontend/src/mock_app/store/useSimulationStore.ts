
import { create } from 'zustand';
import { API_BASE_URL } from '../config';
import { persist } from 'zustand/middleware';

// Types
export interface Instrument {
    symbol: string;
    name: string;
    last: number;
    bid: number;
    ask: number;
    chg: number;
    type: 'EQUITY' | 'FX' | 'RATES';
}

export interface Position {
    symbol: string;
    long: number;
    short: number;
    cost: number;
    settleDate?: string;
}

export interface Order {
    id: string;
    time: string;
    side: 'BUY' | 'SELL';
    symbol: string;
    qty: number;
    price: number;
    type: string;
    expiry?: 'DAY' | 'IOC' | 'GTC' | 'GTD';
    status: 'NEW' | 'PARTIAL' | 'FILLED' | 'CANCELLED';
    avgPx: number;
    cumQty: number;
    settleDate: string;
    // Advanced order fields
    auxPrice?: number; // Stop price for STOP_LIMIT, TRAILLMT
    trailingAmt?: number; // Trailing amount for TRAIL, TRAILLMT
    trailingType?: 'amt' | '%'; // Trailing type: amount or percentage
    allOrNone?: boolean; // Execute entire order at once or allow partial fills
    outsideRTH?: boolean; // Allow execution outside regular trading hours
}

export interface Trade {
    execId: string;
    orderId: string;
    time: string;
    side: 'BUY' | 'SELL';
    symbol: string;
    qty: number;
    price: number;
    cpty: string;
    settleDate: string;
}

export interface Fdc3Log {
    origin: 'APP' | 'FDC3';
    type: string;
    data: unknown;
    timestamp: number;
}

export interface Toast {
    id: string;
    message: string;
    type: 'success' | 'info' | 'warning' | 'error';
    timestamp: number;
}

export interface AiConfig {
    provider: 'gemini' | 'openai' | 'local';
    url: string;
    key: string;
    model: string;
    temp: number;
    prompt: string;
    start: string;
    end: string;
}

export interface McpTrade {
    id: string;
    timestamp: number;
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    orderType: string;
    limitPrice?: number;
    status: 'pending' | 'executed' | 'cancelled' | 'failed';
    result?: unknown;
}

interface SimulationState {
    instruments: Record<string, Instrument>;
    positions: Record<string, Position>;
    orders: Order[];
    trades: Trade[];
    selectedSymbol: string;
    fdc3Logs: Fdc3Log[];
    toasts: Toast[];
    aiConfig: AiConfig;
    theme: 'dark' | 'light';
    ibkrSymbols: Set<string>; // Symbols receiving live IBKR data
    mcpTrades: McpTrade[]; // Trades executed via MCP/IBKR
    connectionStatus: {
        marketData: boolean;
        gateway: boolean;
    };

    // Actions
    toggleTheme: () => void;
    selectSymbol: (symbol: string) => void;
    submitOrder: (order: Omit<Order, 'id' | 'time' | 'status' | 'avgPx' | 'cumQty' | 'settleDate'>) => void;
    simulateMarketData: () => void;
    addLog: (log: Omit<Fdc3Log, 'timestamp'>) => void;
    addToast: (message: string, type: Toast['type']) => void;
    removeToast: (id: string) => void;
    updateAiConfig: (config: Partial<AiConfig>) => void;
    clearLogs: () => void;
    broadcastSnapshot: () => Promise<void>;
    selectTrade: (trade: Trade) => void;
    selectContact: (name: string) => void;
    flattenPosition: (symbol: string) => void;
    updateInstrumentFromIBKR: (symbol: string, data: { last: number; bid: number | null; ask: number | null; chg?: number | null }) => void;
    addMcpTrade: (trade: Omit<McpTrade, 'id' | 'timestamp'>) => void;
    updateMcpTrade: (id: string, updates: Partial<McpTrade>) => void;
    cancelOrder: (orderId: string) => Promise<void>;
    modifyOrder: (orderId: string, updates: Record<string, unknown>) => Promise<void>;
    fetchStatus: () => Promise<void>;
    addInstrument: (symbol: string, assetClass?: string) => Promise<void>;
    removeInstrument: (symbol: string) => void;
    reorderInstruments: (newOrder: string[]) => void;

    // MCP Mode
    mcpMode: boolean;
    toggleMcpMode: () => void;
}

// Helper: Ticker Precision
export const getTickerPrecision = (symbol: string) => {
    if (symbol.includes('/')) return 4;
    if (symbol.startsWith('US')) return 3;
    return 2;
};

// Helper: Settlement
const calculateSettlement = () => {
    const date = new Date();
    date.setDate(date.getDate() + 2); // Simple T+2
    return date.toISOString().split('T')[0];
};

const initialInstruments: Record<string, Instrument> = {
    'AAPL': { symbol: 'AAPL', name: 'Apple Inc.', last: 189.45, bid: 189.41, ask: 189.49, chg: 1.24, type: 'EQUITY' },
    'MSFT': { symbol: 'MSFT', name: 'Microsoft Corp.', last: 420.55, bid: 420.50, ask: 420.60, chg: 0.85, type: 'EQUITY' },
    'NVDA': { symbol: 'NVDA', name: 'Nvidia Corp.', last: 950.02, bid: 949.90, ask: 950.14, chg: -0.32, type: 'EQUITY' },
    'TSLA': { symbol: 'TSLA', name: 'Tesla Inc.', last: 175.30, bid: 175.25, ask: 175.35, chg: -1.50, type: 'EQUITY' },
    'EUR/USD': { symbol: 'EUR/USD', name: 'Euro / US Dollar', last: 1.0850, bid: 1.0849, ask: 1.0851, chg: 0.18, type: 'FX' },
    'GBP/USD': { symbol: 'GBP/USD', name: 'British Pound', last: 1.2640, bid: 1.2639, ask: 1.2641, chg: 0.22, type: 'FX' },
    'USD/JPY': { symbol: 'USD/JPY', name: 'US Dollar / Japanese Yen', last: 154.50, bid: 154.48, ask: 154.52, chg: 0.15, type: 'FX' },
};

// Reference prices for calculating change percentage (simulates previous close)
const referencePrices: Record<string, number> = {
    'AAPL': 187.13,
    'MSFT': 417.00,
    'NVDA': 953.07,
    'TSLA': 177.97,
    'EUR/USD': 1.0830,
    'GBP/USD': 1.2612,
    'USD/JPY': 154.27,
};

const initialPositions: Record<string, Position> = {};

let orderIdCounter = 1001;

export const useSimulationStore = create<SimulationState>()(
    persist(
        (set, get) => ({
            instruments: initialInstruments,
            positions: initialPositions,
            orders: [],
            trades: [],
            selectedSymbol: 'AAPL',
            fdc3Logs: [],
            toasts: [],
            ibkrSymbols: new Set<string>(),
            mcpTrades: [],
            aiConfig: {
                provider: 'local',
                url: 'https://myllm.kumatech.net',
                key: '',
                model: 'gemini-1.5-flash',
                temp: 0.7,
                prompt: "You are a senior trading desk AI assistant integrated into a live brokerage platform connected to Interactive Brokers (IBKR).\n\nYOUR CAPABILITIES:\n- Query real-time positions, orders, and account data via IBKR tools\n- Place, modify, and cancel orders (with user confirmation)\n- Analyze market activity, P&L, risk exposure, and portfolio composition\n- Interpret the FDC3 activity log showing recent user actions (symbol selections, order submissions, trades)\n\nCONTEXT YOU RECEIVE:\n- FDC3 logs: A chronological feed of user interactions — instrument selections, order events, and periodic portfolio.summary snapshots (symbol, qty, avgCost). These reflect UI activity, not necessarily current holdings.\n- When IBKR tools are available, ALWAYS call them for live data. Never guess positions, orders, or balances.\n\nRESPONSE STYLE:\n- Be concise, data-driven, and professional. Lead with the answer, then provide context.\n- Use tables or bullet points for multi-row data (positions, orders).\n- Include relevant numbers (P&L, quantities, prices) — avoid vague summaries.\n- When suggesting trades, state the rationale and risk clearly.\n- If data is unavailable or a tool call fails, say so explicitly rather than fabricating data.",
                start: '',
                end: ''
            },
            theme: 'dark',
            connectionStatus: {
                marketData: false,
                gateway: false
            },
            mcpMode: false,

            toggleTheme: () => set(state => ({
                theme: state.theme === 'dark' ? 'light' : 'dark'
            })),

            toggleMcpMode: () => set(state => ({
                mcpMode: !state.mcpMode
            })),

            addLog: (log) => set(state => ({
                fdc3Logs: [{ ...log, timestamp: Date.now() }, ...state.fdc3Logs].slice(0, 50)
            })),

            addToast: (message, type) => {
                const id = Math.random().toString(36).substring(7);
                set(state => ({ toasts: [...state.toasts, { id, message, type, timestamp: Date.now() }] }));
                setTimeout(() => get().removeToast(id), 5000);
            },

            removeToast: (id) => set(state => ({ toasts: state.toasts.filter(t => t.id !== id) })),

            updateAiConfig: (config) => set(state => ({ aiConfig: { ...state.aiConfig, ...config } })),

            clearLogs: () => set({ fdc3Logs: [] }),

            selectSymbol: (symbol) => {
                set({ selectedSymbol: symbol });
                const context = {
                    type: 'fdc3.instrument',
                    id: { ticker: symbol },
                    name: initialInstruments[symbol]?.name || symbol
                };
                get().addLog({ origin: 'APP', type: 'fdc3.instrument', data: context });
                if (window.fdc3) {
                    window.fdc3.broadcast(context);
                }
            },

            submitOrder: async (orderValues) => {
                const { side, symbol, qty, type, price } = orderValues;
                console.log("[App] Submitting Order:", orderValues);

                // Validation
                if (type === 'LIMIT' && (!price || isNaN(price))) {
                    get().addToast(`❌ Invalid Price: ${price}`, 'error');
                    return;
                }
                if (!qty || isNaN(qty) || qty <= 0) {
                    get().addToast(`❌ Invalid Quantity: ${qty}`, 'error');
                    return;
                }

                // Removed blocking window.confirm for now to debug "nothing happens" issue
                // const confirmed = window.confirm(...);
                // if (!confirmed) return;

                const id = `ORD-${orderIdCounter++}`;
                const time = new Date().toLocaleTimeString();

                // Optimistically add to local store for immediate feedback (marked as PENDING)
                const newOrder: Order = {
                    ...orderValues,
                    id,
                    time,
                    status: 'NEW',
                    avgPx: 0,
                    cumQty: 0,
                    settleDate: calculateSettlement()
                };
                set(state => ({ orders: [newOrder, ...state.orders] }));

                try {
                    get().addToast(`Submitting IBKR Order...`, 'info');

                    const response = await fetch(`${API_BASE_URL}/mcp/place_order`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            symbol,
                            side,
                            quantity: qty,
                            type: type,
                            price: price || 0, // Ensure not null/NaN if market
                            auxPrice: orderValues.auxPrice,
                            trailingAmt: orderValues.trailingAmt,
                            trailingType: orderValues.trailingType,
                            allOrNone: orderValues.allOrNone,
                            outsideRTH: orderValues.outsideRTH
                        })
                    });

                    const result = await response.json();
                    console.log("[App] Backend Response:", result);

                    if (response.ok && !result.error) {
                        get().addToast(`✅ IBKR Order Placed: ${result.order_id || 'Submitted'}`, 'success');

                        // Log the order submission event (user action, not data dump)
                        get().addLog({
                            origin: 'APP',
                            type: 'order.submitted',
                            data: {
                                orderId: result.order_id,
                                symbol,
                                side,
                                qty,
                                type,
                                price: type === 'LIMIT' ? price : 'MKT'
                            }
                        });

                        // Refresh snapshot for FDC3 broadcast (without logging)
                        await get().broadcastSnapshot();
                    } else {
                        throw new Error(result.error || 'Unknown error');
                    }
                } catch (err) {
                    console.error("IBKR Order Placement Failed", err);
                    get().addToast(`❌ Order Failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
                    // Mark as cancelled in local store
                    set(state => ({
                        orders: state.orders.map(o => o.id === id ? { ...o, status: 'CANCELLED' } : o)
                    }));
                }
            },

            cancelOrder: async (orderId) => {
                try {
                    get().addToast(`Cancelling Order ${orderId}...`, 'info');
                    const response = await fetch(`${API_BASE_URL}/mcp/cancel_order`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ order_id: orderId })
                    });
                    const result = await response.json();
                    if (response.ok && !result.error) {
                        get().addToast(`✅ Order Cancellation Submitted: ${orderId}`, 'success');
                    } else {
                        throw new Error(result.error || 'Unknown error');
                    }
                } catch (err) {
                    console.error("Cancel Failed", err);
                    get().addToast(`❌ Cancel Failed: ${err}`, 'error');
                }
            },

            modifyOrder: async (orderId, updates) => {
                try {
                    get().addToast(`Modifying Order ${orderId}...`, 'info');
                    const response = await fetch(`${API_BASE_URL}/mcp/modify_order`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            order_id: orderId,
                            ...updates
                        })
                    });
                    const result = await response.json();
                    if (response.ok && !result.error) {
                        get().addToast(`✅ Order Modification Submitted: ${orderId}`, 'success');
                    } else {
                        throw new Error(result.error || 'Unknown error');
                    }
                } catch (err) {
                    console.error("Modify Failed", err);
                    get().addToast(`❌ Modify Failed: ${err}`, 'error');
                }
            },

            simulateMarketData: () => {
                set(state => {
                    const newInstruments = { ...state.instruments };
                    let changed = false;
                    Object.keys(newInstruments).forEach(key => {
                        // Skip symbols that have live IBKR data (only simulate non-IBKR symbols)
                        if (state.ibkrSymbols.has(key)) {
                            return;
                        }
                        if (Math.random() > 0.4) {
                            const inst = { ...newInstruments[key] };
                            const volatility = inst.type === 'FX' ? 0.0002 : 0.0005;
                            const spreadMult = inst.type === 'FX' ? 0.0001 : 0.0005;
                            const move = (Math.random() - 0.5) * (inst.last * volatility);
                            inst.last += move;

                            // Update Bid/Ask with a small randomized spread around last
                            const spread = inst.last * spreadMult;
                            inst.bid = inst.last - (spread * Math.random());
                            inst.ask = inst.last + (spread * Math.random());

                            newInstruments[key] = inst;
                            changed = true;
                        }
                    });
                    return changed ? { instruments: newInstruments } : {};
                });
            },

            broadcastSnapshot: async () => {
                const { instruments, selectedSymbol } = get();
                const fdc3Available = !!window.fdc3;

                console.log("FDC3 Snapshot: Fetching remote state...");

                // Fetch real state from backend to ensure snapshot is accurate
                let mergedPositions: Array<{ contractDesc?: string; symbol?: string; position?: number; avgCost?: number; isSimulated?: boolean }> = [];
                let mergedOrders: Array<{ orderId?: string; id?: string; symbol?: string; ticker?: string; side?: string; totalSize?: number; totalQuantity?: number; qty?: number; status?: string; order_ccp_status?: string; isSimulated?: boolean }> = [];

                try {
                    const [pRes, oRes] = await Promise.all([
                        fetch(`${API_BASE_URL}/mcp/positions`),
                        fetch(`${API_BASE_URL}/mcp/orders`)
                    ]);

                    if (pRes.ok) {
                        const pData = await pRes.json();
                        mergedPositions = Array.isArray(pData) ? pData : (pData.positions || []);
                    }

                    if (oRes.ok) {
                        const oData = await oRes.json();
                        mergedOrders = Array.isArray(oData) ? oData : (oData.orders || []);
                    }
                } catch (e) {
                    console.error("FDC3 Snapshot: Failed to fetch state", e);
                }

                // 1. Snapshot Watchlist
                const instrumentList = {
                    type: 'fdc3.instrumentList',
                    name: 'Main Watchlist',
                    instruments: Object.keys(instruments).map(ticker => ({
                        type: 'fdc3.instrument',
                        id: { ticker }
                    }))
                };
                if (fdc3Available) window.fdc3.broadcast(instrumentList);
                // REMOVED: Don't log massive watchlist snapshots

                // 2. Snapshot Portfolio (Using fetched merged data)
                const portfolio = {
                    type: 'fdc3.portfolio',
                    name: 'Combined IBKR & Simulated Portfolio',
                    positions: mergedPositions.map(p => ({
                        type: 'fdc3.position',
                        instrument: { type: 'fdc3.instrument', id: { ticker: p.contractDesc || p.symbol || 'UNK' } },
                        holding: p.position || 0,
                        avgCost: p.avgCost || 0,
                        isSimulated: p.isSimulated || false
                    }))
                };
                if (fdc3Available) window.fdc3.broadcast(portfolio);
                // REMOVED: Don't log massive portfolio snapshots

                // 3. Snapshot Orders
                if (mergedOrders.length > 0) {
                    const orderCollection = {
                        type: 'fdc3.collection',
                        name: 'Recent Orders',
                        members: mergedOrders.slice(0, 15).map(o => ({
                            type: 'fdc3.order',
                            id: { orderId: o.orderId || o.id },
                            details: {
                                symbol: o.symbol || o.ticker || 'UNK',
                                side: o.side,
                                qty: o.totalSize || o.totalQuantity || o.qty,
                                status: o.status || o.order_ccp_status,
                                isSimulated: o.isSimulated || false
                            }
                        }))
                    };
                    if (fdc3Available) window.fdc3.broadcast(orderCollection);
                    // REMOVED: Don't log massive order collection snapshots
                }

                // 4. Compact portfolio summary for AI context (not full payload)
                if (mergedPositions.length > 0 || mergedOrders.length > 0) {
                    const summary: Record<string, unknown> = { type: 'portfolio.summary' };
                    if (mergedPositions.length > 0) {
                        summary.positions = mergedPositions.map(p => ({
                            sym: p.contractDesc || p.symbol || 'UNK',
                            qty: p.position || 0,
                            avg: p.avgCost ? Math.round(p.avgCost * 100) / 100 : 0
                        }));
                    }
                    if (mergedOrders.length > 0) {
                        summary.orders = mergedOrders.slice(0, 10).map(o => ({
                            id: o.orderId || o.id,
                            sym: o.symbol || o.ticker || 'UNK',
                            side: o.side,
                            qty: o.totalSize || o.totalQuantity || o.qty,
                            st: o.status || o.order_ccp_status
                        }));
                    }
                    get().addLog({ origin: 'APP', type: 'portfolio.summary', data: summary });
                }

                // 5. Snapshot Selected Instrument - Keep this for context continuity
                if (selectedSymbol) {
                    const instrument = {
                        type: 'fdc3.instrument',
                        id: { ticker: selectedSymbol },
                        name: selectedSymbol
                    };
                    if (fdc3Available) window.fdc3.broadcast(instrument);
                    // REMOVED: Already logged by selectSymbol action
                }
            },

            selectTrade: (trade: Trade) => {
                const context = {
                    type: 'fdc3.trade',
                    id: { execId: trade.execId },
                    instrument: {
                        type: 'fdc3.instrument',
                        id: { ticker: trade.symbol }
                    },
                    side: trade.side,
                    quantity: trade.qty,
                    price: trade.price,
                    orderId: trade.orderId,
                    counterparty: trade.cpty,
                    time: trade.time
                };
                get().addLog({ origin: 'APP', type: 'fdc3.trade', data: context });
                if (window.fdc3) {
                    window.fdc3.broadcast(context);
                }
            },

            selectContact: (name: string) => {
                const contact = {
                    type: 'fdc3.contact',
                    name: name,
                    id: {
                        email: `${name.toLowerCase().replace(' ', '.')}@interop.trader`,
                        salesforceId: `SF-${Math.floor(Math.random() * 10000)}`
                    }
                };
                get().addLog({ origin: 'APP', type: 'fdc3.contact', data: contact });
                if (window.fdc3) {
                    window.fdc3.broadcast(contact);
                    if (window.fdc3.raiseIntent) {
                        console.log("Mocking 'StartChat' intent raise...");
                    }
                }
            },

            flattenPosition: async (symbol: string) => {
                try {
                    // Fetch current IBKR positions
                    const res = await fetch(`${API_BASE_URL}/mcp/positions`);
                    const data = await res.json();

                    let positionsList: any[] = [];
                    if (Array.isArray(data)) {
                        positionsList = data;
                    } else if (data && Array.isArray(data.positions)) {
                        positionsList = data.positions;
                    }

                    // Find the position for this symbol
                    const position = positionsList.find((p: any) =>
                        (p.contractDesc || p.symbol) === symbol
                    );

                    if (!position) {
                        get().addToast(`No position found for ${symbol}`, 'error');
                        return;
                    }

                    const netQty = position.position || position.qty || 0;
                    if (netQty === 0) {
                        get().addToast(`No open position for ${symbol}`, 'info');
                        return;
                    }

                    const side = netQty > 0 ? 'SELL' : 'BUY';
                    const qty = Math.abs(netQty);
                    const { instruments } = get();
                    const price = instruments[symbol]?.last || position.avgCost || 0;

                    get().addToast(`Closing ${symbol}: ${side} ${qty} @ MKT`, 'warning');

                    get().submitOrder({
                        symbol,
                        side,
                        qty,
                        type: 'MARKET',
                        price,
                        expiry: 'DAY'
                    });
                } catch (err) {
                    console.error('Failed to flatten position:', err);
                    get().addToast(`Failed to close ${symbol}: ${err}`, 'error');
                }
            },

            updateInstrumentFromIBKR: (symbol: string, data: { last: number; bid: number | null; ask: number | null; chg?: number | null }) => {
                set(state => {
                    const inst = state.instruments[symbol];
                    // Update EQUITY and FX type instruments (skip RATES for now)
                    if (!inst || inst.type === 'RATES') {
                        return {};
                    }

                    const updatedInst = { ...inst };
                    updatedInst.last = data.last;

                    // Only update bid/ask if provided (delayed data may not have them)
                    if (data.bid !== null) {
                        updatedInst.bid = data.bid;
                    }
                    if (data.ask !== null) {
                        updatedInst.ask = data.ask;
                    }

                    // Use IBKR provided change or calculate vs reference price
                    if (data.chg !== undefined && data.chg !== null) {
                        updatedInst.chg = data.chg;
                    } else {
                        const refPrice = referencePrices[symbol];
                        if (refPrice) {
                            updatedInst.chg = parseFloat((((data.last - refPrice) / refPrice) * 100).toFixed(2));
                        }
                    }

                    // Add symbol to IBKR set
                    const newIbkrSymbols = new Set(state.ibkrSymbols);
                    newIbkrSymbols.add(symbol);

                    return {
                        instruments: { ...state.instruments, [symbol]: updatedInst },
                        ibkrSymbols: newIbkrSymbols
                    };
                });
            },

            addMcpTrade: (trade) => {
                const id = `MCP-${Date.now()}-${Math.random().toString(36).substring(7)}`;
                set(state => ({
                    mcpTrades: [{
                        ...trade,
                        id,
                        timestamp: Date.now()
                    }, ...state.mcpTrades].slice(0, 100) // Keep last 100 MCP trades
                }));
            },

            updateMcpTrade: (id, updates) => {
                set(state => ({
                    mcpTrades: state.mcpTrades.map(t =>
                        t.id === id ? { ...t, ...updates } : t
                    )
                }));
            },

            fetchStatus: async () => {
                try {
                    const resp = await fetch(`${API_BASE_URL}/all_status`);
                    if (resp.ok) {
                        const data = await resp.json();
                        set({
                            connectionStatus: {
                                marketData: data.marketData.connected,
                                gateway: data.gateway.available
                            }
                        });
                    }
                } catch (e) {
                    console.error("Failed to fetch connection status", e);
                    set({
                        connectionStatus: {
                            marketData: false,
                            gateway: false
                        }
                    });
                }
            },

            addInstrument: async (symbol: string, assetClass: string = 'STK') => {
                // Don't add if already exists
                if (get().instruments[symbol]) {
                    return;
                }

                const newInstrument: Instrument = {
                    symbol,
                    name: symbol,
                    type: assetClass === 'CASH' ? 'FX' : 'EQUITY',
                    last: 0,
                    bid: 0,
                    ask: 0,
                    chg: 0
                };

                set(state => ({
                    instruments: {
                        ...state.instruments,
                        [symbol]: newInstrument
                    }
                }));

                // Subscribe to market data
                try {
                    await fetch(`${API_BASE_URL}/mcp/subscribe`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ symbol })
                    });
                    console.log(`Subscribed to market data for ${symbol}`);
                } catch (err) {
                    console.error(`Failed to subscribe to ${symbol}:`, err);
                }
            },

            removeInstrument: (symbol: string) => {
                set(state => {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const { [symbol]: _removed, ...remainingInstruments } = state.instruments;
                    return {
                        instruments: remainingInstruments,
                        selectedSymbol: state.selectedSymbol === symbol ? '' : state.selectedSymbol
                    };
                });
            },

            reorderInstruments: (newOrder: string[]) => {
                set(state => {
                    const reordered: Record<string, Instrument> = {};
                    newOrder.forEach(symbol => {
                        if (state.instruments[symbol]) {
                            reordered[symbol] = state.instruments[symbol];
                        }
                    });
                    return { instruments: reordered };
                });
            }
        }), {
        name: 'simulation-store',
        partialize: (state) => ({
            aiConfig: state.aiConfig,
            theme: state.theme
        }),
    }
    )
);

// Start simulation loop
setInterval(() => {
    useSimulationStore.getState().simulateMarketData();
}, 2000);

// Global types for FDC3
declare global {
    interface Window {
        fdc3: {
            broadcast: (context: unknown) => void;
            raiseIntent?: (intent: string, context: unknown) => void;
        };
    }
}
