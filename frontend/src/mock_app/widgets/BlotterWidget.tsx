import { useState, useMemo } from 'react';
import { useSimulationStore, getTickerPrecision } from '../store/useSimulationStore';

const BlotterWidget = () => {
    const { orders } = useSimulationStore();
    const [sortKey, setSortKey] = useState<string>('time');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [colWidths, setColWidths] = useState({
        time: 70, id: 60, side: 50, sym: 60, type: 60, qty: 70, px: 70, avgPx: 70, status: 70, expiry: 60, settle: 80
    });

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

    const sortedOrders = useMemo(() => {
        const data = [...orders];
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
    }, [orders, sortKey, sortDir]);

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
                        {renderHeaderCell("ID", "id", "id")}
                        {renderHeaderCell("SIDE", "side", "side")}
                        {renderHeaderCell("SYM", "sym", "symbol")}
                        {renderHeaderCell("TYPE", "type", "type")}
                        {renderHeaderCell("QTY", "qty", "qty", "right")}
                        {renderHeaderCell("PX", "px", "price", "right")}
                        {renderHeaderCell("AVG PX", "avgPx", "avgPx", "right")}
                        {renderHeaderCell("STATUS", "status", "status")}
                        {renderHeaderCell("EXPIRY", "expiry", "expiry")}
                        {renderHeaderCell("SETTLE", "settle", "settleDate")}
                    </tr>
                </thead>
                <tbody>
                    {sortedOrders.map(order => (
                        <tr key={order.id} className="border-b border-[var(--border-primary)] hover:bg-[var(--bg-tertiary)]">
                            <td className="p-2 text-[var(--text-secondary)] truncate">{order.time}</td>
                            <td className="p-2 text-[var(--text-secondary)] opacity-60 truncate">{order.id}</td>
                            <td className={`p-2 font-bold ${order.side === 'BUY' ? 'text-[var(--success-color)]' : 'text-[var(--danger-color)]'}`}>{order.side}</td>
                            <td className="p-2 text-[var(--text-primary)] truncate">{order.symbol}</td>
                            <td className="p-2 text-[var(--text-secondary)] font-mono text-[10px] truncate">{order.type}</td>
                            <td className="p-2 text-right text-[var(--text-secondary)] tabular-nums">{order.qty.toLocaleString()}</td>
                            <td className="p-2 text-right text-[var(--text-secondary)] tabular-nums">
                                {order.price.toFixed(getTickerPrecision(order.symbol))}
                            </td>
                            <td className="p-2 text-right text-[var(--accent-color)] tabular-nums">
                                {order.avgPx > 0 ? order.avgPx.toFixed(getTickerPrecision(order.symbol)) : '-'}
                            </td>
                            <td className="p-2 text-[var(--text-secondary)] truncate">{order.status}</td>
                            <td className="p-2 text-[var(--text-secondary)] opacity-80 font-mono text-[10px] truncate">{order.expiry || 'DAY'}</td>
                            <td className="p-2 text-[var(--text-secondary)] opacity-60 font-mono truncate">{order.settleDate}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default BlotterWidget;
