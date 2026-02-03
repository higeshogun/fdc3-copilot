
import { useState } from 'react';
import { useSimulationStore, getTickerPrecision } from '../store/useSimulationStore';
import { Input } from '../../shared/components/ui/Input';
import { Select } from '../../shared/components/ui/Select';

const QuickTradeWidget = () => {
    const { selectedSymbol, instruments, submitOrder } = useSimulationStore();
    const instrument = instruments[selectedSymbol];
    const [quantity, setQuantity] = useState(100);
    const [expiry, setExpiry] = useState<'DAY' | 'IOC' | 'GTC'>('DAY');

    const precision = getTickerPrecision(selectedSymbol);

    const formatFxPrice = (price: number) => {
        const p = price.toFixed(precision + 1); // 1 extra digit for big/pips layout if FX
        if (selectedSymbol.includes('/')) {
            const big = p.substring(0, p.length - 3);
            const pips = p.substring(p.length - 3, p.length - 1);
            const sub = p.substring(p.length - 1);
            return { big, pips, sub };
        } else {
            // Equity/Comm layout - just split by decimal or something similar
            const parts = price.toFixed(precision).split('.');
            return { big: parts[0] + '.', pips: parts[1] || '00', sub: '' };
        }
    };

    if (!instrument) return <div className="p-4 text-center text-[var(--text-secondary)] text-xs">Select a symbol</div>;

    const bid = instrument.bid;
    const ask = instrument.ask;

    const bidParts = formatFxPrice(bid);
    const askParts = formatFxPrice(ask);

    const handleQuickOrder = (side: 'BUY' | 'SELL', price: number, qty?: number) => {
        submitOrder({
            side,
            symbol: selectedSymbol,
            qty: qty || quantity,
            type: 'LIMIT',
            price: price,
            expiry
        });
    };

    // Simulated Dynamic Depth Ladder based on live prices
    const tickSize = selectedSymbol.includes('/') ? 0.0001 : (selectedSymbol.startsWith('US') ? 0.001 : 0.01);
    const depthLevels = [
        { level: 1, bidPx: bid - tickSize, bidQty: 500, askPx: ask + tickSize, askQty: 500 },
        { level: 2, bidPx: bid - tickSize * 2, bidQty: 1200, askPx: ask + tickSize * 2, askQty: 800 },
        { level: 3, bidPx: bid - tickSize * 3, bidQty: 2500, askPx: ask + tickSize * 3, askQty: 1500 },
        { level: 4, bidPx: bid - tickSize * 5, bidQty: 5000, askPx: ask + tickSize * 5, askQty: 3000 },
    ];

    return (
        <div className="h-full flex flex-col p-2 gap-2 text-xs">
            {/* Symbol Header */}
            <div className="font-bold text-lg text-[var(--text-primary)] mb-2">{selectedSymbol}</div>

            {/* Trading Tile (Buttons + Spread) */}
            <div className="flex items-stretch h-24 gap-1">
                {/* SELL Button (Bid) */}
                <button
                    onClick={() => handleQuickOrder('SELL', bid)}
                    className="flex-1 flex flex-col items-center justify-center bg-[var(--danger-color)] hover:opacity-90 text-white rounded-l border border-transparent transition-colors active:scale-[0.98] relative overflow-hidden group"
                >
                    <div className="absolute top-1 left-2 text-[10px] font-bold opacity-60 tracking-wider">SELL</div>
                    <div className="grid grid-cols-[auto_auto_auto] items-baseline gap-x-0.5 mt-2">
                        <span className="text-lg font-bold opacity-60 tracking-tighter text-right leading-none relative top-[1px]">{bidParts.big}</span>
                        <span className="text-3xl font-black tracking-tighter leading-none">{bidParts.pips}</span>
                        <span className="text-sm font-bold opacity-60 self-start mt-0.5">{bidParts.sub}</span>
                    </div>
                </button>

                {/* Spread Center */}
                <div className="w-12 flex flex-col items-center justify-center bg-[var(--bg-tertiary)] border-y border-[var(--border-primary)] z-10 shadow-xl relative">
                    <div className="h-full w-[1px] bg-[var(--border-primary)] absolute left-0" />
                    <div className="h-full w-[1px] bg-[var(--border-primary)] absolute right-0" />
                    <span className="text-[9px] text-[var(--text-secondary)] uppercase font-semibold">Spread</span>
                    <span className="text-sm font-mono text-[var(--text-primary)] font-bold">{(ask - bid).toFixed(precision)}</span>
                </div>

                {/* BUY Button (Ask) */}
                <button
                    onClick={() => handleQuickOrder('BUY', ask)}
                    className="flex-1 flex flex-col items-center justify-center bg-[var(--success-color)] hover:opacity-90 text-white rounded-r border border-transparent transition-colors active:scale-[0.98] relative overflow-hidden group"
                >
                    <div className="absolute top-1 right-2 text-[10px] font-bold opacity-60 tracking-wider">BUY</div>
                    <div className="grid grid-cols-[auto_auto_auto] items-baseline gap-x-0.5 mt-2">
                        <span className="text-lg font-bold opacity-60 tracking-tighter text-right leading-none relative top-[1px]">{askParts.big}</span>
                        <span className="text-3xl font-black tracking-tighter leading-none">{askParts.pips}</span>
                        <span className="text-sm font-bold opacity-60 self-start mt-0.5">{askParts.sub}</span>
                    </div>
                </button>
            </div>

            {/* Inputs Below Tile */}
            <div className="flex gap-2 justify-center mt-1 mb-2">
                <div className="w-24">
                    <Input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(Number(e.target.value))}
                        className="h-7 text-xs text-center font-mono bg-[var(--bg-primary)]"
                        placeholder="Qty"
                    />
                </div>
                <div className="w-24">
                    <Select
                        value={expiry}
                        onChange={(e) => setExpiry(e.target.value as 'DAY' | 'IOC' | 'GTC')}
                        className="h-7 text-xs bg-[var(--bg-primary)]"
                    >
                        <option value="DAY">DAY</option>
                        <option value="IOC">IOC</option>
                        <option value="GTC">GTC</option>
                    </Select>
                </div>
            </div>

            {/* Depth Ladder */}
            <div className="flex-grow bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded overflow-hidden min-h-0">
                <table className="w-full text-center">
                    <thead>
                        <tr className="text-[var(--text-secondary)] font-mono text-[10px] bg-[var(--bg-tertiary)] opacity-80">
                            <th className="py-1">QTY</th>
                            <th className="py-1 text-[var(--success-color)]">BID</th>
                            <th className="py-1 text-[var(--danger-color)]">ASK</th>
                            <th className="py-1">QTY</th>
                        </tr>
                    </thead>
                    <tbody className="font-mono text-[10px]">
                        {depthLevels.map((l, i) => (
                            <tr key={i} className="border-b border-[var(--border-primary)]/30 hover:bg-[var(--accent-color)]/10 transition-colors cursor-pointer group">
                                <td
                                    className="py-1 text-[var(--text-secondary)]"
                                    onClick={() => handleQuickOrder('SELL', l.bidPx, l.bidQty)}
                                >
                                    {l.bidQty.toLocaleString()}
                                </td>
                                <td
                                    className="py-1 text-[var(--success-color)] font-bold"
                                    onClick={() => handleQuickOrder('SELL', l.bidPx, l.bidQty)}
                                >
                                    {l.bidPx.toFixed(precision)}
                                </td>
                                <td
                                    className="py-1 text-[var(--danger-color)] font-bold"
                                    onClick={() => handleQuickOrder('BUY', l.askPx, l.askQty)}
                                >
                                    {l.askPx.toFixed(precision)}
                                </td>
                                <td
                                    className="py-1 text-[var(--text-secondary)]"
                                    onClick={() => handleQuickOrder('BUY', l.askPx, l.askQty)}
                                >
                                    {l.askQty.toLocaleString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default QuickTradeWidget;
