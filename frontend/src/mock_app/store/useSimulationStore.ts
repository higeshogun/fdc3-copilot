
import { create } from 'zustand';
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
    broadcastSnapshot: () => void;
    selectTrade: (trade: Trade) => void;
    selectContact: (name: string) => void;
    flattenPosition: (symbol: string) => void;
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
    'US10Y': { symbol: 'US10Y', name: 'US Treasury 10Y', last: 4.190, bid: 4.188, ask: 4.192, chg: 0.02, type: 'RATES' },
};

const initialPositions: Record<string, Position> = {
    'AAPL': { symbol: 'AAPL', long: 15000, short: 0, cost: 180.50 },
    'MSFT': { symbol: 'MSFT', long: 12000, short: 0, cost: 410.20 },
    'EUR/USD': { symbol: 'EUR/USD', long: 1000000, short: 0, cost: 1.0820 },
};

let orderIdCounter = 1001;
let execIdCounter = 5001;

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
            aiConfig: {
                provider: 'local',
                url: 'http://localhost:8081',
                key: '',
                model: 'gemini-1.5-flash',
                temp: 0.7,
                prompt: "You are a trade assistant and analyst. Analyze the FDC3 logs for to help answers my questions about orders and trades and position and what i have been doing on the platform based on the context derived from the fd3 json data.",
                start: '',
                end: ''
            },
            theme: 'dark',

            toggleTheme: () => set(state => ({
                theme: state.theme === 'dark' ? 'light' : 'dark'
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

            submitOrder: (orderValues) => {
                const id = `ORD-${orderIdCounter++}`;
                const time = new Date().toLocaleTimeString();
                const settleDate = calculateSettlement();
                const newOrder: Order = {
                    ...orderValues,
                    id,
                    time,
                    status: 'NEW',
                    avgPx: 0,
                    cumQty: 0,
                    settleDate
                };

                set(state => ({ orders: [newOrder, ...state.orders] }));
                get().addToast(`ORDER SUBMITTED: ${orderValues.side} ${orderValues.qty} ${orderValues.symbol}`, 'info');
                get().addLog({ origin: 'APP', type: 'fdc3.order', data: newOrder });

                // Simulate Execution
                setTimeout(() => {
                    const { orders, positions } = get();
                    const orderIndex = orders.findIndex(o => o.id === id);
                    if (orderIndex === -1) return;

                    const order = { ...orders[orderIndex] };
                    const fillQty = order.qty;
                    const fillPx = order.price + (Math.random() - 0.5) * 0.05;
                    const execId = `EX-${execIdCounter++}`;

                    const trade: Trade = {
                        execId,
                        orderId: order.id,
                        time: new Date().toLocaleTimeString(),
                        side: order.side,
                        symbol: order.symbol,
                        qty: fillQty,
                        price: fillPx,
                        cpty: ['GS', 'MS', 'JPM', 'CITI', 'BARC'][Math.floor(Math.random() * 5)],
                        settleDate
                    };

                    // Update Order
                    order.status = 'FILLED';
                    order.cumQty = fillQty;
                    order.avgPx = fillPx;

                    // Update Position
                    const pos = positions[order.symbol] || { symbol: order.symbol, long: 0, short: 0, cost: 0 };
                    const newPos = { ...pos };

                    if (order.side === 'BUY') {
                        newPos.long += fillQty;
                        newPos.cost = ((pos.long * pos.cost) + (fillQty * fillPx)) / (newPos.long || 1);
                    } else {
                        if (newPos.long > 0) newPos.long -= fillQty;
                        else newPos.short += fillQty;
                        newPos.cost = ((pos.short * pos.cost) + (fillQty * fillPx)) / (newPos.short || 1);
                    }

                    set(state => ({
                        orders: state.orders.map(o => o.id === id ? order : o),
                        trades: [trade, ...state.trades],
                        positions: { ...state.positions, [order.symbol]: newPos }
                    }));

                    get().addToast(`ORDER FILLED: ${order.side} ${fillQty} ${order.symbol} @ ${fillPx.toFixed(getTickerPrecision(order.symbol))}`, 'success');
                    get().addLog({ origin: 'FDC3', type: 'fdc3.trade', data: trade });

                    // Republish Position Update
                    const updatedPositions = get().positions;
                    const positionContext = {
                        type: 'fdc3.position',
                        instrument: { type: 'fdc3.instrument', id: { ticker: order.symbol } },
                        holding: updatedPositions[order.symbol].long - updatedPositions[order.symbol].short
                    };
                    if (window.fdc3) window.fdc3.broadcast(positionContext);
                    get().addLog({ origin: 'FDC3', type: 'fdc3.position', data: positionContext });

                }, 1000);
            },

            simulateMarketData: () => {
                set(state => {
                    const newInstruments = { ...state.instruments };
                    let changed = false;
                    Object.keys(newInstruments).forEach(key => {
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

            broadcastSnapshot: () => {
                const { instruments, positions, orders, selectedSymbol } = get();
                const fdc3Available = !!window.fdc3;

                if (!fdc3Available) {
                    console.warn("FDC3 Snapshot: Desktop Agent not available. Logging locally only.");
                }

                console.log("FDC3 Snapshot: Processing system state...");

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
                get().addLog({ origin: 'FDC3', type: 'fdc3.instrumentList', data: instrumentList });

                // 2. Snapshot Portfolio
                const portfolio = {
                    type: 'fdc3.portfolio',
                    name: 'Simulation Portfolio',
                    positions: Object.keys(positions).map(sym => ({
                        type: 'fdc3.position',
                        instrument: { type: 'fdc3.instrument', id: { ticker: sym } },
                        holding: positions[sym].long - positions[sym].short
                    }))
                };
                if (fdc3Available) window.fdc3.broadcast(portfolio);
                get().addLog({ origin: 'FDC3', type: 'fdc3.portfolio', data: portfolio });

                // 3. Snapshot Orders
                if (orders.length > 0) {
                    const orderCollection = {
                        type: 'fdc3.collection',
                        name: 'Recent Orders',
                        members: orders.slice(0, 10).map(o => ({
                            type: 'fdc3.order',
                            id: { orderId: o.id },
                            details: { symbol: o.symbol, side: o.side, qty: o.qty, price: o.price, status: o.status }
                        }))
                    };
                    if (fdc3Available) window.fdc3.broadcast(orderCollection);
                    get().addLog({ origin: 'FDC3', type: 'fdc3.collection', data: orderCollection });
                }

                // 4. Snapshot Selected Instrument
                if (selectedSymbol) {
                    const instrument = {
                        type: 'fdc3.instrument',
                        id: { ticker: selectedSymbol },
                        name: selectedSymbol
                    };
                    if (fdc3Available) window.fdc3.broadcast(instrument);
                    get().addLog({ origin: 'FDC3', type: 'fdc3.instrument', data: instrument });
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

            flattenPosition: (symbol: string) => {
                const { positions, instruments, submitOrder } = get();
                const pos = positions[symbol];
                if (!pos) return;

                const netQty = pos.long - pos.short;
                if (netQty === 0) return;

                const side = netQty > 0 ? 'SELL' : 'BUY';
                const qty = Math.abs(netQty);
                const price = instruments[symbol]?.last || pos.cost;

                get().addToast(`FLATTENING ${symbol}: Submitting ${side} ${qty}...`, 'warning');

                submitOrder({
                    symbol,
                    side,
                    qty,
                    type: 'MARKET',
                    price,
                    expiry: 'DAY'
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
