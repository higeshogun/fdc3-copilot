
import { useState, useEffect } from 'react';
import { useExtensionStore } from '../store/useExtensionStore';
import { Save, RefreshCw } from 'lucide-react';

const SettingsWidget = () => {
    const { config, updateConfig } = useExtensionStore();
    const [localConfig, setLocalConfig] = useState(config);
    const [isTesting, setIsTesting] = useState(false);

    // Sync local state when store updates (initial load)
    useEffect(() => {
        setLocalConfig(config);
    }, [config]);

    const handleSave = () => {
        updateConfig(localConfig);
        // Show success feedback?
    };

    const handleChange = (field: keyof typeof config, value: string | number) => {
        setLocalConfig(prev => ({ ...prev, [field]: value }));
    };

    const handleTest = () => {
        setIsTesting(true);
        // Mock test or real test
        setTimeout(() => setIsTesting(false), 1000);
    };

    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-3 text-xs text-gray-300 space-y-3">
            <div>
                <label className="block text-gray-500 mb-1">Provider</label>
                <select
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2 py-1"
                    value={localConfig.provider}
                    onChange={(e) => handleChange('provider', e.target.value)}
                >
                    <option value="local">Local (Ollama)</option>
                    <option value="openai">OpenAI</option>
                    <option value="gemini">Google Gemini</option>
                    <option value="openrouter">OpenRouter</option>
                </select>
            </div>

            <div>
                <label className="block text-gray-500 mb-1">Base URL</label>
                <input
                    type="text"
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2 py-1"
                    value={localConfig.url}
                    onChange={(e) => handleChange('url', e.target.value)}
                />
            </div>

            {localConfig.provider !== 'local' && (
                <div>
                    <label className="block text-gray-500 mb-1">API Key</label>
                    <input
                        type="password"
                        className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2 py-1"
                        value={localConfig.apiKey}
                        onChange={(e) => handleChange('apiKey', e.target.value)}
                    />
                </div>
            )}

            <div>
                <label className="block text-gray-500 mb-1">Model</label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        className="flex-grow bg-[#0d1117] border border-[#30363d] rounded px-2 py-1"
                        value={localConfig.model}
                        onChange={(e) => handleChange('model', e.target.value)}
                    />
                    <button className="bg-[#21262d] border border-[#30363d] hover:bg-[#30363d] text-white rounded px-2" title="List Models">
                        <RefreshCw size={12} />
                    </button>
                </div>
            </div>

            <div>
                <label className="block text-gray-500 mb-1">Temperature: {localConfig.temperature}</label>
                <input
                    type="range"
                    min="0" max="1" step="0.1"
                    className="w-full"
                    value={localConfig.temperature}
                    onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
                />
            </div>

            <div>
                <label className="block text-gray-500 mb-1">System Prompt</label>
                <textarea
                    rows={3}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2 py-1"
                    value={localConfig.prompt}
                    onChange={(e) => handleChange('prompt', e.target.value)}
                />
            </div>

            <div className="pt-2 flex gap-2">
                <button
                    className="flex-1 bg-[#238636] hover:bg-[#2ea043] text-white py-1.5 rounded flex items-center justify-center gap-2 font-semibold"
                    onClick={handleSave}
                >
                    <Save size={12} /> Save
                </button>
                <button
                    className="flex-1 bg-[#21262d] border border-[#30363d] hover:bg-[#30363d] text-white py-1.5 rounded"
                    onClick={handleTest}
                >
                    {isTesting ? 'Testing...' : 'Test Connection'}
                </button>
            </div>
        </div>
    );
};

export default SettingsWidget;
