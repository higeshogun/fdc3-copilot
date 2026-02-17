import { useState, useEffect } from 'react';
import { Calendar, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface EconomicEvent {
    time: string;
    currency: string;
    event: string;
    actual: string;
    forecast: string;
    previous: string;
    impact: 'high' | 'medium' | 'low';
}

const EconomicCalendarWidget = () => {
    const [events, setEvents] = useState<EconomicEvent[]>([]);
    const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

    const fetchCalendar = async () => {
        try {
            // FXStreet calendar would require API key and backend proxy due to CORS
            // Using mock data for now
            setEvents(getMockEvents());
        } catch (err) {
            console.error('Failed to fetch calendar:', err);
            setEvents(getMockEvents());
        }
    };

    const getMockEvents = (): EconomicEvent[] => {
        const now = new Date();
        return [
            {
                time: new Date(now.getTime() + 3600000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                currency: 'USD',
                event: 'Non-Farm Payrolls',
                actual: '--',
                forecast: '185K',
                previous: '199K',
                impact: 'high'
            },
            {
                time: new Date(now.getTime() + 7200000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                currency: 'EUR',
                event: 'ECB Interest Rate Decision',
                actual: '--',
                forecast: '4.00%',
                previous: '4.00%',
                impact: 'high'
            },
            {
                time: new Date(now.getTime() + 10800000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                currency: 'GBP',
                event: 'GDP Growth Rate QoQ',
                actual: '--',
                forecast: '0.2%',
                previous: '0.1%',
                impact: 'medium'
            },
            {
                time: new Date(now.getTime() + 14400000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                currency: 'JPY',
                event: 'Tokyo CPI YoY',
                actual: '--',
                forecast: '2.5%',
                previous: '2.6%',
                impact: 'medium'
            },
            {
                time: new Date(now.getTime() + 18000000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                currency: 'AUD',
                event: 'RBA Meeting Minutes',
                actual: '--',
                forecast: '--',
                previous: '--',
                impact: 'low'
            },
            {
                time: new Date(now.getTime() + 21600000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                currency: 'CAD',
                event: 'Retail Sales MoM',
                actual: '--',
                forecast: '0.4%',
                previous: '0.6%',
                impact: 'medium'
            }
        ];
    };

    useEffect(() => {
        fetchCalendar();
        const interval = setInterval(fetchCalendar, 600000); // Refresh every 10 minutes
        return () => clearInterval(interval);
    }, []);

    const filteredEvents = filter === 'all'
        ? events
        : events.filter(e => e.impact === filter);

    const getImpactColor = (impact: string) => {
        switch (impact) {
            case 'high': return 'text-red-500';
            case 'medium': return 'text-yellow-500';
            case 'low': return 'text-blue-500';
            default: return 'text-[var(--text-secondary)]';
        }
    };

    const getImpactIcon = (impact: string) => {
        switch (impact) {
            case 'high': return <TrendingUp className="w-3 h-3" />;
            case 'medium': return <Minus className="w-3 h-3" />;
            case 'low': return <TrendingDown className="w-3 h-3" />;
            default: return null;
        }
    };

    return (
        <div className="h-full flex flex-col">
            <div className="p-2 border-b border-[var(--border-primary)] flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[var(--text-secondary)]" />
                <div className="flex gap-1 flex-1">
                    {(['all', 'high', 'medium', 'low'] as const).map((level) => (
                        <button
                            key={level}
                            onClick={() => setFilter(level)}
                            className={`px-2 py-0.5 text-[10px] rounded transition-colors ${filter === level
                                    ? 'bg-[var(--accent-color)] text-white'
                                    : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                                }`}
                        >
                            {level.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar">
                {filteredEvents.length === 0 && (
                    <div className="p-4 text-center text-[var(--text-tertiary)] text-xs">
                        No events for selected filter
                    </div>
                )}
                {filteredEvents.map((event, idx) => (
                    <div
                        key={idx}
                        className="p-3 border-b border-[var(--border-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                    >
                        <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-[var(--text-secondary)] bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded">
                                    {event.time}
                                </span>
                                <span className="text-xs font-bold text-[var(--text-primary)]">
                                    {event.currency}
                                </span>
                            </div>
                            <div className={`flex items-center gap-1 ${getImpactColor(event.impact)}`}>
                                {getImpactIcon(event.impact)}
                                <span className="text-[9px] font-bold uppercase">{event.impact}</span>
                            </div>
                        </div>

                        <div className="text-xs text-[var(--text-primary)] mb-2 font-medium">
                            {event.event}
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-[10px]">
                            <div>
                                <div className="text-[var(--text-tertiary)] mb-0.5">Actual</div>
                                <div className="font-bold text-[var(--text-primary)]">{event.actual}</div>
                            </div>
                            <div>
                                <div className="text-[var(--text-tertiary)] mb-0.5">Forecast</div>
                                <div className="font-bold text-[var(--text-secondary)]">{event.forecast}</div>
                            </div>
                            <div>
                                <div className="text-[var(--text-tertiary)] mb-0.5">Previous</div>
                                <div className="font-bold text-[var(--text-secondary)]">{event.previous}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default EconomicCalendarWidget;
