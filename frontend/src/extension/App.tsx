
import { useState, useEffect } from 'react';
import DraggableGrid, { type Layout } from '../shared/components/DraggableGrid';
import WidgetCard from '../shared/components/WidgetCard';
import LogFeedWidget from './widgets/LogFeedWidget';
import ChatWidget from './widgets/ChatWidget';
import SettingsWidget from './widgets/SettingsWidget';
import { useExtensionStore } from './store/useExtensionStore';

const App = () => {
    const { loadHistory, loadConfig, addLog } = useExtensionStore();

    // Initial Layout
    const [layout, setLayout] = useState<Layout[]>([
        { i: 'logs', x: 0, y: 0, w: 12, h: 10 },
        { i: 'chat', x: 0, y: 10, w: 12, h: 4 },
        // Settings initially hidden or just placed below
        // We can handle visibility toggle, but for now let's just expose it
        // Actually, let's put it on the side or bottom if user wants, 
        // but sidepanel is narrow (usually 300-400px).
        // So distinct rows is best.
    ]);

    const [showSettings, setShowSettings] = useState(false);

    useEffect(() => {
        loadHistory();
        loadConfig();

        // Setup Listener
        const handleMessage = (msg: any) => {
            if (msg && msg.source === 'INTEROP_SNIFFER') {
                addLog({
                    type: 'log',
                    origin: 'FDC3',
                    data: msg.payload?.data || msg.payload, // payload check
                });
            }
        };

        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
            chrome.runtime.onMessage.addListener(handleMessage);
        }

        // Cleanup? onMessage listener removal is tricky in React functional comp
        // if using anonymous function, but App is root so it persists.

        return () => {
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
                chrome.runtime.onMessage.removeListener(handleMessage);
            }
        }
    }, []);

    const onLayoutChange = (newLayout: Layout[]) => {
        setLayout(newLayout);
        // Persist layout?
    };

    return (
        <div className="app-container h-screen bg-[#0d1117] overflow-hidden flex flex-col">
            <div className="header px-3 py-2 bg-[#161b22] border-b border-[#30363d] flex justify-between items-center shrink-0">
                <span className="font-bold text-sm text-white">INTEROP LAB v2.0</span>
                <button
                    className={`p-1 rounded text-gray-400 hover:text-white ${showSettings ? 'text-blue-400' : ''}`}
                    onClick={() => setShowSettings(!showSettings)}
                >
                    ⚙️
                </button>
            </div>

            <div className="flex-grow overflow-hidden">
                <DraggableGrid layout={layout} onLayoutChange={onLayoutChange}>
                    <div key="logs">
                        <WidgetCard title="FDC3 Log Feed" className="h-full">
                            <LogFeedWidget />
                        </WidgetCard>
                    </div>
                    <div key="chat">
                        <WidgetCard title="AI Analyst" className="h-full">
                            <ChatWidget />
                        </WidgetCard>
                    </div>
                    {/* Dynamically add Settings if visible? 
                    RGL doesn't like keys appearing/disappearing without layout objects.
                    For simplicity, we can render it in a modal or overlay, logic separate from Grid.
                    OR we add it to the grid.
                    Let's use an overlay for settings to save space in the narrow panel.
                */}
                </DraggableGrid>
            </div>

            {showSettings && (
                <div className="absolute inset-0 bg-[#0d1117]/95 z-50 p-4">
                    <div className="flex justify-between items-center mb-4 border-b border-[#30363d] pb-2">
                        <h2 className="text-lg font-bold text-white">Settings</h2>
                        <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-white">✕</button>
                    </div>
                    <SettingsWidget />
                </div>
            )}
        </div>
    );
};

export default App;
