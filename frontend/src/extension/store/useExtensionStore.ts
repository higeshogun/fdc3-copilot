
import { create } from 'zustand';

export interface LogEntry {
    id: string;
    type: 'log' | 'query' | 'analysis';
    origin?: string; // e.g. 'SYSTEM', 'FDC3'
    data?: any;
    timestamp: number;
}

export interface AIConfig {
    provider: string; // 'local', 'openai', 'gemini', 'openrouter'
    url: string;
    apiKey: string;
    model: string;
    temperature: number;
    prompt: string;
}

interface ExtensionState {
    logs: LogEntry[];
    config: AIConfig;

    addLog: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void;
    clearLogs: () => void;
    updateConfig: (config: Partial<AIConfig>) => void;
    loadConfig: () => Promise<void>;
    loadHistory: () => Promise<void>;
}

export const useExtensionStore = create<ExtensionState>((set) => ({
    logs: [],
    config: {
        provider: 'local',
        url: 'http://localhost:11434/v1',
        apiKey: '',
        model: 'llama3',
        temperature: 0.7,
        prompt: 'You are an expert trade surveillance analyst. Analyze the FDC3 logs for compliance issues.'
    },

    addLog: (entry) => {
        const newEntry: LogEntry = {
            ...entry,
            id: Math.random().toString(36).substring(7),
            timestamp: Date.now()
        };

        set((state) => {
            const updated = [newEntry, ...state.logs];
            // Persist (debounce handled by caller or simple persist here)
            if (typeof chrome !== 'undefined' && chrome.storage) {
                chrome.storage.local.set({ chat_history: updated });
            }
            return { logs: updated };
        });
    },

    clearLogs: () => {
        set({ logs: [] });
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.remove('chat_history');
        }
    },

    updateConfig: (newConfig) => {
        set((state) => {
            const updated = { ...state.config, ...newConfig };
            if (typeof chrome !== 'undefined' && chrome.storage) {
                chrome.storage.local.set({ ai_config: updated });
            }
            return { config: updated };
        });
    },

    loadConfig: async () => {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            const res = await chrome.storage.local.get(['ai_config']);
            if (res.ai_config) {
                const newConfig = res.ai_config as Partial<AIConfig>;
                set((state) => ({ config: { ...state.config, ...newConfig } }));
            }
        }
    },

    loadHistory: async () => {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            const res = await chrome.storage.local.get(['chat_history']);
            if (res.chat_history && Array.isArray(res.chat_history)) {
                set({ logs: res.chat_history as LogEntry[] });
            }
        }
    }
}));
