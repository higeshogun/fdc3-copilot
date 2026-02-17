import { useState, useMemo, useEffect } from 'react';
import { useSimulationStore } from '../store/useSimulationStore';
import { API_BASE_URL } from '../config';

const PositionsWidget = () => {
    // Keep store only for instruments/market data lookup
    const { instruments, flattenPosition } = useSimulationStore();
    const [ibkrPositions, setIbkrPositions] = useState<any[]>([]);
    const [useLive] = useState(true);

    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [colWidths, setColWidths] = useState({
        sym: 90,
        secType: 70,
        qty: 80,
        avgCost: 90,
        mktPx: 90,
        mktVal: 100,
        unrealPL: 100,
        realPL: 90,
        pctChg: 70
    });

    // Poll IBKR Positions
    useEffect(() => {
        if (!useLive) return;

        const fetchPositions = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/mcp/positions`);
                const data = await res.json();

                let positionsList: any[] = [];

                if (Array.isArray(data)) {
                    positionsList = data;
                } else if (data && Array.isArray(data.positions)) {
                    positionsList = data.positions;
                }

                if (positionsList.length > 0) {
                    setIbkrPositions(positionsList.map((p: any) => ({
                        symbol: p.contractDesc || p.symbol || 'UNK',
                        secType: p.assetClass || 'STK',
                        conid: p.conid || p.contractId || 0,
                        netQty: p.position || p.qty || 0,
                        avgCost: p.avgCost || p.avgPrice || 0,
                        currentPx: p.mktPrice || p.marketPrice || 0,
                        mktValue: p.mktValue || p.marketValue || 0,
                        unrealPL: p.unrealizedPnl || p.unrealizedPL || 0,
                        realPL: p.realizedPnl || p.realizedPL || 0,
                        currency: p.currency || 'USD'
                    })));
                } else {
                    setIbkrPositions([]);
                }
            } catch (err) {
                console.error("Failed to fetch IBKR positions", err);
            }
        };

        fetchPositions();
        const interval = setInterval(fetchPositions, 3000); // Poll every 3s
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

    const activePositions = useMemo(() => {
        const data = [...ibkrPositions];

        // Enrich with current market data if available from store/instruments
        const enriched = data.map(p => {
            // If we have live market data for this symbol in instruments store, use it to update price/PL
            const livePx = instruments[p.symbol]?.last;
            if (livePx && p.avgCost > 0) {
                const mktVal = livePx * p.netQty;
                const unrealPL = (livePx - p.avgCost) * p.netQty;
                const pctChg = ((livePx - p.avgCost) / p.avgCost) * 100;
                return {
                    ...p,
                    currentPx: livePx,
                    mktValue: mktVal,
                    unrealPL: unrealPL,
                    pctChg: pctChg
                };
            }
            // Calculate from existing data if no live price
            const pctChg = p.avgCost > 0 ? ((p.currentPx - p.avgCost) / p.avgCost) * 100 : 0;
            return { ...p, pctChg };
        });

        if (sortKey) {
            enriched.sort((a, b) => {
                const vA = a[sortKey as keyof typeof a];
                const vB = b[sortKey as keyof typeof b];
                if (vA === undefined || vB === undefined) return 0;
                if (vA < vB) return sortDir === 'asc' ? -1 : 1;
                if (vA > vB) return sortDir === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return enriched;
    }, [ibkrPositions, instruments, sortKey, sortDir]);

    return (
        <div className="h-full overflow-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs table-fixed">
                <thead>
                    <tr className="bg-[var(--bg-tertiary)] text-[var(--text-secondary)] sticky top-0 z-10">
                        <th style={{ width: colWidths.sym }} className="p-2 border-b border-[var(--border-primary)] relative cursor-pointer hover:text-[var(--text-accent)]" onClick={() => handleSort('symbol')}>
                            SYMBOL {sortKey === 'symbol' && (sortDir === 'asc' ? '▲' : '▼')}
                            <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => { e.stopPropagation(); handleResize('sym', e); }} />
                        </th>
                        <th style={{ width: colWidths.secType }} className="p-2 border-b border-[var(--border-primary)] relative cursor-pointer hover:text-[var(--text-accent)]" onClick={() => handleSort('secType')}>
                            TYPE {sortKey === 'secType' && (sortDir === 'asc' ? '▲' : '▼')}
                            <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => { e.stopPropagation(); handleResize('secType', e); }} />
                        </th>
                        <th style={{ width: colWidths.qty }} className="p-2 border-b border-[var(--border-primary)] text-right relative cursor-pointer hover:text-[var(--text-accent)]" onClick={() => handleSort('netQty')}>
                            QTY {sortKey === 'netQty' && (sortDir === 'asc' ? '▲' : '▼')}
                            <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => { e.stopPropagation(); handleResize('qty', e); }} />
                        </th>
                        <th style={{ width: colWidths.avgCost }} className="p-2 border-b border-[var(--border-primary)] text-right relative cursor-pointer hover:text-[var(--text-accent)]" onClick={() => handleSort('avgCost')}>
                            AVG COST {sortKey === 'avgCost' && (sortDir === 'asc' ? '▲' : '▼')}
                            <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => { e.stopPropagation(); handleResize('avgCost', e); }} />
                        </th>
                        <th style={{ width: colWidths.mktPx }} className="p-2 border-b border-[var(--border-primary)] text-right relative cursor-pointer hover:text-[var(--text-accent)]" onClick={() => handleSort('currentPx')}>
                            MKT PX {sortKey === 'currentPx' && (sortDir === 'asc' ? '▲' : '▼')}
                            <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => { e.stopPropagation(); handleResize('mktPx', e); }} />
                        </th>
                        <th style={{ width: colWidths.mktVal }} className="p-2 border-b border-[var(--border-primary)] text-right relative cursor-pointer hover:text-[var(--text-accent)]" onClick={() => handleSort('mktValue')}>
                            MKT VALUE {sortKey === 'mktValue' && (sortDir === 'asc' ? '▲' : '▼')}
                            <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => { e.stopPropagation(); handleResize('mktVal', e); }} />
                        </th>
                        <th style={{ width: colWidths.unrealPL }} className="p-2 border-b border-[var(--border-primary)] text-right relative cursor-pointer hover:text-[var(--text-accent)]" onClick={() => handleSort('unrealPL')}>
                            UNREAL P/L {sortKey === 'unrealPL' && (sortDir === 'asc' ? '▲' : '▼')}
                            <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => { e.stopPropagation(); handleResize('unrealPL', e); }} />
                        </th>
                        <th style={{ width: colWidths.realPL }} className="p-2 border-b border-[var(--border-primary)] text-right relative cursor-pointer hover:text-[var(--text-accent)]" onClick={() => handleSort('realPL')}>
                            REAL P/L {sortKey === 'realPL' && (sortDir === 'asc' ? '▲' : '▼')}
                            <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => { e.stopPropagation(); handleResize('realPL', e); }} />
                        </th>
                        <th style={{ width: colWidths.pctChg }} className="p-2 border-b border-[var(--border-primary)] text-right relative cursor-pointer hover:text-[var(--text-accent)]" onClick={() => handleSort('pctChg')}>
                            % CHG {sortKey === 'pctChg' && (sortDir === 'asc' ? '▲' : '▼')}
                            <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => { e.stopPropagation(); handleResize('pctChg', e); }} />
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {activePositions.length === 0 && (
                        <tr>
                            <td colSpan={9} className="p-4 text-center text-[var(--text-tertiary)] italic">
                                No Open Positions
                            </td>
                        </tr>
                    )}
                    {activePositions.map((pos, idx) => (
                        <tr key={pos.symbol || idx} className="border-b border-[var(--border-primary)] hover:bg-[var(--bg-tertiary)] group">
                            <td className="p-2 font-bold text-[var(--text-primary)] truncate">{pos.symbol}</td>
                            <td className="p-2 text-[var(--text-secondary)] text-xs truncate">{pos.secType}</td>
                            <td className={`p-2 text-right whitespace-nowrap tabular-nums ${pos.netQty >= 0 ? 'text-[var(--success-color)]' : 'text-[var(--danger-color)]'}`}>
                                <div className="flex items-center justify-end gap-1">
                                    {pos.netQty.toLocaleString()}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); flattenPosition(pos.symbol); }}
                                        className="px-1 py-0.5 text-[8px] bg-amber-600/20 text-amber-500 border border-amber-600/30 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-amber-600 hover:text-white"
                                    >
                                        CLOSE
                                    </button>
                                </div>
                            </td>
                            <td className="p-2 text-right text-[var(--text-secondary)] tabular-nums">{pos.avgCost.toFixed(2)}</td>
                            <td className="p-2 text-right text-[var(--text-secondary)] tabular-nums">{pos.currentPx.toFixed(2)}</td>
                            <td className="p-2 text-right text-[var(--text-secondary)] tabular-nums">${pos.mktValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className={`p-2 text-right tabular-nums font-medium ${pos.unrealPL >= 0 ? 'text-[var(--success-color)]' : 'text-[var(--danger-color)]'}`}>
                                {pos.unrealPL >= 0 ? '+' : ''}{pos.unrealPL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className={`p-2 text-right tabular-nums ${pos.realPL >= 0 ? 'text-[var(--success-color)]' : 'text-[var(--danger-color)]'}`}>
                                {pos.realPL >= 0 ? '+' : ''}{pos.realPL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className={`p-2 text-right tabular-nums font-medium ${pos.pctChg >= 0 ? 'text-[var(--success-color)]' : 'text-[var(--danger-color)]'}`}>
                                {pos.pctChg >= 0 ? '+' : ''}{pos.pctChg.toFixed(2)}%
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default PositionsWidget;
