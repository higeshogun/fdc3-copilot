
import { useState, useEffect } from 'react';
import { useSimulationStore, getTickerPrecision } from '../store/useSimulationStore';
import { Button } from '../../shared/components/ui/Button';
import { Input } from '../../shared/components/ui/Input';
import { Select } from '../../shared/components/ui/Select';

const OrderEntryWidget = () => {
    const { submitOrder, selectedSymbol, instruments } = useSimulationStore();
    const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
    const [quantity, setQuantity] = useState(100);
    const [type, setType] = useState<'MARKET' | 'LIMIT'>('LIMIT');
    const [expiry, setExpiry] = useState<'DAY' | 'IOC' | 'GTC' | 'GTD'>('DAY');
    const [price, setPrice] = useState(0);

    const precision = selectedSymbol ? getTickerPrecision(selectedSymbol) : 2;

    useEffect(() => {
        if (selectedSymbol && instruments[selectedSymbol]) {
            setPrice(Number(instruments[selectedSymbol].last.toFixed(precision)));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedSymbol]);

    const handleSubmit = () => {
        if (!selectedSymbol) return;
        submitOrder({
            side,
            symbol: selectedSymbol,
            qty: quantity,
            type,
            expiry,
            price
        });
    };

    if (!selectedSymbol) {
        return <div className="p-4 text-center text-[var(--text-secondary)] text-xs">Select a symbol from the Watchlist to trade.</div>;
    }

    return (
        <div className="p-3 flex flex-col gap-3 h-full">
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

            <div className="space-y-3 flex-grow">
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

                <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase text-[var(--text-primary)] font-bold">Order Type</label>
                        <Select
                            value={type}
                            onChange={e => setType(e.target.value as 'MARKET' | 'LIMIT')}
                            className="font-medium"
                        >
                            <option value="MARKET">MARKET</option>
                            <option value="LIMIT">LIMIT</option>
                        </Select>
                    </div>
                    {type === 'LIMIT' ? (
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase text-[var(--text-primary)] font-bold">Price</label>
                            <Input
                                type="number"
                                step={1 / Math.pow(10, precision)}
                                value={price || ''}
                                onChange={e => {
                                    const val = e.target.value;
                                    setPrice(parseFloat(val));
                                }}
                                className="font-medium"
                            />
                        </div>
                    ) : (
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase text-[var(--text-secondary)] font-bold">Est. Price</label>
                            <div className="h-8 flex items-center px-1 text-sm font-mono text-[var(--text-secondary)]">
                                MARKET
                            </div>
                        </div>
                    )}
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
