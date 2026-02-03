import { useState, useMemo } from 'react';
import { useSimulationStore } from '../store/useSimulationStore';

const PositionsWidget = () => {
    const { positions, instruments, flattenPosition } = useSimulationStore();
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [colWidths, setColWidths] = useState({ sym: 80, qty: 100, cost: 90, beta: 50, var: 80, pl: 90 });

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

    const activePositions = useMemo(() => {
        const data = Object.values(positions)
            .filter(p => p.long !== 0 || p.short !== 0)
            .map(pos => {
                const netQty = pos.long - pos.short;
                const currentPx = instruments[pos.symbol]?.last || pos.cost;

                // Deterministic mock risk values
                const seed = pos.symbol.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
                const beta = 0.5 + (seed % 100) / 50;
                const varP = 0.02 + (seed % 50) / 1000;
                const varDollar = Math.abs(netQty * currentPx * varP);

                return {
                    ...pos,
                    netQty,
                    currentPx,
                    beta,
                    varDollar,
                    pl: (currentPx - pos.cost) * netQty
                };
            });

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
    }, [positions, instruments, sortKey, sortDir]);

    return (
        <div className="h-full overflow-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs table-fixed">
                <thead>
                    <tr className="bg-[var(--bg-tertiary)] text-[var(--text-secondary)] sticky top-0 z-10">
                        <th style={{ width: colWidths.sym }} className="p-2 border-b border-[var(--border-primary)] relative cursor-pointer hover:text-[var(--text-accent)]" onClick={() => handleSort('symbol')}>
                            SYM {sortKey === 'symbol' && (sortDir === 'asc' ? '▲' : '▼')}
                            <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => { e.stopPropagation(); handleResize('sym', e); }} />
                        </th>
                        <th style={{ width: colWidths.qty }} className="p-2 border-b border-[var(--border-primary)] text-right relative cursor-pointer hover:text-[var(--text-accent)]" onClick={() => handleSort('netQty')}>
                            QTY {sortKey === 'netQty' && (sortDir === 'asc' ? '▲' : '▼')}
                            <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => { e.stopPropagation(); handleResize('qty', e); }} />
                        </th>
                        <th style={{ width: colWidths.cost }} className="p-2 border-b border-[var(--border-primary)] text-right relative cursor-pointer hover:text-[var(--text-accent)]" onClick={() => handleSort('cost')}>
                            AVG PX {sortKey === 'cost' && (sortDir === 'asc' ? '▲' : '▼')}
                            <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => { e.stopPropagation(); handleResize('cost', e); }} />
                        </th>
                        <th style={{ width: colWidths.beta }} className="p-2 border-b border-[var(--border-primary)] text-right relative cursor-pointer hover:text-[var(--text-accent)]" onClick={() => handleSort('beta')}>
                            BETA {sortKey === 'beta' && (sortDir === 'asc' ? '▲' : '▼')}
                            <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => { e.stopPropagation(); handleResize('beta', e); }} />
                        </th>
                        <th style={{ width: colWidths.var }} className="p-2 border-b border-[var(--border-primary)] text-right relative cursor-pointer hover:text-[var(--text-accent)]" onClick={() => handleSort('varDollar')}>
                            VAR ($) {sortKey === 'varDollar' && (sortDir === 'asc' ? '▲' : '▼')}
                            <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => { e.stopPropagation(); handleResize('var', e); }} />
                        </th>
                        <th style={{ width: colWidths.pl }} className="p-2 border-b border-[var(--border-primary)] text-right relative cursor-pointer hover:text-[var(--text-accent)]" onClick={() => handleSort('pl')}>
                            P/L {sortKey === 'pl' && (sortDir === 'asc' ? '▲' : '▼')}
                            <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => { e.stopPropagation(); handleResize('pl', e); }} />
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {activePositions.map(pos => (
                        <tr key={pos.symbol} className="border-b border-[var(--border-primary)] hover:bg-[var(--bg-tertiary)] group">
                            <td className="p-2 font-bold text-[var(--text-primary)] truncate">{pos.symbol}</td>
                            <td className={`p-2 text-right whitespace-nowrap tabular-nums ${pos.netQty >= 0 ? 'text-[var(--success-color)]' : 'text-[var(--danger-color)]'}`}>
                                <div className="flex items-center justify-end gap-1">
                                    {pos.netQty.toLocaleString()}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); flattenPosition(pos.symbol); }}
                                        className="px-1 py-0.5 text-[8px] bg-amber-600/20 text-amber-500 border border-amber-600/30 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-amber-600 hover:text-white"
                                    >
                                        CL
                                    </button>
                                </div>
                            </td>
                            <td className="p-2 text-right text-[var(--text-secondary)] tabular-nums">{pos.cost.toFixed(2)}</td>
                            <td className="p-2 text-right text-[var(--text-secondary)] tabular-nums">{pos.beta.toFixed(2)}</td>
                            <td className="p-2 text-right text-[var(--text-secondary)] tabular-nums">${Math.floor(pos.varDollar).toLocaleString()}</td>
                            <td className={`p-2 text-right tabular-nums ${pos.pl >= 0 ? 'text-[var(--success-color)]' : 'text-[var(--danger-color)]'}`}>
                                {pos.pl >= 0 ? '+' : ''}{Math.floor(pos.pl).toLocaleString()}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default PositionsWidget;
