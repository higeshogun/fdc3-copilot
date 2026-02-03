import { useState } from 'react';
import { Clock, Filter } from 'lucide-react';
import { useSimulationStore } from '../store/useSimulationStore';

const MOCK_NEWS = [
    { id: 1, time: '13:45', headline: 'Treasury yields spike following unexpected inflation data.', sentiment: 'negative', related: ['US10Y', 'US30Y', 'US2Y'] },
    { id: 2, time: '13:12', headline: 'GBP/USD touches 3-month high on BOE hawkishness.', sentiment: 'positive', related: ['GBP/USD', 'EUR/USD'] },
    { id: 3, time: '12:50', headline: 'NVDA earnings expectations reach fever pitch.', sentiment: 'neutral', related: ['NVDA', 'MSFT'] },
    { id: 4, time: '11:05', headline: 'Fed Governor signals patience on rate cuts.', sentiment: 'negative', related: ['US10Y'] },
    { id: 5, time: '10:30', headline: 'Apple unveils new VR headset prototype.', sentiment: 'positive', related: ['AAPL'] },
    { id: 6, time: '10:15', headline: 'Microsoft Azure gains market share in cloud computing.', sentiment: 'positive', related: ['MSFT'] },
    { id: 7, time: '09:45', headline: 'Tesla production numbers beat estimates.', sentiment: 'positive', related: ['TSLA'] },
    { id: 8, time: '09:00', headline: 'Yen weakens as BOJ maintains yield curve control.', sentiment: 'negative', related: ['USD/JPY', 'EUR/USD'] },
];

const NewsWidget = () => {
    const { selectedSymbol } = useSimulationStore();
    const [isFiltered, setIsFiltered] = useState(false);

    const filteredNews = isFiltered
        ? MOCK_NEWS.filter(n => n.related.includes(selectedSymbol))
        : MOCK_NEWS;

    return (
        <div className="h-full flex flex-col bg-[var(--bg-primary)]">
            <div className="flex items-center justify-between p-2 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]">
                <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Market News</span>
                <label className="flex items-center gap-1.5 cursor-pointer group">
                    <input
                        type="checkbox"
                        checked={isFiltered}
                        onChange={(e) => setIsFiltered(e.target.checked)}
                        className="hidden"
                    />
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isFiltered ? 'bg-[var(--accent-color)] border-[var(--accent-color)]' : 'border-[var(--border-primary)] bg-[var(--bg-primary)]'}`}>
                        <Filter size={10} className={isFiltered ? 'text-white' : 'text-[var(--text-secondary)]'} />
                    </div>
                    <span className="text-[10px] text-[var(--text-secondary)] font-bold uppercase group-hover:text-[var(--text-primary)] transition-colors">Filter</span>
                </label>
            </div>
            <div className="flex-grow overflow-auto custom-scrollbar">
                {filteredNews.length > 0 ? (
                    filteredNews.map(news => (
                        <div key={news.id} className="p-3 border-b border-[var(--border-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer group">
                            <div className="flex items-center gap-2 text-[10px] text-[var(--text-secondary)] mb-1">
                                <Clock size={10} />
                                <span className="font-mono">{news.time}</span>
                                <div className={`w-1.5 h-1.5 rounded-full ml-auto ${news.sentiment === 'positive' ? 'bg-[var(--success-color)]' :
                                    news.sentiment === 'negative' ? 'bg-[var(--danger-color)]' : 'bg-[var(--text-secondary)]'
                                    }`}></div>
                            </div>
                            <div className="text-sm text-[var(--text-primary)] group-hover:text-[var(--accent-color)] transition-colors leading-tight font-medium">
                                {news.headline}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="p-10 text-center text-[var(--text-tertiary)] italic text-xs">
                        No recent news for {selectedSymbol}
                    </div>
                )}
            </div>
        </div>
    );
};

export default NewsWidget;
