
import { useState, useEffect, useCallback } from 'react';
import { Settings } from 'lucide-react';
import DraggableGrid, { type Layout } from '../shared/components/DraggableGrid';
import WidgetCard from '../shared/components/WidgetCard';
import WidgetSelector from '../shared/components/WidgetSelector';
import WatchlistWidget from './widgets/WatchlistWidget';
import OrderEntryWidget from './widgets/OrderEntryWidget';
import BlotterWidget from './widgets/BlotterWidget';
import PositionsWidget from './widgets/PositionsWidget';
import AccountBalanceWidget from './widgets/AccountBalanceWidget';
import ChartWidget from './widgets/ChartWidget';
import QuickTradeWidget from './widgets/QuickTradeWidget';
import TradesBlotterWidget from './widgets/TradesBlotterWidget';
import RSSNewsWidget from './widgets/RSSNewsWidget';
import EconomicCalendarWidget from './widgets/EconomicCalendarWidget';
import FloatingChat from './components/FloatingChat';
import ToastContainer from './components/ToastContainer';
import { useSimulationStore } from './store/useSimulationStore';
import { useIBKRMarketData } from './store/useIBKRMarketData';

const initialLayout: Layout[] = [
    { i: 'watchlist', x: 0, y: 0, w: 3, h: 6, minW: 2, minH: 1 },
    { i: 'chart', x: 0, y: 6, w: 3, h: 5, minW: 2, minH: 1 },
    { i: 'rssNews', x: 0, y: 11, w: 3, h: 6, minW: 2, minH: 1 },
    { i: 'accountBalance', x: 3, y: 0, w: 6, h: 5, minW: 4, minH: 1 },
    { i: 'positions', x: 3, y: 5, w: 6, h: 5, minW: 4, minH: 1 },
    { i: 'blotter', x: 3, y: 10, w: 6, h: 5, minW: 4, minH: 1 },
    { i: 'tradesBlotter', x: 3, y: 15, w: 6, h: 5, minW: 4, minH: 1 },
    { i: 'orderEntry', x: 9, y: 0, w: 3, h: 7, minW: 2, minH: 1 },
    { i: 'quickTrade', x: 9, y: 7, w: 3, h: 6, minW: 2, minH: 1 },
    { i: 'economicCalendar', x: 9, y: 13, w: 3, h: 6, minW: 2, minH: 1 }
];

// Store original heights for restoring when expanding
const originalHeights: Record<string, number> = {
    watchlist: 6, chart: 5, rssNews: 6, accountBalance: 5, positions: 5,
    blotter: 5, tradesBlotter: 5, orderEntry: 7, quickTrade: 6, economicCalendar: 6
};

const App = () => {
    const [layout, setLayout] = useState<Layout[]>(initialLayout);
    const [isMobile, setIsMobile] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const { broadcastSnapshot, theme, toggleTheme, updateInstrumentFromIBKR, connectionStatus, fetchStatus, mcpMode, toggleMcpMode } = useSimulationStore();

    // IBKR Market Data Integration

    // IBKR Market Data Integration
    const handleIBKRUpdate = useCallback((symbol: string, data: { last: number; bid: number | null; ask: number | null; chg?: number | null; isDelayed: boolean }) => {
        updateInstrumentFromIBKR(symbol, {
            last: data.last,
            bid: data.bid,
            ask: data.ask,
            chg: data.chg,
        });
    }, [updateInstrumentFromIBKR]);

    const { isDelayed: ibkrDelayed } = useIBKRMarketData({
        onUpdate: handleIBKRUpdate,
        autoConnect: true,
    });

    // Widget metadata
    const availableWidgets = [
        { id: 'watchlist', name: 'Watchlist' },
        { id: 'chart', name: 'Price Chart' },
        { id: 'rssNews', name: 'RSS News Feed' },
        { id: 'accountBalance', name: 'IBKR Account Balance' },
        { id: 'positions', name: 'Positions' },
        { id: 'blotter', name: 'Order Blotter' },
        { id: 'tradesBlotter', name: 'Done Trades' },
        { id: 'orderEntry', name: 'Order Entry' },
        { id: 'quickTrade', name: 'Quick Trade' },
        { id: 'economicCalendar', name: 'Economic Calendar' }
    ];

    // Load visible widgets from localStorage
    const loadVisibleWidgets = (): Set<string> => {
        const saved = localStorage.getItem('visibleWidgets');
        if (saved) {
            return new Set(JSON.parse(saved));
        }
        // Default: all widgets visible
        return new Set(availableWidgets.map(w => w.id));
    };

    const [visibleWidgets, setVisibleWidgets] = useState<Set<string>>(loadVisibleWidgets);

    // Save visible widgets to localStorage
    useEffect(() => {
        localStorage.setItem('visibleWidgets', JSON.stringify(Array.from(visibleWidgets)));
    }, [visibleWidgets]);

    // Toggle widget visibility
    const toggleWidget = (widgetId: string) => {
        setVisibleWidgets(prev => {
            const newSet = new Set(prev);
            if (newSet.has(widgetId)) {
                newSet.delete(widgetId);
            } else {
                newSet.add(widgetId);
            }
            return newSet;
        });
    };

    // Handle widget collapse/expand
    const handleWidgetCollapse = (widgetId: string, isCollapsed: boolean) => {
        // Update layout height
        setLayout(currentLayout =>
            currentLayout.map(item =>
                item.i === widgetId
                    ? { ...item, h: isCollapsed ? 1 : originalHeights[widgetId] || item.h }
                    : item
            )
        );
    };

    // Detect screen size for mobile
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        // Auto-Broadcast Snapshot on Load (Wait for FDC3 ready)
        const timer = setTimeout(() => {
            broadcastSnapshot();
        }, 2000);
        return () => clearTimeout(timer);
    }, [broadcastSnapshot]);

    // Poll connection status
    useEffect(() => {
        fetchStatus(); // Initial fetch
        const interval = setInterval(fetchStatus, 5000); // 5s poll
        return () => clearInterval(interval);
    }, [fetchStatus]);

    return (
        <div className={`h-screen w-screen p-2 flex flex-col gap-2 md:overflow-hidden transition-colors duration-300 ${theme === 'light' ? 'light-theme bg-white' : 'bg-[#030508]'}`}>
            <header className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2 md:gap-4">
                    <div className="flex items-center gap-1 md:gap-2">
                        <span className="text-[#2f81f7] font-bold text-sm md:text-lg tracking-wider">INTEROP.</span>
                        <span className={`${theme === 'light' ? 'text-zinc-900' : 'text-white'} font-bold text-sm md:text-lg tracking-wider`}>TRADER</span>
                    </div>
                    <button
                        onClick={toggleTheme}
                        className={`p-2 md:p-1.5 rounded-lg border transition-all flex items-center gap-1 md:gap-2 text-[10px] font-bold min-h-[44px] md:min-h-0
                            ${theme === 'light'
                                ? 'bg-zinc-100 border-zinc-200 text-zinc-900 hover:bg-zinc-200'
                                : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'}`}
                        title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
                    >
                        <span className="md:hidden">{theme === 'light' ? '🌙' : '☀️'}</span>
                        <span className="hidden md:inline">{theme === 'light' ? '🌙 DARK MODE' : '☀️ LIGHT MODE'}</span>
                    </button>
                    <button
                        onClick={toggleMcpMode}
                        className={`p-2 md:p-1.5 rounded-lg border transition-all flex items-center gap-1 md:gap-2 text-[10px] font-bold min-h-[44px] md:min-h-0
                            ${mcpMode
                                ? 'bg-blue-600 border-blue-500 text-white hover:bg-blue-500 shadow-[0_0_10px_rgba(37,99,235,0.3)]'
                                : theme === 'light' ? 'bg-zinc-100 border-zinc-200 text-zinc-900 hover:bg-zinc-200' : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'}`}
                        title={`Switch to ${mcpMode ? 'Native' : 'MCP'} Mode`}
                    >
                        <span className="hidden md:inline">{mcpMode ? '⚡ MCP MODE' : '🔌 NATIVE API'}</span>
                    </button>
                    <button
                        onClick={() => setShowSettings(true)}
                        className={`p-2 md:p-1.5 rounded-lg border transition-all flex items-center gap-1 md:gap-2 text-[10px] font-bold min-h-[44px] md:min-h-0
                            ${theme === 'light'
                                ? 'bg-zinc-100 border-zinc-200 text-zinc-900 hover:bg-zinc-200'
                                : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'}`}
                        title="Widget Settings"
                    >
                        <Settings size={16} />
                        <span className="hidden md:inline">WIDGETS</span>
                    </button>
                </div>
                <div className="text-[10px] text-zinc-500 font-mono gap-2 md:gap-4 hidden md:flex">
                    <span className="flex items-center gap-1.5 border-r border-zinc-800 pr-3 mr-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                        FDC3 READY
                    </span>
                    <span className="flex items-center gap-1.5 border-r border-zinc-800 pr-3 mr-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${connectionStatus.marketData ? (ibkrDelayed ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]' : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]') : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`}></span>
                        MARKET DATA: {connectionStatus.marketData ? (ibkrDelayed ? 'DELAYED' : 'LIVE') : 'OFFLINE'}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${connectionStatus.gateway ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`}></span>
                        IBKR GATEWAY: {connectionStatus.gateway ? 'ACTIVE' : 'OFFLINE'}
                    </span>
                </div>
            </header>

            <div className="flex-grow min-h-0">
                <DraggableGrid
                    layout={layout.filter(item => visibleWidgets.has(item.i))}
                    onLayoutChange={setLayout}
                    isDraggable={true}
                    isResizable={!isMobile}
                >
                    {visibleWidgets.has('watchlist') && (
                        <WidgetCard key="watchlist" widgetId="watchlist" title="WATCHLIST" onCollapse={handleWidgetCollapse}>
                            <WatchlistWidget />
                        </WidgetCard>
                    )}
                    {visibleWidgets.has('chart') && (
                        <WidgetCard key="chart" widgetId="chart" title="PRICE CHART" onCollapse={handleWidgetCollapse}>
                            <ChartWidget />
                        </WidgetCard>
                    )}
                    {visibleWidgets.has('accountBalance') && (
                        <WidgetCard key="accountBalance" widgetId="accountBalance" title="IBKR ACCOUNT BALANCE" className="glass-panel" onCollapse={handleWidgetCollapse}>
                            <AccountBalanceWidget />
                        </WidgetCard>
                    )}
                    {visibleWidgets.has('positions') && (
                        <WidgetCard key="positions" widgetId="positions" title="POSITIONS" onCollapse={handleWidgetCollapse}>
                            <PositionsWidget />
                        </WidgetCard>
                    )}
                    {visibleWidgets.has('blotter') && (
                        <WidgetCard key="blotter" widgetId="blotter" title="ORDER BLOTTER" onCollapse={handleWidgetCollapse}>
                            <BlotterWidget />
                        </WidgetCard>
                    )}
                    {visibleWidgets.has('tradesBlotter') && (
                        <WidgetCard key="tradesBlotter" widgetId="tradesBlotter" title="DONE TRADES" onCollapse={handleWidgetCollapse}>
                            <TradesBlotterWidget />
                        </WidgetCard>
                    )}
                    {visibleWidgets.has('orderEntry') && (
                        <WidgetCard key="orderEntry" widgetId="orderEntry" title="ORDER ENTRY" onCollapse={handleWidgetCollapse}>
                            <OrderEntryWidget />
                        </WidgetCard>
                    )}
                    {visibleWidgets.has('quickTrade') && (
                        <WidgetCard key="quickTrade" widgetId="quickTrade" title="QUICK TRADE" onCollapse={handleWidgetCollapse}>
                            <QuickTradeWidget />
                        </WidgetCard>
                    )}
                    {visibleWidgets.has('rssNews') && (
                        <WidgetCard key="rssNews" widgetId="rssNews" title="RSS NEWS FEED" onCollapse={handleWidgetCollapse}>
                            <RSSNewsWidget />
                        </WidgetCard>
                    )}
                    {visibleWidgets.has('economicCalendar') && (
                        <WidgetCard key="economicCalendar" widgetId="economicCalendar" title="ECONOMIC CALENDAR" onCollapse={handleWidgetCollapse}>
                            <EconomicCalendarWidget />
                        </WidgetCard>
                    )}
                </DraggableGrid>
            </div>
            <FloatingChat />
            <ToastContainer />

            {/* Widget Settings Modal */}
            {showSettings && (
                <WidgetSelector
                    availableWidgets={availableWidgets}
                    visibleWidgets={visibleWidgets}
                    onToggleWidget={toggleWidget}
                    onClose={() => setShowSettings(false)}
                />
            )}
        </div>
    );
};

export default App;
