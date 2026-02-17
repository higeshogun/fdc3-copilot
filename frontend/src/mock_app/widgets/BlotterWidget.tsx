import { useState, useMemo, useEffect } from 'react';
import { useSimulationStore, getTickerPrecision } from '../store/useSimulationStore';
import { API_BASE_URL } from '../config';


import { mcpClient } from '../services/MCPClient';

const BlotterWidget = () => {
    // Keep store for simulation mode fallback if needed, but primarily use IBKR
    const { orders: simOrders, mcpMode } = useSimulationStore();
    const [ibkrOrders, setIbkrOrders] = useState<any[]>([]);
    const [useLive] = useState(true);

    const [sortKey, setSortKey] = useState<string>('time');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [colWidths, setColWidths] = useState({
        time: 140, id: 80, side: 50, sym: 80, secType: 70, type: 50, qty: 70, filled: 70, remaining: 70, px: 80, avgPx: 80, status: 90, exchange: 90, expiry: 60, actions: 100
    });

    // Poll IBKR Orders
    useEffect(() => {
        if (!useLive) return;

        let isMounted = true;
        let timeoutId: any = null;

        const fetchOrders = async () => {
            try {
                let data;

                if (mcpMode) {
                    // MCP Mode: Use standardized tool call
                    // console.log("Fetching orders via MCP...");
                    const result = await mcpClient.callTool("get_orders") as any;

                    // MCP returns { content: [{ type: 'text', text: '...' }] }
                    if (result && result.content && result.content[0] && result.content[0].text) {
                        data = JSON.parse(result.content[0].text);
                    } else {
                        data = [];
                    }
                } else {
                    // Native Mode: Direct REST call
                    const res = await fetch(`${API_BASE_URL}/mcp/orders`);
                    if (!res.ok) {
                        // If REST fails, don't crash, just log and retry
                        console.warn("Failed to fetch orders via REST", res.status);
                        data = [];
                    } else {
                        data = await res.json();
                    }
                }

                if (!isMounted) return;

                let ordersList: any[] = [];

                if (Array.isArray(data)) {
                    ordersList = data;
                } else if (data && data.orders) {
                    if (Array.isArray(data.orders)) {
                        ordersList = data.orders;
                    } else if (data.orders.orders && Array.isArray(data.orders.orders)) {
                        ordersList = data.orders.orders;
                    }
                }

                // ... (rest of processing logic stays mainly same, we can keep it here or inside the block)
                if (ordersList.length > 0) {
                    const formatIBKRTime = (raw: string | number | undefined) => {
                        if (!raw) return new Date().toLocaleString();
                        const d = new Date(raw);
                        if (!isNaN(d.getTime())) return d.toLocaleString();
                        // Handle IBKR raw YYMMDDHHMMSS
                        if (typeof raw === 'string' && raw.length === 12 && !isNaN(Number(raw))) {
                            const year = 2000 + parseInt(raw.substring(0, 2));
                            const month = parseInt(raw.substring(2, 4)) - 1;
                            const day = parseInt(raw.substring(4, 6));
                            const hour = parseInt(raw.substring(6, 8));
                            const min = parseInt(raw.substring(8, 10));
                            const sec = parseInt(raw.substring(10, 12));
                            return new Date(year, month, day, hour, min, sec).toLocaleString();
                        }
                        return String(raw);
                    };

                    const mappedOrders = ordersList.map((o: any) => ({
                        id: o.orderId || o.conid,
                        time: formatIBKRTime(o.lastExecutionTime_r || o.lastExecutionTime || o.time),
                        side: o.side || (o.action === 'BUY' ? 'BUY' : 'SELL'),
                        symbol: o.ticker || o.symbol || 'UNK',
                        secType: o.secType || o.assetClass || 'STK',
                        type: o.orderType || 'LMT',
                        qty: o.totalSize || o.totalQuantity || o.quantity || 0,
                        filled: o.filledQuantity || o.filled || 0,
                        remaining: o.remainingQuantity || o.remaining || 0,
                        price: o.lmtPrice || o.price || 0,
                        avgPx: o.avgPrice || 0,
                        status: o.status || 'Submitted',
                        expiry: o.tif || 'DAY',
                        exchange: o.exchange || o.listingExchange || '',
                        account: o.acct || o.account || '',
                        commission: o.commission || 0,
                        settleDate: 'T+2'
                    }));
                    setIbkrOrders(mappedOrders);
                } else {
                    setIbkrOrders([]);
                }

            } catch (err) {
                console.error("Failed to fetch IBKR orders", err);
            } finally {
                if (isMounted) {
                    timeoutId = setTimeout(fetchOrders, 3000); // Wait 3s AFTER finish
                }
            }
        };

        fetchOrders();

        return () => {
            isMounted = false;
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [useLive, mcpMode]);

    const handleSort = (key: string) => {
        if (sortKey === key) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const handleResize = (col: keyof typeof colWidths, e: React.MouseEvent) => {
        const startX = e.pageX;
        const startWidth = colWidths[col];
        const onMouseMove = (moveE: MouseEvent) => {
            const newWidth = Math.max(40, startWidth + (moveE.pageX - startX));
            setColWidths(prev => ({ ...prev, [col]: newWidth }));
        };
        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const activeOrders = useLive ? ibkrOrders : simOrders;

    const sortedOrders = useMemo(() => {
        const data = [...activeOrders];
        if (sortKey) {
            data.sort((a, b) => {
                const vA = a[sortKey as keyof typeof a];
                const vB = b[sortKey as keyof typeof b];
                if (vA === undefined || vB === undefined) return 0;
                if (vA < vB) return sortDir === 'asc' ? -1 : 1;
                if (vA > vB) return sortDir === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return data;
    }, [activeOrders, sortKey, sortDir]);

    const renderHeaderCell = (label: string, col: keyof typeof colWidths, sortId: string, align: 'left' | 'right' | 'center' = 'left') => (
        <th
            style={{ width: colWidths[col] }}
            className={`p-2 border-b border-[var(--border-primary)] relative cursor-pointer hover:text-[var(--text-accent)] ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : ''}`}
            onClick={() => handleSort(sortId)}
        >
            <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
                {label} {sortKey === sortId && (sortDir === 'asc' ? '▲' : '▼')}
            </div>
            <div
                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 z-20"
                onMouseDown={(e) => { e.stopPropagation(); handleResize(col, e); }}
            />
        </th>
    );

    return (
        <div className="h-full flex flex-col">
            {/* Mode Toggle (Optional, helpful for debugging) */}
            {/* <div className="p-1 bg-[var(--bg-secondary)] flex justify-end">
                <button 
                    onClick={() => setUseLive(!useLive)}
                    className="text-[10px] px-2 py-0.5 rounded bg-[var(--bg-primary)] border border-[var(--border-primary)]"
                >
                    {useLive ? '● LIVE (IBKR)' : '○ SIMULATED'}
                </button>
             </div> */}

            <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full text-left border-collapse text-xs table-fixed min-w-max">
                    <thead>
                        <tr className="bg-[var(--bg-tertiary)] text-[var(--text-secondary)] sticky top-0 z-10">
                            {renderHeaderCell("TIME", "time", "time")}
                            {renderHeaderCell("ID", "id", "id")}
                            {renderHeaderCell("SIDE", "side", "side")}
                            {renderHeaderCell("SYMBOL", "sym", "symbol")}
                            {renderHeaderCell("SEC TYPE", "secType", "secType")}
                            {renderHeaderCell("TYPE", "type", "type")}
                            {renderHeaderCell("QTY", "qty", "qty", "right")}
                            {renderHeaderCell("FILLED", "filled", "filled", "right")}
                            {renderHeaderCell("REMAIN", "remaining", "remaining", "right")}
                            {renderHeaderCell("LIMIT PX", "px", "price", "right")}
                            {renderHeaderCell("AVG PX", "avgPx", "avgPx", "right")}
                            {renderHeaderCell("STATUS", "status", "status")}
                            {renderHeaderCell("EXCHANGE", "exchange", "exchange")}
                            {renderHeaderCell("EXPIRY", "expiry", "expiry")}
                            {renderHeaderCell("ACTIONS", "actions", "id", "center")}
                        </tr>
                    </thead>
                    <tbody>
                        {sortedOrders.length === 0 && (
                            <tr>
                                <td colSpan={15} className="p-4 text-center text-[var(--text-tertiary)] italic">
                                    {useLive ? 'Loading IBKR Orders...' : 'No Active Orders'}
                                </td>
                            </tr>
                        )}
                        {sortedOrders.map((order, idx) => (
                            <tr key={order.id || idx} className="border-b border-[var(--border-primary)] hover:bg-[var(--bg-tertiary)]">
                                <td className="p-2 text-[var(--text-secondary)] text-[10px] truncate">{order.time}</td>
                                <td className="p-2 text-[var(--text-secondary)] opacity-60 text-[10px] truncate">{order.id}</td>
                                <td className={`p-2 font-bold ${order.side === 'BUY' ? 'text-[var(--success-color)]' : 'text-[var(--danger-color)]'}`}>{order.side}</td>
                                <td className="p-2 text-[var(--text-primary)] font-medium truncate">{order.symbol}</td>
                                <td className="p-2 text-[var(--text-secondary)] text-[10px] truncate">{order.secType}</td>
                                <td className="p-2 text-[var(--text-secondary)] font-mono text-[10px] truncate">{order.type}</td>
                                <td className="p-2 text-right text-[var(--text-secondary)] tabular-nums">{order.qty.toLocaleString()}</td>
                                <td className="p-2 text-right text-[var(--text-secondary)] tabular-nums">{order.filled.toLocaleString()}</td>
                                <td className="p-2 text-right text-[var(--text-secondary)] tabular-nums">{order.remaining.toLocaleString()}</td>
                                <td className="p-2 text-right text-[var(--text-secondary)] tabular-nums">
                                    {order.price ? Number(order.price).toFixed(getTickerPrecision(order.symbol)) : 'MKT'}
                                </td>
                                <td className="p-2 text-right text-[var(--accent-color)] tabular-nums">
                                    {Number(order.avgPx) > 0 ? Number(order.avgPx).toFixed(getTickerPrecision(order.symbol)) : '-'}
                                </td>
                                <td className="p-2 text-[var(--text-secondary)] truncate">{order.status}</td>
                                <td className="p-2 text-[var(--text-secondary)] text-[10px] truncate">{order.exchange || '-'}</td>
                                <td className="p-2 text-[var(--text-secondary)] opacity-80 font-mono text-[10px] truncate">{order.expiry || 'DAY'}</td>
                                <td className="p-2 text-center flex items-center justify-center gap-2">
                                    {['Submitted', 'PreSubmitted', 'PendingSubmit', 'Inactive'].includes(order.status) && (
                                        <>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const newQty = prompt("New Quantity:", order.qty);
                                                    if (newQty && !isNaN(Number(newQty))) {
                                                        const newPrice = order.type !== 'MKT' ? prompt("New Price:", order.price) : null;
                                                        useSimulationStore.getState().modifyOrder(order.id, {
                                                            symbol: order.symbol,
                                                            side: order.side,
                                                            quantity: Number(newQty),
                                                            type: order.type,
                                                            price: newPrice ? Number(newPrice) : undefined
                                                        });
                                                    }
                                                }}
                                                className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-1.5 py-0.5 rounded"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (confirm("Cancel Order?")) {
                                                        useSimulationStore.getState().cancelOrder(order.id);
                                                    }
                                                }}
                                                className="text-[10px] bg-red-600 hover:bg-red-500 text-white px-1.5 py-0.5 rounded"
                                            >
                                                Cancel
                                            </button>
                                        </>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default BlotterWidget;
