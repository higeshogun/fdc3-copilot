
import { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Sparkles, Minus, Settings, ChevronDown, ChevronRight, Trash2, Globe, Zap, AlertTriangle, Check, XCircle } from 'lucide-react';
import { useSimulationStore } from '../store/useSimulationStore';
import { API_BASE_URL } from '../config';

interface PendingTrade {
    token: string;
    proposal: {
        symbol: string;
        side: 'BUY' | 'SELL';
        quantity: number;
        order_type: string;
        limit_price?: number;
    };
    message: string;
}

import { mcpClient } from '../services/MCPClient';

const FloatingChat = () => {
    const { fdc3Logs, aiConfig, updateAiConfig, clearLogs, addToast, broadcastSnapshot, connectionStatus, mcpMode } = useSimulationStore();
    const BACKEND_URL = API_BASE_URL;
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [query, setQuery] = useState('');
    const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant', content: string, timestamp: number, mode?: 'native' | 'mcp' }[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [expandedLogs, setExpandedLogs] = useState<Record<number, boolean>>({});
    const [models, setModels] = useState<string[]>([]);
    const [pendingTrade, setPendingTrade] = useState<PendingTrade | null>(null);
    const [isConfirming, setIsConfirming] = useState(false);
    const mcpStatus = { available: connectionStatus.gateway, checked: true };
    const logEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (logEndRef.current) {
            logEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatHistory, fdc3Logs]);

    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean, message: string } | null>(null);
    const [activeTab, setActiveTab] = useState<'chat' | 'logs'>('chat');

    const handleSend = async (customQuery?: string) => {
        const text = customQuery || query;
        if (!text.trim()) return;

        const timestamp = Date.now();
        const userMsg = { role: 'user' as const, content: text, timestamp };

        let placeholderText = '...';
        if (mcpMode) {
            placeholderText = "Analyst is thinking... (MCP Mode)";
            if (aiConfig.provider === 'local') {
                placeholderText += "\n\n💡 Hint: Local LLMs may be slow in MCP Mode as it waits for the full response. Disable MCP (Lightning Bolt) to enable streaming.";
            }
        }

        const currentMode = mcpMode ? 'mcp' as const : 'native' as const;
        const assistantPlaceholder = { role: 'assistant' as const, content: placeholderText, timestamp: timestamp + 1, mode: currentMode };

        // Capture index before adding - it will be at the very end
        const assistantMessageIdx = chatHistory.length + 1;

        setChatHistory(prev => [...prev, userMsg, assistantPlaceholder]);
        if (!customQuery) setQuery('');
        setIsAnalyzing(true);

        try {
            // Force a state refresh so the AI has the latest positions/orders in the logs
            await broadcastSnapshot();

            // Get the truly latest logs from state after broadcast finishes
            const state = useSimulationStore.getState();
            const latestLogs = state.fdc3Logs || [];

            let filteredLogs = [...latestLogs];
            if (aiConfig.start) {
                const startTs = new Date(aiConfig.start).getTime();
                filteredLogs = filteredLogs.filter(l => l.timestamp >= startTs);
            }
            if (aiConfig.end) {
                const endTs = new Date(aiConfig.end).getTime();
                filteredLogs = filteredLogs.filter(l => l.timestamp <= endTs);
            }

            if (mcpMode) {
                console.log("[Chat] Using MCP Mode (ask_analyst)");
                // MCP Mode: Use 'ask_analyst' tool
                const args = {
                    logs: filteredLogs,
                    query: text,
                    config: aiConfig,
                    enable_trading: mcpStatus.available
                };

                const result = await mcpClient.callTool('ask_analyst', args) as any;

                // Parse result
                // MCP TextContent: { type: 'text', text: '...' }
                const content = result?.content?.[0];
                if (content && content.type === 'text') {
                    try {
                        const data = JSON.parse(content.text);

                        // Handle pending trade
                        if (data.pending_trade) {
                            setPendingTrade(data.pending_trade);
                        }

                        // Update chat
                        const analysisText = data.analysis || "No analysis provided.";
                        setChatHistory(prev => {
                            const next = [...prev];
                            if (next[assistantMessageIdx]) {
                                next[assistantMessageIdx] = { ...next[assistantMessageIdx], content: analysisText };
                            }
                            return next;
                        });

                    } catch (e) {
                        console.error("Failed to parse MCP analysis result:", e);
                        // Fallback: display raw text
                        setChatHistory(prev => {
                            const next = [...prev];
                            if (next[assistantMessageIdx]) {
                                next[assistantMessageIdx] = { ...next[assistantMessageIdx], content: content.text };
                            }
                            return next;
                        });
                    }
                } else {
                    throw new Error("Invalid MCP response format");
                }

            } else {
                // Legacy Mode: REST via /analyze endpoint (Streaming)
                const response = await fetch(`${BACKEND_URL}/analyze`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        logs: filteredLogs,
                        query: text,
                        config: aiConfig,
                        stream: true,
                        enable_trading: mcpStatus.available
                    })
                });

                if (!response.body) throw new Error('No response body');

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let fullText = '';
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const parts = buffer.split('\n\n');
                    buffer = parts.pop() || '';

                    for (const part of parts) {
                        const lines = part.split('\n');
                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                try {
                                    const raw = line.substring(6).trim();
                                    if (!raw) continue;
                                    const data = JSON.parse(raw);
                                    // console.log("[Stream]", data);

                                    // Handle pending trade proposal
                                    if (data.pending_trade) {
                                        setPendingTrade(data.pending_trade);
                                    }

                                    if (data.error) {
                                        setChatHistory(prev => {
                                            const next = [...prev];
                                            const lastIdx = next.findIndex(m => m.timestamp === timestamp + 1);
                                            if (lastIdx !== -1) {
                                                next[lastIdx] = {
                                                    ...next[lastIdx],
                                                    content: next[lastIdx].content === '...' ? `❌ Error: ${data.error}` : `${next[lastIdx].content}\n\n❌ Error: ${data.error}`
                                                };
                                            }
                                            return next;
                                        });
                                    }

                                    if (data.text) {
                                        fullText += data.text;
                                        setChatHistory(prev => {
                                            const next = [...prev];
                                            // Update content but KEEP the original placeholder timestamp to prevent jumping
                                            // Find the message with the assistant timestamp we created
                                            const idx = next.findIndex(m => m.timestamp === timestamp + 1);
                                            if (idx !== -1) {
                                                next[idx] = { ...next[idx], content: fullText };
                                            }
                                            return next;
                                        });
                                    }
                                } catch (e) {
                                    console.warn("Error parsing stream chunk", e);
                                }
                            }
                        }
                    }
                }
            }
        } catch (err) {
            console.error("AI Error:", err);
            setChatHistory(prev => {
                const next = [...prev];
                if (next[assistantMessageIdx]) {
                    next[assistantMessageIdx] = { ...next[assistantMessageIdx], content: '❌ Error connecting to AI backend.' };
                }
                return next;
            });
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleConfirmTrade = async () => {
        if (!pendingTrade) return;
        setIsConfirming(true);

        try {
            const response = await fetch(`${BACKEND_URL}/mcp/confirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: pendingTrade.token })
            });

            const result = await response.json();

            if (result.executed) {
                const trade = pendingTrade.proposal;
                addToast(`Order executed: ${trade.side} ${trade.quantity} ${trade.symbol}`, 'success');

                // Refresh snapshot so AI/Logs are up to date
                await broadcastSnapshot();

                setChatHistory(prev => [...prev, {
                    role: 'assistant',
                    content: `✅ Order executed successfully!\n\n**${trade.side} ${trade.quantity} ${trade.symbol}** (${trade.order_type}${trade.limit_price ? ` @ $${trade.limit_price}` : ''})\n\nThe order has been submitted to Interactive Brokers.`,
                    timestamp: Date.now()
                }]);
            } else {
                addToast(`Order failed: ${result.error || 'Unknown error'}`, 'error');
                setChatHistory(prev => [...prev, {
                    role: 'assistant',
                    content: `❌ Order failed: ${result.error || 'Unknown error'}`,
                    timestamp: Date.now()
                }]);
            }
        } catch (err) {
            console.error("Confirm trade error:", err);
            addToast('Failed to execute order', 'error');
        } finally {
            setIsConfirming(false);
            setPendingTrade(null);
        }
    };

    const handleCancelTrade = async () => {
        if (!pendingTrade) return;

        try {
            await fetch(`${BACKEND_URL}/mcp/cancel-proposal`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: pendingTrade.token })
            });
        } catch {
            // Ignore errors on cancel
        }

        setChatHistory(prev => [...prev, {
            role: 'assistant',
            content: '🚫 Trade cancelled by user.',
            timestamp: Date.now()
        }]);

        setPendingTrade(null);
    };

    const fetchModels = async () => {
        try {
            const response = await fetch(`${BACKEND_URL}/models`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: aiConfig })
            });
            const data = await response.json();
            if (data.models) {
                setModels(data.models);
                setTestResult({ success: true, message: `Fetched ${data.models.length} models` });
            } else {
                setTestResult({ success: false, message: data.error || 'Failed to fetch models' });
            }
        } catch {
            setTestResult({ success: false, message: 'Network error fetching models' });
        }
    };

    const testConnection = async () => {
        setIsTesting(true);
        setTestResult(null);
        try {
            const response = await fetch(`${BACKEND_URL}/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: aiConfig })
            });
            const data = await response.json();
            setTestResult({ success: data.success, message: data.message });
        } catch {
            setTestResult({ success: false, message: 'Failed to reach AI backend server' });
        } finally {
            setIsTesting(false);
        }
    };

    const toggleLog = (timestamp: number) => {
        setExpandedLogs(prev => ({ ...prev, [timestamp]: !prev[timestamp] }));
    };

    const getSuggestions = () => {
        const hasOrders = fdc3Logs.some(l => l.type === 'fdc3.order' || l.type === 'fdc3.trade');
        const hasInstruments = fdc3Logs.some(l => l.type === 'fdc3.instrument');

        const suggestions = ["What happened recently?"];

        // Add trading suggestions if MCP is available
        if (mcpStatus.available) {
            suggestions.push("What are my positions?");
            suggestions.push("Show account summary");
        }

        if (hasOrders) suggestions.push("Analyze my order execution");
        if (hasInstruments) suggestions.push("Summarize instrument activity");

        return suggestions;
    };

    const [showSaveFeedback, setShowSaveFeedback] = useState(false);

    const handleSaveSettings = () => {
        setShowSaveFeedback(true);
        setTimeout(() => setShowSaveFeedback(false), 2000);
        setShowSettings(false);
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 h-14 w-14 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 z-50 animate-bounce-in"
            >
                <MessageSquare size={24} />
            </button>
        );
    }

    return (
        <div className={`fixed bottom-6 right-6 w-[400px] ${isMinimized ? 'h-14' : 'h-[550px]'} bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl shadow-2xl z-50 flex flex-col transition-all duration-300 overflow-hidden`}>
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]">
                <div className="flex items-center gap-2 text-[var(--text-primary)] font-semibold text-sm">
                    <Sparkles size={16} className="text-[var(--accent-color)]" />
                    AI ASSISTANT
                    {mcpStatus.checked && (
                        <span
                            className={`ml-1 px-1.5 py-0.5 rounded text-[8px] font-bold ${mcpStatus.available ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}
                            title={mcpStatus.available ? 'Connected to IBKR via MCP' : 'MCP not available - trading disabled'}
                        >
                            {mcpStatus.available ? 'IBKR' : 'DEMO'}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            if (confirm('Clear chat history and captured logs?')) {
                                setChatHistory([]);
                                clearLogs();
                            }
                        }}
                        className="text-[var(--text-secondary)] hover:text-[var(--danger-color)] transition-colors"
                        title="Clear History"
                    >
                        <Trash2 size={16} />
                    </button>
                    <button
                        onClick={async () => {
                            addToast("Refreshing state snapshot...", "info");
                            await broadcastSnapshot();
                        }}
                        className="text-[var(--text-secondary)] hover:text-[var(--accent-color)] transition-colors"
                        title="Sync State Now"
                    >
                        <Zap size={16} />
                    </button>
                    <button onClick={() => setShowSettings(!showSettings)} className={`text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors ${showSettings ? 'text-[var(--accent-color)]' : ''}`}>
                        <Settings size={16} />
                    </button>
                    {!isMinimized && (
                        <button onClick={() => setIsMinimized(true)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                            <Minus size={16} />
                        </button>
                    )}
                    {isMinimized && (
                        <button onClick={() => setIsMinimized(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                            <ChevronRight size={16} className="-rotate-90" />
                        </button>
                    )}
                    <button onClick={() => setIsOpen(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                        <X size={16} />
                    </button>
                </div>
            </div>

            {!isMinimized && (
                <>
                    {!showSettings && (
                        <div className="p-2 border-b border-[var(--border-primary)] flex gap-2 bg-[var(--bg-secondary)]">
                            <div className="flex-1">
                                <label className="block text-[8px] text-[var(--text-secondary)] uppercase mb-0.5">From</label>
                                <input
                                    type="datetime-local"
                                    value={aiConfig.start}
                                    onChange={(e) => updateAiConfig({ start: e.target.value })}
                                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-1.5 py-1 text-[10px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-color)]"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-[8px] text-[var(--text-secondary)] uppercase mb-0.5">To</label>
                                <input
                                    type="datetime-local"
                                    value={aiConfig.end}
                                    onChange={(e) => updateAiConfig({ end: e.target.value })}
                                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded px-1.5 py-1 text-[10px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-color)]"
                                />
                            </div>
                        </div>
                    )}
                    {showSettings ? (
                        <div className="flex-grow overflow-auto p-4 space-y-4 custom-scrollbar bg-[var(--bg-primary)]">
                            <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest">Configuration</h3>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-[10px] text-[var(--text-secondary)] mb-1">PROVIDER</label>
                                    <select
                                        value={aiConfig.provider}
                                        onChange={(e) => updateAiConfig({ provider: e.target.value as 'gemini' | 'openai' | 'local' })}
                                        className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded p-2 text-xs text-[var(--text-primary)]"
                                    >
                                        <option value="local">Local LLM (LM Studio / Ollama)</option>
                                        <option value="openai">OpenAI</option>
                                        <option value="gemini">Google Gemini</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] text-[var(--text-secondary)] mb-1">LLM BASE URL</label>
                                    <input
                                        type="text"
                                        value={aiConfig.url}
                                        onChange={(e) => updateAiConfig({ url: e.target.value })}
                                        className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded p-2 text-xs text-[var(--text-primary)]"
                                        placeholder="http://localhost:8081"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] text-[var(--text-secondary)] mb-1">TEMPERATURE ({aiConfig.temp})</label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.1"
                                        value={aiConfig.temp}
                                        onChange={(e) => updateAiConfig({ temp: parseFloat(e.target.value) })}
                                        className="w-full accent-[var(--accent-color)]"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] text-[var(--text-secondary)] mb-1">SYSTEM PROMPT</label>
                                    <textarea
                                        value={aiConfig.prompt}
                                        onChange={(e) => updateAiConfig({ prompt: e.target.value })}
                                        className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded p-2 text-xs text-[var(--text-primary)] h-20 resize-none"
                                        placeholder="You are a helpful assistant..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] text-[var(--text-secondary)] mb-1">API KEY</label>
                                    <input
                                        type="password"
                                        value={aiConfig.key}
                                        onChange={(e) => updateAiConfig({ key: e.target.value })}
                                        className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded p-2 text-xs text-[var(--text-primary)]"
                                        placeholder="Sk-..."
                                    />
                                </div>

                                <div className="flex gap-2">
                                    <div className="flex-grow">
                                        <label className="block text-[10px] text-[var(--text-secondary)] mb-1">MODEL</label>
                                        {models.length > 0 ? (
                                            <select
                                                value={aiConfig.model}
                                                onChange={(e) => updateAiConfig({ model: e.target.value })}
                                                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded p-2 text-xs text-[var(--text-primary)]"
                                            >
                                                {!models.includes(aiConfig.model) && <option value={aiConfig.model}>{aiConfig.model} (Custom)</option>}
                                                {models.map(m => <option key={m} value={m}>{m}</option>)}
                                            </select>
                                        ) : (
                                            <input
                                                type="text"
                                                value={aiConfig.model}
                                                onChange={(e) => updateAiConfig({ model: e.target.value })}
                                                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded p-2 text-xs text-[var(--text-primary)]"
                                                placeholder="Model Name (e.g. gpt-4o)"
                                            />
                                        )}
                                    </div>
                                    <button
                                        onClick={fetchModels}
                                        className="mt-5 p-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded text-[10px] text-[var(--accent-color)] hover:bg-[var(--border-primary)]"
                                    >
                                        FETCH
                                    </button>
                                </div>
                            </div>

                            <div style={{ height: '24px' }}>
                                {testResult && (
                                    <div className={`text-[10px] font-bold ${testResult.success ? 'text-green-400' : 'text-red-400'} animate-pulse`}>
                                        {testResult.success ? '✓' : '✗'} {testResult?.message}
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={testConnection}
                                disabled={isTesting}
                                className="w-full py-2 bg-[#21262d] border border-[#30363d] text-blue-400 rounded text-xs font-bold hover:bg-[#30363d] disabled:opacity-50 transition-colors"
                            >
                                {isTesting ? 'TESTING...' : 'TEST CONNECTION'}
                            </button>

                            <button
                                onClick={handleSaveSettings}
                                className={`w-full py-2 ${showSaveFeedback ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-500'} text-white rounded text-xs font-bold transition-colors`}
                            >
                                {showSaveFeedback ? 'SAVED!' : 'SAVE SETTINGS'}
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Suggestions */}
                            <div className="flex gap-2 p-2 overflow-x-auto bg-[var(--bg-secondary)] border-b border-[var(--border-primary)] custom-scrollbar no-scrollbar scroll-smooth">
                                {getSuggestions().map((s, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleSend(s)}
                                        className="whitespace-nowrap px-3 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--accent-color)]/30 rounded-full text-[10px] text-[var(--accent-color)] hover:bg-[var(--accent-color)]/10 transition-colors"
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>

                            {/* Tabs */}
                            <div className="flex border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]">
                                <button
                                    className={`flex-1 py-2 text-xs font-bold text-center border-b-2 transition-colors ${activeTab === 'chat' ? 'border-[var(--accent-color)] text-[var(--text-primary)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                                    onClick={() => setActiveTab('chat')}
                                >
                                    Chat
                                </button>
                                <button
                                    className={`flex-1 py-2 text-xs font-bold text-center border-b-2 transition-colors ${activeTab === 'logs' ? 'border-[var(--accent-color)] text-[var(--text-primary)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                                    onClick={() => setActiveTab('logs')}
                                >
                                    System Logs ({fdc3Logs.length})
                                </button>
                            </div>

                            {activeTab === 'chat' ? (
                                /* Chat View */
                                <div className="flex-grow overflow-auto p-4 space-y-4 custom-scrollbar text-xs bg-[var(--bg-primary)]">
                                    {chatHistory.length === 0 && (
                                        <div className="text-center py-10 text-[var(--text-tertiary)] italic">
                                            Ask the AI Analyst for help...
                                        </div>
                                    )}
                                    {chatHistory.map((item, i) => (
                                        <div key={i} className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[85%] p-3 rounded-2xl flex flex-col gap-2 ${item.role === 'user' ? 'bg-[var(--accent-color)] text-white rounded-tr-none' : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-tl-none border border-[var(--border-primary)]'}`}>
                                                <div className="whitespace-pre-wrap">
                                                    {item.content.split('Suggested Actions:')[0].trim()}
                                                </div>
                                                {item.role === 'assistant' && item.mode && (
                                                    <div className={`mt-1 flex items-center gap-1 text-[9px] font-mono ${item.mode === 'mcp' ? 'text-purple-400' : 'text-cyan-400'}`}>
                                                        <Zap size={8} />
                                                        {item.mode === 'mcp' ? 'MCP Mode' : 'Native Mode'} · {aiConfig.provider}
                                                    </div>
                                                )}
                                                {item.content.includes('Suggested Actions:') && (
                                                    <div className="mt-2 pt-2 border-t border-[var(--border-primary)]/50 flex flex-col gap-1.5">
                                                        <div className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Suggested Actions:</div>
                                                        {item.content.split('Suggested Actions:')[1]
                                                            .split('\n')
                                                            .map((s: string) => s.replace(/^[-*•]\s*/, '').trim())
                                                            .filter((s: string) => s.length > 0)
                                                            .map((s: string, idx: number) => (
                                                                <button
                                                                    key={idx}
                                                                    onClick={() => handleSend(s)}
                                                                    className="text-left py-1.5 px-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-md text-[var(--accent-color)] hover:bg-[var(--accent-color)] hover:text-white transition-colors text-[10px] font-semibold"
                                                                >
                                                                    {s}
                                                                </button>
                                                            ))
                                                        }
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {isAnalyzing && (
                                        <div className="flex justify-start">
                                            <div className="bg-[var(--bg-tertiary)] text-[var(--text-secondary)] p-2 rounded-2xl rounded-tl-none text-xs italic border border-[var(--border-primary)] animate-pulse">
                                                Analyst is thinking...
                                            </div>
                                        </div>
                                    )}
                                    {/* Trade Confirmation Card */}
                                    {pendingTrade && (
                                        <div className="bg-[var(--bg-tertiary)] border-2 border-yellow-500/50 rounded-xl p-4 space-y-3">
                                            <div className="flex items-center gap-2 text-yellow-400">
                                                <AlertTriangle size={16} />
                                                <span className="font-bold text-xs uppercase">Trade Confirmation Required</span>
                                            </div>

                                            <div className="bg-[var(--bg-primary)] rounded-lg p-3 space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[var(--text-secondary)] text-xs">Action</span>
                                                    <span className={`font-bold text-sm ${pendingTrade.proposal.side === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
                                                        {pendingTrade.proposal.side}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[var(--text-secondary)] text-xs">Symbol</span>
                                                    <span className="font-bold text-sm text-[var(--text-primary)]">{pendingTrade.proposal.symbol}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[var(--text-secondary)] text-xs">Quantity</span>
                                                    <span className="font-bold text-sm text-[var(--text-primary)]">{pendingTrade.proposal.quantity.toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[var(--text-secondary)] text-xs">Order Type</span>
                                                    <span className="font-bold text-sm text-[var(--text-primary)]">{pendingTrade.proposal.order_type}</span>
                                                </div>
                                                {pendingTrade.proposal.limit_price && (
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[var(--text-secondary)] text-xs">Limit Price</span>
                                                        <span className="font-bold text-sm text-[var(--text-primary)]">${pendingTrade.proposal.limit_price.toFixed(2)}</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={handleConfirmTrade}
                                                    disabled={isConfirming}
                                                    className="flex-1 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50 transition-colors"
                                                >
                                                    {isConfirming ? (
                                                        'Executing...'
                                                    ) : (
                                                        <>
                                                            <Check size={14} />
                                                            Confirm
                                                        </>
                                                    )}
                                                </button>
                                                <button
                                                    onClick={handleCancelTrade}
                                                    disabled={isConfirming}
                                                    className="flex-1 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/50 rounded-lg text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50 transition-colors"
                                                >
                                                    <XCircle size={14} />
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    <div ref={logEndRef} />
                                </div>
                            ) : (
                                /* Logs View */
                                <div className="flex-grow overflow-auto p-4 space-y-4 custom-scrollbar text-xs bg-[var(--bg-primary)]">
                                    {fdc3Logs.length === 0 && (
                                        <div className="text-center py-10 text-[var(--text-tertiary)] italic">
                                            No system logs captured yet.
                                        </div>
                                    )}
                                    {fdc3Logs.map((item, i) => (
                                        <div key={i} className="flex justify-start">
                                            <div className="w-full border-l-2 border-[var(--border-primary)] pl-3 py-1 space-y-1">
                                                <div className="flex items-center gap-2 text-[10px] text-[var(--text-secondary)] font-mono">
                                                    <Globe size={10} />
                                                    {item.origin}: {item.type}
                                                </div>
                                                <div
                                                    onClick={() => toggleLog(item.timestamp)}
                                                    className="cursor-pointer text-[var(--text-secondary)] hover:text-[var(--accent-hover)] transition-colors flex items-center gap-1"
                                                >
                                                    {expandedLogs[item.timestamp] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                                    {expandedLogs[item.timestamp] ? 'Hide JSON' : 'Expand JSON'}
                                                </div>
                                                {expandedLogs[item.timestamp] && (
                                                    <pre className="bg-[var(--bg-secondary)] p-2 rounded border border-[var(--border-primary)] text-[10px] text-[var(--accent-hover)] overflow-x-auto">
                                                        {JSON.stringify(item.data, null, 2)}
                                                    </pre>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={logEndRef} />
                                </div>
                            )}

                            {/* Input */}
                            <div className="p-4 border-t border-[var(--border-primary)] bg-[var(--bg-secondary)]">
                                <div className="flex gap-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg p-1.5 focus-within:border-[var(--accent-color)] transition-colors">
                                    <input
                                        type="text"
                                        className="flex-grow bg-transparent border-none px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none"
                                        placeholder="Ask AI Analyst about the market context..."
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                    />
                                    <button
                                        disabled={isAnalyzing}
                                        className="bg-[var(--accent-color)] hover:opacity-90 text-white rounded-md w-8 h-8 flex items-center justify-center transition-colors disabled:opacity-50"
                                        onClick={() => handleSend()}
                                    >
                                        <Zap size={14} fill="currentColor" />
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
};

export default FloatingChat;
