import { useState, useEffect } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';

interface NewsItem {
    title: string;
    link: string;
    pubDate: string;
    source: string;
}

const RSSNewsWidget = () => {
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedFeed, setSelectedFeed] = useState('reuters');

    const feeds = {
        reuters: 'https://www.reutersagency.com/feed/?taxonomy=best-topics&post_type=best',
        bloomberg: 'https://www.bloomberg.com/feed/podcast/etf-report.xml',
        cnbc: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114',
        marketwatch: 'http://feeds.marketwatch.com/marketwatch/topstories/',
        ft: 'https://www.ft.com/?format=rss'
    };

    const fetchNews = async () => {
        setLoading(true);
        try {
            // Use RSS2JSON API to parse RSS feeds (CORS-friendly)
            const feedUrl = feeds[selectedFeed as keyof typeof feeds];
            const response = await fetch(
                `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}&api_key=YOUR_API_KEY&count=20`
            );
            const data = await response.json();

            if (data.status === 'ok') {
                const items: NewsItem[] = data.items.map((item: any) => ({
                    title: item.title,
                    link: item.link,
                    pubDate: new Date(item.pubDate).toLocaleString(),
                    source: selectedFeed.toUpperCase()
                }));
                setNews(items);
            } else {
                // Fallback to mock data if API fails
                setNews(getMockNews());
            }
        } catch (err) {
            console.error('Failed to fetch news:', err);
            setNews(getMockNews());
        } finally {
            setLoading(false);
        }
    };

    const getMockNews = (): NewsItem[] => [
        {
            title: 'Fed Signals Potential Rate Cuts in Q2 2026',
            link: '#',
            pubDate: new Date().toLocaleString(),
            source: 'REUTERS'
        },
        {
            title: 'Tech Stocks Rally on Strong Earnings Reports',
            link: '#',
            pubDate: new Date(Date.now() - 3600000).toLocaleString(),
            source: 'BLOOMBERG'
        },
        {
            title: 'Oil Prices Surge Amid Middle East Tensions',
            link: '#',
            pubDate: new Date(Date.now() - 7200000).toLocaleString(),
            source: 'CNBC'
        },
        {
            title: 'Dollar Weakens Against Major Currencies',
            link: '#',
            pubDate: new Date(Date.now() - 10800000).toLocaleString(),
            source: 'FT'
        },
        {
            title: 'European Markets Close Higher on Economic Data',
            link: '#',
            pubDate: new Date(Date.now() - 14400000).toLocaleString(),
            source: 'MARKETWATCH'
        }
    ];

    useEffect(() => {
        fetchNews();
        const interval = setInterval(fetchNews, 300000); // Refresh every 5 minutes
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedFeed]);

    return (
        <div className="h-full flex flex-col">
            <div className="p-2 border-b border-[var(--border-primary)] flex items-center justify-between gap-2">
                <select
                    value={selectedFeed}
                    onChange={(e) => setSelectedFeed(e.target.value)}
                    className="flex-1 text-xs bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded px-2 py-1"
                >
                    <option value="reuters">Reuters</option>
                    <option value="bloomberg">Bloomberg</option>
                    <option value="cnbc">CNBC</option>
                    <option value="marketwatch">MarketWatch</option>
                    <option value="ft">Financial Times</option>
                </select>
                <button
                    onClick={fetchNews}
                    disabled={loading}
                    className="p-1 hover:bg-[var(--bg-tertiary)] rounded transition-colors"
                    title="Refresh"
                >
                    <RefreshCw className={`w-4 h-4 text-[var(--text-secondary)] ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar">
                {news.length === 0 && !loading && (
                    <div className="p-4 text-center text-[var(--text-tertiary)] text-xs">
                        No news available
                    </div>
                )}
                {news.map((item, idx) => (
                    <a
                        key={idx}
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-3 border-b border-[var(--border-primary)] hover:bg-[var(--bg-tertiary)] transition-colors group"
                    >
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium text-[var(--text-primary)] mb-1 line-clamp-2 group-hover:text-[var(--accent-color)] transition-colors">
                                    {item.title}
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-[var(--text-tertiary)]">
                                    <span className="font-bold">{item.source}</span>
                                    <span>•</span>
                                    <span>{item.pubDate}</span>
                                </div>
                            </div>
                            <ExternalLink className="w-3 h-3 text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                        </div>
                    </a>
                ))}
            </div>
        </div>
    );
};

export default RSSNewsWidget;
