
import { useState } from 'react';
import { useExtensionStore } from '../store/useExtensionStore';
import { Send, Sparkles } from 'lucide-react';

const ChatWidget = () => {
    const [query, setQuery] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const { addLog, config } = useExtensionStore();

    const handleSend = () => {
        if (!query.trim()) return;

        // 1. Add User Query to Logs
        addLog({
            type: 'query',
            data: query,
        });

        setIsAnalyzing(true);
        const currentQuery = query;
        setQuery(''); // Clear input

        // 2. Call Native Host (Mocked for now if not in extension)
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendNativeMessage) {
            // Need logs to send as context
            // Accessing logs via store might be stale if inside callback? 
            // Better to perform analysis in a thunk or service. For now, we do it here.

            // We need logs. Zustand `getState` would be ideal but we exported hook.
            // Let's assume we send the last 20 logs. 
            // NOTE: In real impl, we should grab logs from store properly.

            chrome.storage.local.get(['chat_history'], (res) => {
                const history = res.chat_history || [];

                chrome.runtime.sendNativeMessage('com.interop.ai.lab', {
                    logs: history, // Send full history or filtered
                    config: { ...config, prompt: `${config.prompt}\n\nUser Question: ${currentQuery}` }
                }, (resp) => {
                    setIsAnalyzing(false);
                    if (chrome.runtime.lastError) {
                        addLog({ type: 'analysis', data: `Error: ${chrome.runtime.lastError.message}` });
                        return;
                    }
                    if (resp && resp.analysis) {
                        addLog({ type: 'analysis', data: resp.analysis });
                    } else {
                        addLog({ type: 'analysis', data: `Error: ${resp?.error || 'Unknown error'}` });
                    }
                });
            });
        } else {
            // Mock Response
            setTimeout(() => {
                setIsAnalyzing(false);
                addLog({
                    type: 'analysis',
                    data: `(MOCK) Analysis for: "${currentQuery}"\n\nNo FDC3 activity detected relevant to this query.`
                });
            }, 1000);
        }
    };

    return (
        <div className="h-full flex flex-col p-2">
            <div className="flex-grow flex flex-col justify-end text-xs text-gray-500 mb-2">
                {/* Chat output is actually in LogFeed, this widget is just the Input control? 
                     Or should it be a standalone chat interface?
                     The original design mixed them. 
                     Let's keep the Input here, and maybe show status. 
                 */}
                <div className="bg-blue-500/10 border border-blue-500/30 p-2 rounded mb-2">
                    <div className="flex items-center gap-2 text-blue-300 font-semibold mb-1">
                        <Sparkles size={12} />
                        AI Analyst Ready
                    </div>
                    <div className="text-[10px]">
                        Model: <span className="text-white">{config.model}</span> ({config.provider})
                    </div>
                </div>
            </div>

            <div className="flex gap-2">
                <input
                    type="text"
                    className="flex-grow bg-[#0d1117] border border-[#30363d] rounded px-2 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
                    placeholder="Ask about your logs..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    disabled={isAnalyzing}
                />
                <button
                    className={`bg-blue-600 hover:bg-blue-500 text-white rounded px-3 py-1 flex items-center justify-center transition-colors ${isAnalyzing ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={handleSend}
                    disabled={isAnalyzing}
                >
                    <Send size={14} />
                </button>
            </div>
        </div>
    );
};

export default ChatWidget;
