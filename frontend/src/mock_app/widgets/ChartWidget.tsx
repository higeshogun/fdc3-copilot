// Re-verifying ChartWidget
import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';
import { useSimulationStore } from '../store/useSimulationStore';


const ChartWidget = () => {
    const { instruments, selectedSymbol } = useSimulationStore();
    const [data, setData] = useState<{ time: string, value: number }[]>([]);

    useEffect(() => {
        const lastPrice = instruments[selectedSymbol || 'AAPL']?.last || 150;
        const dataPoints = [];
        let price = lastPrice;
        const now = Date.now();
        for (let i = 0; i < 50; i++) {
            const noise = Math.sin(i * 0.5) * 0.005 + (Math.cos(i * 0.2) * 0.005);
            price = price * (1 + noise);
            dataPoints.push({
                time: new Date(now - (50 - i) * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                value: price
            });
        }
        setData(dataPoints);
    }, [selectedSymbol, instruments]);

    const isPositive = (data[data.length - 1]?.value || 0) >= (data[0]?.value || 0);

    return (
        <div className="h-full w-full p-2 flex flex-col">
            <div className="text-xs text-[var(--text-secondary)] mb-2 flex justify-between">
                <span>{selectedSymbol} PRICE ACTION</span>
                <span className={isPositive ? 'text-[var(--success-color)]' : 'text-[var(--danger-color)]'}>
                    {isPositive ? '+' : ''}{((data[data.length - 1]?.value - data[0]?.value) / data[0]?.value * 100).toFixed(2)}%
                </span>
            </div>
            <div className="flex-grow min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={isPositive ? 'var(--success-color)' : 'var(--danger-color)'} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={isPositive ? 'var(--success-color)' : 'var(--danger-color)'} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <XAxis
                            dataKey="time"
                            stroke="var(--text-tertiary)"
                            tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            domain={['auto', 'auto']}
                            stroke="var(--text-tertiary)"
                            tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(val: number) => val.toFixed(2)}
                        />
                        <CartesianGrid stroke="var(--border-primary)" strokeDasharray="3 3" vertical={false} />
                        <Tooltip
                            contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', fontSize: '12px', borderRadius: '4px' }}
                            itemStyle={{ color: 'var(--text-primary)' }}
                            labelStyle={{ color: 'var(--text-secondary)' }}
                        />
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke={isPositive ? 'var(--success-color)' : 'var(--danger-color)'}
                            fillOpacity={1}
                            fill="url(#colorValue)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default ChartWidget;
