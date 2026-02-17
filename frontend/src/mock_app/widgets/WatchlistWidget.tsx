import { useState } from 'react';
import { useSimulationStore, getTickerPrecision } from '../store/useSimulationStore';
import { Search, Plus, X, GripVertical } from 'lucide-react';
import { API_BASE_URL } from '../config';

interface SearchResult {
    symbol: string;
    name: string;
    conid: string;
    assetClass: string;
}

const WatchlistWidget = () => {
    const {
        instruments,
        selectSymbol,
        selectedSymbol,
        addInstrument,
        removeInstrument,
        reorderInstruments
    } = useSimulationStore();

    const [sortConfig, setSortConfig] = useState<{ key: keyof typeof instruments['AAPL'], direction: 'asc' | 'desc' } | null>(null);
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    // Get watchlist order from instruments
    const watchlistSymbols = Object.keys(instruments);

    const sortedInstruments = sortConfig
        ? Object.values(instruments).sort((a, b) => {
            const { key, direction } = sortConfig;
            if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
            if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
            return 0;
        })
        : watchlistSymbols.map(sym => instruments[sym]);

    const handleSort = (key: keyof typeof instruments['AAPL']) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const searchIBKRContracts = async (query: string) => {
        if (!query || query.length < 2) {
            setSearchResults([]);
            return;
        }

        setSearching(true);
        try {
            const response = await fetch(`${API_BASE_URL}/mcp/search?symbol=${encodeURIComponent(query)}`);
            const data = await response.json();

            if (Array.isArray(data)) {
                const results: SearchResult[] = data.map((item: any) => ({
                    symbol: item.symbol || item.ticker || query.toUpperCase(),
                    name: item.companyName || item.name || item.description || '',
                    conid: item.conid || '',
                    assetClass: item.assetClass || item.secType || 'STK'
                }));
                // Deduplicate by symbol
                const seen = new Set();
                const uniqueResults = results.filter(r => {
                    const uniqueKey = r.symbol + r.assetClass;
                    if (seen.has(uniqueKey)) return false;
                    seen.add(uniqueKey);
                    return true;
                });
                setSearchResults(uniqueResults.slice(0, 10)); // Limit to 10 results
            } else {
                setSearchResults([]);
            }
        } catch (err) {
            console.error('Failed to search IBKR contracts:', err);
            // Fallback to simple mock search
            setSearchResults([{
                symbol: query.toUpperCase(),
                name: 'Add as Stock',
                conid: '',
                assetClass: 'STK'
            }]);
        } finally {
            setSearching(false);
        }
    };

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        // Debounce search
        const timeoutId = setTimeout(() => searchIBKRContracts(value), 300);
        return () => clearTimeout(timeoutId);
    };

    const handleAddInstrument = async (result: SearchResult) => {
        await addInstrument(result.symbol, result.assetClass);
        setSearchQuery('');
        setSearchResults([]);
        setShowSearch(false);
    };

    const handleRemoveInstrument = (symbol: string, e: React.MouseEvent) => {
        e.stopPropagation();
        removeInstrument(symbol);
    };

    // Drag and drop handlers
    const handleDragStart = (index: number) => {
        setDraggedIndex(index);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;

        // Reorder the instruments
        const newOrder = [...watchlistSymbols];
        const draggedSymbol = newOrder[draggedIndex];
        newOrder.splice(draggedIndex, 1);
        newOrder.splice(index, 0, draggedSymbol);

        reorderInstruments(newOrder);
        setDraggedIndex(index);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
    };

    return (
        <div className="h-full flex flex-col">
            {/* Search Bar */}
            <div className="p-2 border-b border-[var(--border-primary)] flex items-center gap-2">
                {!showSearch ? (
                    <button
                        onClick={() => setShowSearch(true)}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-[var(--accent-color)] text-white rounded hover:opacity-90 transition-opacity"
                    >
                        <Plus className="w-3 h-3" />
                        Add Instrument
                    </button>
                ) : (
                    <div className="flex-1 relative">
                        <div className="flex items-center gap-2">
                            <div className="flex-1 relative">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--text-tertiary)]" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => handleSearchChange(e.target.value)}
                                    placeholder="Search IBKR contracts..."
                                    className="w-full pl-7 pr-2 py-1 text-xs bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded focus:outline-none focus:border-[var(--accent-color)]"
                                    autoFocus
                                />
                            </div>
                            <button
                                onClick={() => {
                                    setShowSearch(false);
                                    setSearchQuery('');
                                    setSearchResults([]);
                                }}
                                className="p-1 hover:bg-[var(--bg-tertiary)] rounded"
                            >
                                <X className="w-3 h-3 text-[var(--text-secondary)]" />
                            </button>
                        </div>

                        {/* Search Results Dropdown */}
                        {searchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded shadow-lg z-50 max-h-60 overflow-auto">
                                {searchResults.map((result, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => handleAddInstrument(result)}
                                        className="p-2 hover:bg-[var(--bg-tertiary)] cursor-pointer border-b border-[var(--border-primary)] last:border-b-0"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <div className="text-xs font-bold text-[var(--text-primary)]">{result.symbol}</div>
                                                <div className="text-[10px] text-[var(--text-tertiary)] truncate">{result.name}</div>
                                            </div>
                                            <div className="text-[9px] text-[var(--text-secondary)] bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded">
                                                {result.assetClass}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {searching && (
                            <div className="absolute top-full left-0 right-0 mt-1 p-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded text-xs text-[var(--text-secondary)] text-center">
                                Searching...
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Watchlist Table */}
            <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full text-left border-collapse text-xs">
                    <thead>
                        <tr className="bg-[var(--bg-tertiary)] text-[var(--text-secondary)] font-medium sticky top-0 border-b border-[var(--border-primary)] select-none">
                            <th className="p-2 py-1.5 pl-3 w-8"></th>
                            <th
                                className="p-2 py-1.5 cursor-pointer hover:text-[var(--text-primary)] transition-colors"
                                onClick={() => handleSort('symbol')}
                            >
                                SYMBOL {sortConfig?.key === 'symbol' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th
                                className="p-2 py-1.5 text-right cursor-pointer hover:text-[var(--text-primary)] transition-colors"
                                onClick={() => handleSort('last')}
                            >
                                LAST {sortConfig?.key === 'last' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th
                                className="p-2 py-1.5 text-right cursor-pointer hover:text-[var(--text-primary)] transition-colors"
                                onClick={() => handleSort('chg')}
                            >
                                CHG {sortConfig?.key === 'chg' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="p-2 py-1.5 pr-3 w-8"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedInstruments.map((inst, index) => (
                            <tr
                                key={inst.symbol}
                                draggable={!sortConfig}
                                onDragStart={() => handleDragStart(index)}
                                onDragOver={(e) => handleDragOver(e, index)}
                                onDragEnd={handleDragEnd}
                                onClick={() => selectSymbol(inst.symbol)}
                                className={`cursor-pointer hover:bg-[var(--bg-tertiary)] border-b border-[var(--border-primary)]/50 transition-colors group ${selectedSymbol === inst.symbol
                                    ? 'bg-[var(--accent-color)]/10 border-l-2 border-l-[var(--accent-color)]'
                                    : 'border-l-2 border-l-transparent'
                                    } ${draggedIndex === index ? 'opacity-50' : ''}`}
                            >
                                <td className="p-2 py-2 pl-3">
                                    {!sortConfig && (
                                        <GripVertical className="w-3 h-3 text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
                                    )}
                                </td>
                                <td className="p-2 py-2 font-bold text-[var(--text-primary)]">{inst.symbol}</td>
                                <td className="p-2 py-2 text-right text-[var(--text-secondary)] font-mono tracking-wide">
                                    {inst.last.toFixed(getTickerPrecision(inst.symbol))}
                                </td>
                                <td className={`p-2 py-2 text-right font-mono ${inst.chg >= 0 ? 'text-[var(--success-color)]' : 'text-[var(--danger-color)]'}`}>
                                    {inst.chg >= 0 ? '+' : ''}{inst.chg}%
                                </td>
                                <td className="p-2 py-2 pr-3">
                                    <button
                                        onClick={(e) => handleRemoveInstrument(inst.symbol, e)}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-red-500/20 rounded"
                                        title="Remove"
                                    >
                                        <X className="w-3 h-3 text-red-500" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default WatchlistWidget;
