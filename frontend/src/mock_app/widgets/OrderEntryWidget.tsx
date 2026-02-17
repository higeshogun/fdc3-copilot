
import { useState, useEffect } from 'react';
import { useSimulationStore, getTickerPrecision } from '../store/useSimulationStore';
import { Button } from '../../shared/components/ui/Button';
import { Input } from '../../shared/components/ui/Input';
import { Select } from '../../shared/components/ui/Select';

type OrderType = 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT' | 'TRAIL' | 'TRAILLMT';

const OrderEntryWidget = () => {
    const { submitOrder, selectedSymbol, instruments } = useSimulationStore();
    const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
    const [quantity, setQuantity] = useState(100);
    const [type, setType] = useState<OrderType>('LIMIT');
    const [expiry, setExpiry] = useState<'DAY' | 'IOC' | 'GTC' | 'GTD'>('DAY');
    const [price, setPrice] = useState(0);
    const [auxPrice, setAuxPrice] = useState(0); // Stop price for STOP_LIMIT, TRAILLMT
    const [trailingAmt, setTrailingAmt] = useState(1.0);
    const [trailingType, setTrailingType] = useState<'amt' | '%'>('amt');
    const [allOrNone, setAllOrNone] = useState(false);
    const [outsideRTH, setOutsideRTH] = useState(false);

    const precision = selectedSymbol ? getTickerPrecision(selectedSymbol) : 2;

    useEffect(() => {
        if (selectedSymbol && instruments[selectedSymbol]) {
            const lastPrice = Number(instruments[selectedSymbol].last.toFixed(precision));
            setPrice(lastPrice);
            // Set default stop price slightly below/above current price
            setAuxPrice(side === 'BUY' ? lastPrice * 0.98 : lastPrice * 1.02);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedSymbol]);

    const handleSubmit = () => {
        if (!selectedSymbol) return;

        const order: any = {
            side,
            symbol: selectedSymbol,
            qty: quantity,
            type,
            expiry,
            price,
            allOrNone,
            outsideRTH
        };

        // Add auxPrice for STOP_LIMIT and TRAILLMT
        if (type === 'STOP_LIMIT' || type === 'TRAILLMT') {
            order.auxPrice = auxPrice;
        }

        // Add trailing fields for TRAIL and TRAILLMT
        if (type === 'TRAIL' || type === 'TRAILLMT') {
            order.trailingAmt = trailingAmt;
            order.trailingType = trailingType;
        }

        submitOrder(order);
    };

    if (!selectedSymbol) {
        return <div className="p-4 text-center text-[var(--text-secondary)] text-xs">Select a symbol from the Watchlist to trade.</div>;
    }

    // Determine which fields to show based on order type
    const showLimitPrice = ['LIMIT', 'STOP_LIMIT', 'TRAILLMT'].includes(type);
    const showStopPrice = ['STOP', 'STOP_LIMIT', 'TRAILLMT'].includes(type);
    const showTrailing = ['TRAIL', 'TRAILLMT'].includes(type);

    return (
        <div className="p-3 flex flex-col gap-2 h-full overflow-y-auto">
            <div className="flex justify-between items-end mb-1">
                <div className="flex flex-col">
                    <div className="text-xs uppercase text-[var(--text-secondary)] font-bold leading-none mb-1">Instrument</div>
                    <div className="text-lg font-bold tracking-tight text-[var(--text-primary)] leading-none">{selectedSymbol}</div>
                </div>
                <div className="flex gap-4 items-end">
                    <div className="flex flex-col items-end">
                        <span className="text-[9px] uppercase text-[var(--text-secondary)] font-bold">Bid</span>
                        <span className="text-sm font-mono font-bold text-[var(--success-color)]">
                            {instruments[selectedSymbol]?.bid.toFixed(precision)}
                        </span>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-[9px] uppercase text-[var(--text-secondary)] font-bold">Ask</span>
                        <span className="text-sm font-mono font-bold text-[var(--danger-color)]">
                            {instruments[selectedSymbol]?.ask.toFixed(precision)}
                        </span>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-[9px] uppercase text-[var(--text-secondary)] font-bold">Last</span>
                        <span className="text-sm font-mono text-[var(--text-primary)]">
                            {instruments[selectedSymbol]?.last.toFixed(precision)}
                        </span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <Button
                    size="sm"
                    variant={side === 'BUY' ? 'primary' : 'secondary'}
                    onClick={() => setSide('BUY')}
                    className="w-full font-bold"
                >
                    BUY
                </Button>
                <Button
                    size="sm"
                    variant={side === 'SELL' ? 'danger' : 'secondary'}
                    onClick={() => setSide('SELL')}
                    className="w-full font-bold"
                >
                    SELL
                </Button>
            </div>

            <div className="space-y-2 flex-grow">
                <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase text-[var(--text-primary)] font-bold">Quantity</label>
                        <Input
                            type="number"
                            value={quantity}
                            onChange={e => setQuantity(Number(e.target.value))}
                            className="font-medium"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase text-[var(--text-primary)] font-bold">Expiry</label>
                        <Select
                            value={expiry}
                            onChange={e => setExpiry(e.target.value as 'DAY' | 'IOC' | 'GTC' | 'GTD')}
                            className="font-medium"
                        >
                            <option value="DAY">DAY</option>
                            <option value="IOC">IOC</option>
                            <option value="GTC">GTC</option>
                            <option value="GTD">GTD</option>
                        </Select>
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] uppercase text-[var(--text-primary)] font-bold">Order Type</label>
                    <Select
                        value={type}
                        onChange={e => setType(e.target.value as OrderType)}
                        className="font-medium"
                    >
                        <option value="MARKET">MARKET</option>
                        <option value="LIMIT">LIMIT</option>
                        <option value="STOP">STOP</option>
                        <option value="STOP_LIMIT">STOP LIMIT</option>
                        <option value="TRAIL">TRAIL</option>
                        <option value="TRAILLMT">TRAIL LIMIT</option>
                    </Select>
                </div>

                {/* Limit Price Field */}
                {showLimitPrice && (
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase text-[var(--text-primary)] font-bold">Limit Price</label>
                        <Input
                            type="number"
                            step={1 / Math.pow(10, precision)}
                            value={price || ''}
                            onChange={e => setPrice(parseFloat(e.target.value))}
                            className="font-medium"
                        />
                    </div>
                )}

                {/* Stop Price Field (auxPrice) */}
                {showStopPrice && (
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase text-[var(--text-primary)] font-bold">Stop Price</label>
                        <Input
                            type="number"
                            step={1 / Math.pow(10, precision)}
                            value={auxPrice || ''}
                            onChange={e => setAuxPrice(parseFloat(e.target.value))}
                            className="font-medium"
                        />
                    </div>
                )}

                {/* Trailing Fields */}
                {showTrailing && (
                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase text-[var(--text-primary)] font-bold">Trail Amount</label>
                            <Input
                                type="number"
                                step="0.01"
                                value={trailingAmt || ''}
                                onChange={e => setTrailingAmt(parseFloat(e.target.value))}
                                className="font-medium"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase text-[var(--text-primary)] font-bold">Trail Type</label>
                            <Select
                                value={trailingType}
                                onChange={e => setTrailingType(e.target.value as 'amt' | '%')}
                                className="font-medium"
                            >
                                <option value="amt">Amount</option>
                                <option value="%">Percent</option>
                            </Select>
                        </div>
                    </div>
                )}

                {/* Advanced Options */}
                <div className="space-y-2 pt-2 border-t border-[var(--border-primary)]">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={allOrNone}
                            onChange={e => setAllOrNone(e.target.checked)}
                            className="w-4 h-4"
                        />
                        <span className="text-[10px] uppercase text-[var(--text-primary)] font-bold">All or None</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={outsideRTH}
                            onChange={e => setOutsideRTH(e.target.checked)}
                            className="w-4 h-4"
                        />
                        <span className="text-[10px] uppercase text-[var(--text-primary)] font-bold">Outside RTH</span>
                    </label>
                </div>
            </div>

            <Button
                variant={side === 'BUY' ? 'primary' : 'danger'}
                onClick={handleSubmit}
                className="w-full mt-auto shadow-lg"
            >
                SUBMIT {side}
            </Button>
        </div>
    );
};

export default OrderEntryWidget;
