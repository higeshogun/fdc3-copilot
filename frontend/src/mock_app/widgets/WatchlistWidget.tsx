
import { useState } from 'react';
import { useSimulationStore, getTickerPrecision } from '../store/useSimulationStore';

const WatchlistWidget = () => {
    const { instruments, selectSymbol, selectedSymbol } = useSimulationStore();
    // ... rest same ...
    const [sortConfig, setSortConfig] = useState<{ key: keyof typeof instruments['AAPL'], direction: 'asc' | 'desc' } | null>(null);

    const sortedInstruments = Object.values(instruments).sort((a, b) => {
        if (!sortConfig) return 0;
        const { key, direction } = sortConfig;
        if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
        if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    const handleSort = (key: keyof typeof instruments['AAPL']) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    return (
        <div className="h-full overflow-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
                <thead>
                    <tr className="bg-[var(--bg-tertiary)] text-[var(--text-secondary)] font-medium sticky top-0 border-b border-[var(--border-primary)] select-none">
                        <th
                            className="p-2 py-1.5 pl-3 cursor-pointer hover:text-[var(--text-primary)] transition-colors"
                            onClick={() => handleSort('symbol')}
                        >
                            SYM {sortConfig?.key === 'symbol' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th
                            className="p-2 py-1.5 text-right cursor-pointer hover:text-[var(--text-primary)] transition-colors"
                            onClick={() => handleSort('last')}
                        >
                            LAST {sortConfig?.key === 'last' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th
                            className="p-2 py-1.5 text-right pr-3 cursor-pointer hover:text-[var(--text-primary)] transition-colors"
                            onClick={() => handleSort('chg')}
                        >
                            CHG {sortConfig?.key === 'chg' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {sortedInstruments.map(inst => (
                        <tr
                            key={inst.symbol}
                            onClick={() => selectSymbol(inst.symbol)}
                            className={`cursor-pointer hover:bg-[var(--bg-tertiary)] border-b border-[var(--border-primary)]/50 transition-colors ${selectedSymbol === inst.symbol ? 'bg-[var(--accent-color)]/10 border-l-2 border-l-[var(--accent-color)]' : 'border-l-2 border-l-transparent'
                                }`}
                        >
                            <td className="p-2 py-2 pl-3 font-bold text-[var(--text-primary)]">{inst.symbol}</td>
                            <td className="p-2 py-2 text-right text-[var(--text-secondary)] font-mono tracking-wide">
                                {inst.last.toFixed(getTickerPrecision(inst.symbol))}
                            </td>
                            <td className={`p-2 py-2 pr-3 text-right font-mono ${inst.chg >= 0 ? 'text-[var(--success-color)]' : 'text-[var(--danger-color)]'}`}>
                                {inst.chg >= 0 ? '+' : ''}{inst.chg}%
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default WatchlistWidget;
