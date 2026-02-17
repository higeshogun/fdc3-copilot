import { useState, useMemo, useEffect } from 'react';
import { useSimulationStore, getTickerPrecision } from '../store/useSimulationStore';
import { API_BASE_URL } from '../config';

const TradesBlotterWidget = () => {
    // Keep store for selection but fetch data from IBKR
    const { trades: simTrades, selectTrade } = useSimulationStore();
    const [ibkrTrades, setIbkrTrades] = useState<any[]>([]);
    const [useLive] = useState(true);

    const [sortKey, setSortKey] = useState<string>('time');
    const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
    const [colWidths, setColWidths] = useState({
        time: 140, execId: 80, orderId: 80, side: 50, sym: 80, secType: 70, qty: 70, px: 80, commission: 90, netAmount: 110, exchange: 90
    });

    // Poll IBKR Orders (Filled)
    useEffect(() => {
        if (!useLive) return;

        const fetchTrades = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/mcp/orders`);
                const data = await res.json();

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

                if (ordersList.length > 0) {
                    // Filter for filled orders to mock the 'Trades' view
                    const filledOrders = ordersList.filter((o: any) => o.status === 'Filled' || o.filledQuantity > 0);

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

                    const mappedTrades = filledOrders.map((o: any) => ({
                        execId: `EX-${o.orderId}`,
                        orderId: o.orderId,
                        time: formatIBKRTime(o.lastExecutionTime_r || o.lastExecutionTime || o.time),
                        side: o.side || (o.action === 'BUY' ? 'BUY' : 'SELL'),
                        symbol: o.ticker || o.symbol || 'UNK',
                        secType: o.secType || o.assetClass || 'STK',
                        qty: o.filledQuantity || o.totalSize || 0,
                        price: o.avgPrice || o.avgCost || 0,
                        commission: o.commission || 0,
                        netAmount: (o.filledQuantity || o.totalSize || 0) * (o.avgPrice || o.avgCost || 0),
                        exchange: o.exchange || o.listingExchange || '',
                        account: o.acct || o.account || '',
                        cpty: 'IBKR',
                        settleDate: 'T+2'
                    }));
                    setIbkrTrades(mappedTrades);
                } else {
                    setIbkrTrades([]);
                }
            } catch (err) {
                console.error("Failed to fetch IBKR trades", err);
            }
        };

        fetchTrades();
        const interval = setInterval(fetchTrades, 5000); // Poll slower for trades
        return () => clearInterval(interval);
    }, [useLive]);

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

    const activeTrades = useLive ? ibkrTrades : simTrades;

    const sortedTrades = useMemo(() => {
        const data = [...activeTrades];
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
    }, [activeTrades, sortKey, sortDir]);

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
        <div className="h-full overflow-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs table-fixed min-w-max">
                <thead>
                    <tr className="bg-[var(--bg-tertiary)] text-[var(--text-secondary)] sticky top-0 z-10">
                        {renderHeaderCell("TIME", "time", "time")}
                        {renderHeaderCell("EXEC ID", "execId", "execId")}
                        {renderHeaderCell("ORD ID", "orderId", "orderId")}
                        {renderHeaderCell("SIDE", "side", "side")}
                        {renderHeaderCell("SYMBOL", "sym", "symbol")}
                        {renderHeaderCell("SEC TYPE", "secType", "secType")}
                        {renderHeaderCell("QTY", "qty", "qty", "right")}
                        {renderHeaderCell("FILL PX", "px", "price", "right")}
                        {renderHeaderCell("COMMISSION", "commission", "commission", "right")}
                        {renderHeaderCell("NET AMOUNT", "netAmount", "netAmount", "right")}
                        {renderHeaderCell("EXCHANGE", "exchange", "exchange")}
                    </tr>
                </thead>
                <tbody>
                    {sortedTrades.length === 0 && (
                        <tr>
                            <td colSpan={11} className="p-4 text-center text-[var(--text-tertiary)] italic">No executed trades found.</td>
                        </tr>
                    )}
                    {sortedTrades.map((trade, idx) => (
                        <tr
                            key={trade.execId || idx}
                            onClick={() => selectTrade && selectTrade(trade)}
                            className="border-b border-[var(--border-primary)] hover:bg-[var(--bg-tertiary)] cursor-pointer"
                        >
                            <td className="p-2 text-[var(--text-secondary)] text-[10px] truncate">{trade.time}</td>
                            <td className="p-2 text-[var(--text-secondary)] opacity-60 text-[10px] truncate">{trade.execId}</td>
                            <td className="p-2 text-[var(--text-secondary)] opacity-60 text-[10px] truncate">{trade.orderId}</td>
                            <td className={`p-2 font-bold ${trade.side === 'BUY' ? 'text-[var(--success-color)]' : 'text-[var(--danger-color)]'}`}>{trade.side}</td>
                            <td className="p-2 text-[var(--text-primary)] font-medium truncate">{trade.symbol}</td>
                            <td className="p-2 text-[var(--text-secondary)] text-[10px] truncate">{trade.secType}</td>
                            <td className="p-2 text-right text-[var(--text-secondary)] tabular-nums">{Number(trade.qty).toLocaleString()}</td>
                            <td className="p-2 text-right text-[var(--text-secondary)] tabular-nums">
                                {trade.price ? Number(trade.price).toFixed(getTickerPrecision(trade.symbol)) : '0.00'}
                            </td>
                            <td className="p-2 text-right text-[var(--text-secondary)] tabular-nums">
                                ${Number(trade.commission).toFixed(2)}
                            </td>
                            <td className="p-2 text-right text-[var(--text-primary)] font-medium tabular-nums">
                                ${Number(trade.netAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="p-2 text-[var(--text-secondary)] text-[10px] truncate">{trade.exchange || '-'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default TradesBlotterWidget;
