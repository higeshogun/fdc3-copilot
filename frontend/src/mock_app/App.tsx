
import { useState, useEffect } from 'react';
import DraggableGrid, { type Layout } from '../shared/components/DraggableGrid';
import WidgetCard from '../shared/components/WidgetCard';
import WatchlistWidget from './widgets/WatchlistWidget';
import OrderEntryWidget from './widgets/OrderEntryWidget';
import BlotterWidget from './widgets/BlotterWidget';
import PositionsWidget from './widgets/PositionsWidget';
import PortfolioSummaryWidget from './widgets/PortfolioSummaryWidget';
import ChartWidget from './widgets/ChartWidget';
import NewsWidget from './widgets/NewsWidget';
import QuickTradeWidget from './widgets/QuickTradeWidget';
import TradesBlotterWidget from './widgets/TradesBlotterWidget';
import ContactsWidget from './widgets/ContactsWidget';
import FloatingChat from './components/FloatingChat';
import ToastContainer from './components/ToastContainer';
import { useSimulationStore } from './store/useSimulationStore';

const initialLayout: Layout[] = [
    { i: 'watchlist', x: 0, y: 0, w: 3, h: 6, minW: 2 },
    { i: 'chart', x: 0, y: 6, w: 3, h: 5, minW: 2 },
    { i: 'contacts', x: 0, y: 11, w: 3, h: 5, minW: 2 },
    { i: 'portfolio', x: 3, y: 0, w: 6, h: 2, minW: 4 },
    { i: 'positions', x: 3, y: 2, w: 6, h: 5, minW: 4 },
    { i: 'blotter', x: 3, y: 7, w: 6, h: 5, minW: 4 },
    { i: 'tradesBlotter', x: 3, y: 12, w: 6, h: 5, minW: 4 },
    { i: 'orderEntry', x: 9, y: 0, w: 3, h: 7, minW: 2 },
    { i: 'quickTrade', x: 9, y: 7, w: 3, h: 6, minW: 2 },
    { i: 'news', x: 9, y: 13, w: 3, h: 6, minW: 2 }
];

const App = () => {
    const [layout, setLayout] = useState<Layout[]>(initialLayout);
    const { broadcastSnapshot, theme, toggleTheme } = useSimulationStore();

    useEffect(() => {
        // Auto-Broadcast Snapshot on Load (Wait for FDC3 ready)
        const timer = setTimeout(() => {
            broadcastSnapshot();
        }, 2000);
        return () => clearTimeout(timer);
    }, [broadcastSnapshot]);

    return (
        <div className={`h-screen w-screen p-2 flex flex-col gap-2 overflow-hidden transition-colors duration-300 ${theme === 'light' ? 'light-theme bg-white' : 'bg-[#030508]'}`}>
            <header className="flex items-center justify-between px-2">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-[#2f81f7] font-bold text-lg tracking-wider">INTEROP.</span>
                        <span className={`${theme === 'light' ? 'text-zinc-900' : 'text-white'} font-bold text-lg tracking-wider`}>TRADER</span>
                    </div>
                    <button
                        onClick={toggleTheme}
                        className={`p-1.5 rounded-lg border transition-all flex items-center gap-2 text-[10px] font-bold
                            ${theme === 'light'
                                ? 'bg-zinc-100 border-zinc-200 text-zinc-900 hover:bg-zinc-200'
                                : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'}`}
                        title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
                    >
                        {theme === 'light' ? '🌙 DARK MODE' : '☀️ LIGHT MODE'}
                    </button>
                </div>
                <div className="text-[10px] text-zinc-500 font-mono flex gap-4">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> FDC3 READY</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> MOCK DATA</span>
                </div>
            </header>

            <div className="flex-grow min-h-0">
                <DraggableGrid layout={layout} onLayoutChange={setLayout}>
                    <WidgetCard key="watchlist" title="WATCHLIST">
                        <WatchlistWidget />
                    </WidgetCard>
                    <WidgetCard key="chart" title="PRICE CHART">
                        <ChartWidget />
                    </WidgetCard>
                    <WidgetCard key="contacts" title="SALES CONTACTS">
                        <ContactsWidget />
                    </WidgetCard>
                    <WidgetCard key="portfolio" title="PORTFOLIO SUMMARY" className="glass-panel">
                        <PortfolioSummaryWidget />
                    </WidgetCard>
                    <WidgetCard key="positions" title="POSITIONS">
                        <PositionsWidget />
                    </WidgetCard>
                    <WidgetCard key="blotter" title="ORDER BLOTTER">
                        <BlotterWidget />
                    </WidgetCard>
                    <WidgetCard key="tradesBlotter" title="DONE TRADES">
                        <TradesBlotterWidget />
                    </WidgetCard>
                    <WidgetCard key="orderEntry" title="ORDER ENTRY">
                        <OrderEntryWidget />
                    </WidgetCard>
                    <WidgetCard key="quickTrade" title="QUICK TRADE">
                        <QuickTradeWidget />
                    </WidgetCard>
                    <WidgetCard key="news" title="NEWS FEED">
                        <NewsWidget />
                    </WidgetCard>
                </DraggableGrid>
            </div>
            <FloatingChat />
            <ToastContainer />
        </div>
    );
};

export default App;
