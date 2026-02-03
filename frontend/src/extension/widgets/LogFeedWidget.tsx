
import { useState } from 'react';
import { useExtensionStore, type LogEntry } from '../store/useExtensionStore';
import { ChevronDown, ChevronRight } from 'lucide-react';

const JsonViewer = ({ data }: { data: any }) => {
    const [expanded, setExpanded] = useState(false);

    if (!data) return null;

    return (
        <div className="mt-2">
            <div
                className="flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer hover:text-gray-300"
                onClick={() => setExpanded(!expanded)}
            >
                {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                {expanded ? 'Hide Details' : 'View Payload'}
            </div>
            {expanded && (
                <pre className="mt-1 p-2 bg-black/50 border border-gray-800 rounded text-[10px] text-gray-400 overflow-x-auto">
                    {JSON.stringify(data, null, 2)}
                </pre>
            )}
        </div>
    );
};

const LogItemView = ({ entry }: { entry: LogEntry }) => {
    const isSystem = entry.origin === 'SYSTEM';

    // Helper to format details like ticker
    const getDetails = () => {
        if (!entry.data) return null;

        let ticker = entry.data.id?.ticker || entry.data.ticker;
        if (entry.data.type === 'fdc3.order') {
            const side = entry.data.details?.side || entry.data.side || '';
            const status = entry.data.status || '';
            // Try to find ticker in instrument
            ticker = entry.data.details?.product?.id?.ticker || entry.data.instrument?.id?.ticker || ticker || 'Order';
            return (
                <span>
                    {side} <span className="text-[#4ade80] font-bold">{ticker}</span> <span className="text-gray-500">({status})</span>
                </span>
            );
        }

        if (ticker) {
            return <span className="text-[#4ade80] font-bold">{ticker}</span>;
        }

        return <span className="text-gray-400 truncate">{JSON.stringify(entry.data).substring(0, 50)}</span>;
    };

    if (entry.type === 'query') {
        return (
            <div className="p-2 border-l-4 border-purple-500 bg-purple-500/10 mb-1 text-xs">
                <strong className="text-purple-400">You:</strong>
                <div className="mt-1 text-gray-200">{entry.data}</div>
            </div>
        );
    }

    if (entry.type === 'analysis') {
        return (
            <div className="p-2 border-l-4 border-sky-400 bg-sky-400/10 mb-1 text-xs">
                <strong className="text-sky-400">AI Analysis:</strong>
                <div className="mt-1 text-gray-200 whitespace-pre-wrap">{entry.data}</div>
            </div>
        );
    }

    return (
        <div className="p-2 border-b border-[#30363d] text-xs hover:bg-white/5 transition-colors">
            <div className="flex justify-between items-center mb-1">
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${isSystem ? 'bg-orange-900 text-orange-200' : 'bg-blue-900 text-blue-200'}`}>
                    {entry.origin || 'LOG'}
                </span>
                <span className="text-gray-500 text-[9px]">{new Date(entry.timestamp).toLocaleTimeString()}</span>
            </div>
            <div className="text-gray-300">
                {getDetails()}
            </div>
            {entry.data && entry.data.type && (
                <div className="text-[9px] text-gray-500 mt-0.5">{entry.data.type}</div>
            )}
            <JsonViewer data={entry.data} />
        </div>
    );
};

const LogFeedWidget = () => {
    const logs = useExtensionStore((state) => state.logs);

    // Logs are typically new at top (prepend). 
    // If state.logs is [newer, older], just map it.

    return (
        <div className="h-full overflow-y-auto custom-scrollbar">
            {logs.length === 0 && (
                <div className="p-4 text-center text-gray-600 text-xs italic">
                    No logs captured yet...
                </div>
            )}
            {logs.map((log) => (
                <LogItemView key={log.id} entry={log} />
            ))}
        </div>
    );
};

export default LogFeedWidget;
