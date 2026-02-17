
import { useEffect, useRef, useState, useCallback } from 'react';

export interface IBKRMarketDataUpdate {
    last: number;
    bid: number | null;
    ask: number | null;
    chg?: number | null;
    isDelayed: boolean;
}

export type OnUpdateCallback = (symbol: string, data: IBKRMarketDataUpdate) => void;

interface UseIBKRMarketDataOptions {
    onUpdate: OnUpdateCallback;
    autoConnect?: boolean;
}

interface IBKRMarketDataState {
    connected: boolean;
    isDelayed: boolean;
    error: string | null;
}

export const useIBKRMarketData = ({ onUpdate, autoConnect = true }: UseIBKRMarketDataOptions) => {
    const [state, setState] = useState<IBKRMarketDataState>({
        connected: false,
        isDelayed: false,
        error: null,
    });

    const eventSourceRef = useRef<EventSource | null>(null);
    const mountedRef = useRef(true);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Cleanup function
    const cleanup = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
    }, []);

    // Connect to IBKR via Flask proxy
    const connect = useCallback(async () => {
        if (eventSourceRef.current) {
            console.log('[IBKR] Already connected');
            return;
        }

        setState(prev => ({ ...prev, error: null }));
        console.log('[IBKR] Starting connection via proxy...');

        try {
            // Step 1: Initialize IBKR connection on server
            console.log('[IBKR] Initializing server connection...');
            const connectResp = await fetch('/ibkr/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });

            if (!connectResp.ok) {
                throw new Error(`Server connect failed: ${connectResp.status}`);
            }

            const connectData = await connectResp.json();
            console.log('[IBKR] Server connection result:', connectData);

            if (!connectData.success) {
                throw new Error(connectData.error || 'Connection failed');
            }

            // Step 2: Open SSE stream for market data
            console.log('[IBKR] Opening SSE stream...');
            const eventSource = new EventSource('/ibkr/stream');
            eventSourceRef.current = eventSource;

            eventSource.onopen = () => {
                console.log('[IBKR] SSE stream opened');
            };

            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    if (data.type === 'connected') {
                        console.log('[IBKR] Connection status:', data.status);
                        setState(prev => ({ ...prev, connected: data.status }));
                    } else if (data.type === 'marketData') {
                        // Update delayed status
                        if (data.isDelayed && !state.isDelayed) {
                            setState(prev => ({ ...prev, isDelayed: true }));
                        }

                        // Call the update callback
                        onUpdate(data.symbol, {
                            last: data.last,
                            bid: data.bid,
                            ask: data.ask,
                            chg: data.chg,
                            isDelayed: data.isDelayed,
                        });
                    } else if (data.type === 'error') {
                        console.error('[IBKR] Server error:', data.message);
                        setState(prev => ({ ...prev, error: data.message }));
                    }
                } catch (e) {
                    console.error('[IBKR] Failed to parse SSE message:', e);
                }
            };

            eventSource.onerror = (error) => {
                console.error('[IBKR] SSE error:', error);
                setState(prev => ({ ...prev, connected: false, error: 'SSE connection error' }));

                // Close and reconnect
                cleanup();

                if (mountedRef.current && autoConnect) {
                    console.log('[IBKR] Will reconnect in 5 seconds...');
                    reconnectTimeoutRef.current = setTimeout(() => {
                        if (mountedRef.current) {
                            connect();
                        }
                    }, 5000);
                }
            };

        } catch (error) {
            console.error('[IBKR] Connection error:', error);
            setState(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : 'Connection failed',
                connected: false
            }));
            cleanup();

            // Retry connection
            if (mountedRef.current && autoConnect) {
                console.log('[IBKR] Will retry connection in 5 seconds...');
                reconnectTimeoutRef.current = setTimeout(() => {
                    if (mountedRef.current) {
                        connect();
                    }
                }, 5000);
            }
        }
    }, [cleanup, onUpdate, autoConnect, state.isDelayed]);

    // Subscribe to a specific symbol (for dynamic subscriptions)
    const subscribe = useCallback((symbol: string, _conid?: number) => {
        // Subscriptions are handled server-side
        console.log(`[IBKR] Subscribe request for ${symbol} (handled by server)`);
    }, []);

    // Auto-connect on mount
    useEffect(() => {
        mountedRef.current = true;

        if (autoConnect) {
            connect();
        }

        return () => {
            mountedRef.current = false;
            cleanup();
        };
    }, [autoConnect, connect, cleanup]);

    return {
        connected: state.connected,
        isDelayed: state.isDelayed,
        error: state.error,
        connect,
        subscribe,
    };
};

export default useIBKRMarketData;
