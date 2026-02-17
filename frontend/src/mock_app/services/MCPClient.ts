import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { API_BASE_URL } from "../config";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

/**
 * A browser-compatible SSE Transport that uses the native EventSource API.
 * This avoids the need for the Node.js 'eventsource' polyfill which breaks Vite builds.
 */
export class BrowserSSETransport implements Transport {
    private _eventSource: EventSource | null = null;
    private _endpoint: URL | null = null;
    private _abortController: AbortController | null = null;
    private _url: URL;

    onclose?: () => void;
    onerror?: (error: Error) => void;
    onmessage?: (message: JSONRPCMessage) => void;

    constructor(url: string | URL) {
        this._url = new URL(url.toString());
    }

    async start(): Promise<void> {
        if (this._eventSource) {
            throw new Error('BrowserSSETransport already started!');
        }

        return new Promise((resolve, reject) => {
            this._eventSource = new EventSource(this._url.href);
            this._abortController = new AbortController();

            this._eventSource.onerror = (event) => {
                const error = new Error(`EventSource error: ${JSON.stringify(event)}`);
                reject(error);
                this.onerror?.(error);
            };

            this._eventSource.onopen = () => {
                console.log("[MCP] SSE connection opened. Waiting for endpoint...");
            };

            this._eventSource.addEventListener('endpoint', (event: Event) => {
                const messageEvent = event as MessageEvent;
                console.log("[MCP] Received endpoint event:", messageEvent.data);
                try {
                    this._endpoint = new URL(messageEvent.data, this._url);
                    console.log("[MCP] Transport endpoint set to:", this._endpoint.toString());
                    resolve();
                } catch (error) {
                    console.error("[MCP] Error setting endpoint:", error);
                    reject(error);
                    this.onerror?.(error instanceof Error ? error : new Error(String(error)));
                    void this.close();
                }
            });

            this._eventSource.onmessage = (event) => {
                // console.log("[MCP] SSE Message:", event.data);
                try {
                    const message = JSON.parse(event.data);
                    this.onmessage?.(message);
                } catch (error) {
                    console.error("[MCP] JSON Parse Error:", error);
                    this.onerror?.(error instanceof Error ? error : new Error(String(error)));
                }
            };
        });
    }

    async close(): Promise<void> {
        this._abortController?.abort();
        this._eventSource?.close();
        this._eventSource = null;
        this.onclose?.();
    }

    async send(message: JSONRPCMessage): Promise<void> {
        if (!this._endpoint) {
            throw new Error('Not connected');
        }

        try {
            const response = await fetch(this._endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(message),
                signal: this._abortController?.signal
            });

            if (!response.ok) {
                const text = await response.text().catch(() => null);
                throw new Error(`Error POSTing to endpoint (HTTP ${response.status}): ${text}`);
            }
        } catch (error) {
            this.onerror?.(error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }
}

export class MCPClientService {
    private client: Client | null = null;
    private transport: BrowserSSETransport | null = null;
    private isConnected: boolean = false;

    private connectingPromise: Promise<void> | null = null;

    constructor() {
        this.client = new Client(
            {
                name: "FDC3-Copilot-Frontend",
                version: "1.0.0",
            },
            {
                capabilities: {},
                // Extend default timeout to 120s for robust connection
                timeout: 120000
            } as any
        );
    }

    async connect() {
        if (this.isConnected) return;
        if (this.connectingPromise) {
            return this.connectingPromise;
        }

        this.connectingPromise = (async () => {
            try {
                // Ensure any existing transport is closed before starting a new one
                if (this.transport) {
                    try {
                        await this.transport.close();
                    } catch (e) {
                        console.warn("Error closing previous transport:", e);
                    }
                    this.transport = null;
                }

                this.transport = new BrowserSSETransport(`${API_BASE_URL}/mcp/sse`);

                // Hook up close handler to reset state
                this.transport.onclose = () => {
                    console.log("[MCP] Transport Closed");
                    this.isConnected = false;
                    if (this.transport) {
                        this.transport = null;
                    }
                };

                this.transport.onerror = (err) => {
                    // Ignore AbortError as it usually means we closed the connection intentionally
                    if (err.name === 'AbortError' || err.message.includes('aborted')) {
                        console.log("MCP Transport Aborted (Clean Close)");
                        return;
                    }
                    console.error("MCP Transport Error:", err);
                    this.isConnected = false;
                    // Force close the transport on error to stop EventSource from auto-reconnecting
                    // with a session ID that the server has likely already discarded.
                    if (this.transport) {
                        this.transport.close().catch(e => console.error("Error closing transport on error:", e));
                        this.transport = null;
                    }
                };

                await this.client?.connect(this.transport);
                this.isConnected = true;
                console.log("MCP Client Connected");
            } catch (error) {
                console.error("Failed to connect MCP Client:", error);
                this.isConnected = false;
                // Cleanup failed transport
                if (this.transport) {
                    try {
                        await this.transport.close();
                    } catch (e) { console.error("Error closing failed transport:", e); }
                    this.transport = null;
                }
                throw error;
            } finally {
                this.connectingPromise = null;
            }
        })();

        return this.connectingPromise;
    }

    async disconnect() {
        try {
            await this.client?.close();
        } catch (error) {
            console.error("Error closing MCP Client:", error);
        }

        // Ensure transport is closed if client.close() didn't do it
        if (this.transport) {
            try {
                await this.transport.close();
            } catch (error) {
                console.error("Error closing MCP Transport:", error);
            }
            this.transport = null;
        }

        this.isConnected = false;
        console.log("MCP Client Disconnected");
    }

    async callTool(name: string, args: Record<string, unknown> = {}) {
        if (!this.isConnected) {
            try {
                await this.connect(); // Auto-connect if needed
            } catch (e) {
                console.error("Failed to auto-connect for tool call:", e);
                throw e;
            }
        }

        try {
            const result = await this.client?.callTool({
                name: name,
                arguments: args
            });
            return result;
        } catch (error: unknown) {
            console.error(`MCP Tool Call Failed (${name}):`, error);
            const errMsg = error instanceof Error ? error.message : String(error);

            // Only force close if it's strictly a connection/closed error. 
            // "Request timed out" (-32001) is often transient and shouldn't kill the transport.
            if (errMsg.includes('Connection closed') || errMsg.includes('Not connected')) {
                console.warn("[MCP] Connection lost, resetting state...");
                this.isConnected = false;
                if (this.transport) {
                    this.transport.close().catch(() => { });
                    this.transport = null;
                }
            }
            throw error;
        }
    }

    async listTools() {
        if (!this.isConnected) {
            await this.connect();
        }
        return await this.client?.listTools();
    }
}

export const mcpClient = new MCPClientService();
