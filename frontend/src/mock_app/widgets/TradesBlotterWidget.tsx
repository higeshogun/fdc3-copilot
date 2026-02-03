import { useState, useMemo } from 'react';
import { useSimulationStore, getTickerPrecision } from '../store/useSimulationStore';

const TradesBlotterWidget = () => {
    const { trades, selectTrade } = useSimulationStore();
    const [sortKey, setSortKey] = useState<string>('time');
    const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
    const [colWidths, setColWidths] = useState({
        time: 70, execId: 70, orderId: 70, side: 50, sym: 60, qty: 70, px: 70, cpty: 60, settle: 80
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

    const sortedTrades = useMemo(() => {
        const data = [...trades];
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
    }, [trades, sortKey, sortDir]);

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
                        {renderHeaderCell("SYM", "sym", "symbol")}
                        {renderHeaderCell("QTY", "qty", "qty", "right")}
                        {renderHeaderCell("FILL PX", "px", "price", "right")}
                        {renderHeaderCell("CPTY", "cpty", "cpty")}
                        {renderHeaderCell("SETTLE", "settle", "settleDate")}
                    </tr>
                </thead>
                <tbody>
                    {sortedTrades.map(trade => (
                        <tr
                            key={trade.execId}
                            onClick={() => selectTrade(trade)}
                            className="border-b border-[var(--border-primary)] hover:bg-[var(--bg-tertiary)] cursor-pointer"
                        >
                            <td className="p-2 text-[var(--text-secondary)] truncate">{trade.time}</td>
                            <td className="p-2 text-[var(--text-secondary)] opacity-60 truncate">{trade.execId}</td>
                            <td className="p-2 text-[var(--text-secondary)] opacity-60 truncate">{trade.orderId}</td>
                            <td className={`p-2 font-bold ${trade.side === 'BUY' ? 'text-[var(--success-color)]' : 'text-[var(--danger-color)]'}`}>{trade.side}</td>
                            <td className="p-2 text-[var(--text-primary)] truncate">{trade.symbol}</td>
                            <td className="p-2 text-right text-[var(--text-secondary)] tabular-nums">{trade.qty.toLocaleString()}</td>
                            <td className="p-2 text-right text-[var(--text-secondary)] tabular-nums">
                                {trade.price.toFixed(getTickerPrecision(trade.symbol))}
                            </td>
                            <td className="p-2 text-[var(--text-secondary)] truncate">{trade.cpty}</td>
                            <td className="p-2 text-[var(--text-secondary)] opacity-60 font-mono truncate">{trade.settleDate}</td>
                        </tr>
                    ))}
                    {sortedTrades.length === 0 && (
                        <tr>
                            <td colSpan={9} className="p-4 text-center text-gray-500 italic">No executed trades found.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default TradesBlotterWidget;
