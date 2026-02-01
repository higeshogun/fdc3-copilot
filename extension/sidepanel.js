// --- HISTORY PERSISTENCE ---
let logs = [];
const TODAY_KEY = new Date().toLocaleDateString();

function saveHistoryItem(item) {
    chrome.storage.local.get(['chat_history', 'chat_date'], (res) => {
        let history = [];
        if (res.chat_date === TODAY_KEY && res.chat_history) {
            history = res.chat_history;
        } else {
            // New day or first run, start fresh
            chrome.storage.local.set({ chat_date: TODAY_KEY });
        }
        history.push(item);
        chrome.storage.local.set({ chat_history: history });
    });
}

function loadHistory() {
    chrome.storage.local.get(['chat_history', 'chat_date'], (res) => {
        if (res.chat_date === TODAY_KEY && res.chat_history) {
            console.log("Restoring history for", TODAY_KEY);
            // Clear current view (though it should be empty on reload)
            // Re-render items in order. Since we prepend, we must iterate backwards or 
            // adjust the render logic.
            // Current render uses prepend (newest on top).
            // So if history is [Oldest, ..., Newest], we should render Oldest first?
            // No, Prepend means if I render A then B -> B is on top. 
            // History is usually chronological [Old, New].
            // If I render Old, it's at top. Then Render New, it's above Old.
            // So iterating generic array [0..N] and prepending results in [N...0] visually.
            // This is correct for "Newest on Top" list style.

            res.chat_history.forEach(item => {
                if (item.type === 'log') {
                    logs.push(item.data); // Restore context for Analysis
                    renderLog(item.data);
                } else if (item.type === 'analysis') {
                    renderAnalysis(item.data);
                } else if (item.type === 'query') {
                    renderQuery(item.data);
                }
            });
            updateContextualSuggestions();
        } else {
            console.log("New day, clearing history.");
            chrome.storage.local.remove(['chat_history']);
            chrome.storage.local.set({ chat_date: TODAY_KEY });
        }
    });
}

// Extract Render Logic
function renderLog(payload) {
    const logList = document.getElementById('log-list');
    if (!logList) return;

    const div = document.createElement('div');
    div.className = 'log-entry';
    div.style.padding = "8px";
    div.style.borderBottom = "1px solid #333";
    div.style.color = "white";
    div.style.fontSize = "12px";

    const pillClass = payload.origin === 'SYSTEM' ? 'pill-system' : 'pill-fdc3';
    let details = '';

    if (payload.data) {
        if (payload.data.id && payload.data.id.ticker) {
            details = `<span style="color:#4ade80; font-weight:bold;">${payload.data.id.ticker}</span>`;
        } else if (payload.data.ticker) {
            details = `<span style="color:#4ade80; font-weight:bold;">${payload.data.ticker}</span>`;
        } else if (payload.data.type === 'fdc3.order') {
            // Try to find ticker in instrument
            const ticker = payload.data.details?.product?.id?.ticker || payload.data.instrument?.id?.ticker || 'Order';
            const side = payload.data.details?.side || payload.data.side || '';
            const status = payload.data.status || '';
            details = `${side} ${ticker} <span style="color:#888; font-weight:normal;">(${status})</span>`;
        } else {
            // Fallback to type or truncated JSON
            details = JSON.stringify(payload.data).substring(0, 50);
            if (details.length >= 50) details += '...';
        }
    }

    const contextType = payload.data && payload.data.type ? `<br><span style="color:#888; font-size:10px;">${payload.data.type}</span>` : '';

    // Create unique ID for the JSON container
    const jsonId = `json-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fullJson = JSON.stringify(payload.data, null, 2);

    div.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <span class="pill ${pillClass}">${payload.origin}</span>
            <span style="color:#ccc;">${payload.type}</span>
        </div>
        <div style="margin-top:4px;">
            ${details}
            ${contextType}
        </div>
        <div id="${jsonId}" style="display:none; font-family:monospace; font-size:10px; color:#aaa; white-space:pre-wrap; margin-top:8px; background:#111; padding:8px; border-radius:4px; border:1px solid #333;">
            ${fullJson}
        </div>
        <div style="text-align:right; margin-top:4px;">
            <small style="color:#555; font-size:9px;">▼ Click to expand</small>
        </div>
    `;

    // Make interactive
    div.style.cursor = "pointer";
    div.title = "Click to view full FDC3 payload";
    div.onclick = (e) => {
        // Don't trigger if selecting text
        if (window.getSelection().toString().length > 0) return;

        const el = document.getElementById(jsonId);
        if (el) {
            const isHidden = el.style.display === 'none';
            el.style.display = isHidden ? 'block' : 'none';
        }
    };

    logList.prepend(div);
}

function renderQuery(text) {
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.style.padding = "10px";
    div.style.borderLeft = "4px solid #a855f7"; // Purple for user
    div.style.backgroundColor = "rgba(168, 85, 247, 0.1)";
    div.style.color = "white";
    div.innerHTML = `<strong style="color:#a855f7">You:</strong><br>${text}`;
    document.getElementById('log-list').prepend(div);
}

function renderAnalysis(text) {
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.style.borderLeft = "4px solid #38bdf8";
    div.style.backgroundColor = "rgba(56, 189, 248, 0.1)";
    div.style.padding = "10px";

    // Split Analysis vs Suggestions
    const parts = text.split('Suggested Actions:');
    const analysisText = parts[0];
    const suggestions = parts[1] ? parts[1].split('\n').filter(s => s.trim().length > 0) : [];

    let html = `<strong style="color:#38bdf8">AI Analysis:</strong><br>${parseMarkdown(analysisText)}`;

    // Add Suggestions Container
    if (suggestions.length > 0) {
        html += `<div style="margin-top:10px; border-top:1px solid #333; padding-top:5px;">
                    <small style="color:#888;">Suggested Follow-ups:</small><br>`;
        html += `<div id="suggestion-container-${Date.now()}"></div>`; // Placeholder
        html += `</div>`;
    }

    div.innerHTML = html;
    document.getElementById('log-list').prepend(div);

    // Inject Buttons (Need to do this after adding to DOM or build elements directly)
    // Easier to build elements directly to attach handlers
    if (suggestions.length > 0) {
        // Find the container we just added (using the unique ID logic is risky if multiple added same ms)
        // Better approach: append children to div
        const actionsDiv = document.createElement('div');
        actionsDiv.style.marginTop = "10px";
        actionsDiv.style.borderTop = "1px solid #333";
        actionsDiv.style.paddingTop = "5px";
        actionsDiv.innerHTML = '<small style="color:#888;">Suggested Follow-ups:</small><br>';

        suggestions.forEach(s => {
            const cleanS = s.replace(/^[-*•] /, '').trim();
            if (!cleanS) return;

            const btn = document.createElement('button');
            btn.innerText = cleanS;
            btn.className = 'suggestion-btn'; // We need to add CSS for this
            btn.style.display = 'block';
            btn.style.width = '100%';
            btn.style.textAlign = 'left';
            btn.style.padding = '5px';
            btn.style.marginTop = '4px';
            btn.style.background = '#1f2937';
            btn.style.border = '1px solid #374151';
            btn.style.color = '#e5e7eb';
            btn.style.cursor = 'pointer';
            btn.style.fontSize = '11px';
            btn.style.borderRadius = '4px';

            btn.onmouseover = () => btn.style.background = '#374151';
            btn.onmouseout = () => btn.style.background = '#1f2937';

            btn.onclick = () => {
                const input = document.getElementById('query');
                input.value = cleanS;
                document.getElementById('save-btn').click();
            };

            actionsDiv.appendChild(btn);
        });

        // Re-write the innerHTML logic above to only handle analysis part + append actionsDiv
        div.innerHTML = `<strong style="color:#38bdf8">AI Analysis:</strong><br>${parseMarkdown(analysisText)}`;
        div.appendChild(actionsDiv);
    }
}

// --- CONTEXTUAL SUGGESTIONS LOGIC ---
function updateContextualSuggestions() {
    const container = document.getElementById('log-list');
    // Only show if we have logs
    if (logs.length === 0) return;

    // Remove existing suggestion chips if any (to refresh)
    const existing = document.getElementById('context-chips');
    if (existing) existing.remove();

    // Analyze logs for context
    const hasOrders = logs.some(l => l.data && (l.data.type === 'fdc3.order' || JSON.stringify(l.data).includes('order')));
    const hasInstruments = logs.some(l => l.data && (l.data.type === 'fdc3.instrument' || l.data.id?.ticker));
    const hasContext = logs.length > 5;

    let suggestions = [];
    if (hasOrders) suggestions.push("Analyze my order execution");
    if (hasInstruments) suggestions.push("Summarize instrument activity");
    if (hasContext) suggestions.push("Check for compliance violations");
    suggestions.push("What happened in the last 5 minutes?");

    // Create Chips Container
    const chipDiv = document.createElement('div');
    chipDiv.id = 'context-chips';
    chipDiv.style.padding = "10px";
    chipDiv.style.display = "flex";
    chipDiv.style.gap = "8px";
    chipDiv.style.flexWrap = "wrap";
    chipDiv.style.borderBottom = "1px solid #333";
    chipDiv.style.background = "rgba(56, 189, 248, 0.05)"; // Light blue tint

    suggestions.forEach(text => {
        const btn = document.createElement('button');
        btn.innerText = text;
        btn.className = 'filter-chip'; // Reuse existing class
        btn.style.fontSize = "10px";
        btn.style.padding = "4px 8px";
        btn.style.background = "#1f2937";
        btn.style.border = "1px solid #38bdf8";
        btn.style.color = "#38bdf8";

        btn.onmouseover = () => btn.style.background = "#38bdf8";
        btn.onmouseover = () => btn.style.color = "#000";
        btn.onmouseout = () => {
            btn.style.background = "#1f2937";
            btn.style.color = "#38bdf8";
        };

        btn.onclick = () => {
            document.getElementById('query').value = text;
            document.getElementById('save-btn').click();
        };
        chipDiv.appendChild(btn);
    });

    // Insert at the top of log list
    container.prepend(chipDiv);
}

// Modify Listener
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.source === 'INTEROP_SNIFFER') {
        try {
            logs.push(msg.payload);
            renderLog(msg.payload);
            saveHistoryItem({ type: 'log', data: msg.payload });

            // Debounce suggestion update
            if (window.suggestionTimeout) clearTimeout(window.suggestionTimeout);
            window.suggestionTimeout = setTimeout(updateContextualSuggestions, 500);

        } catch (e) {
            console.error("SidePanel: Render Error", e);
        }
    }
});

// Init
loadHistory();

function parseMarkdown(text) {
    if (!text) return '';
    return text
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        .replace(/\*(.*?)\*/g, '<i>$1</i>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>')
        .replace(/^- (.*)$/gm, '<li>$1</li>');
}

// Helper to append UI (Replaced by renderAnalysis)
function addAnalysisToUI(text) {
    renderAnalysis(text);
    saveHistoryItem({ type: 'analysis', data: text });
}

function updateDropdownModel(config) {
    const label = document.getElementById('model-status');
    if (label) {
        label.innerText = `Using: ${config.model || 'Unknown'} (${config.provider})`;
    }

    // Update main dropdown label to match provider
    const providerSelect = document.getElementById('provider');
    if (providerSelect) {
        const ollamaOption = providerSelect.querySelector('option[value="ollama"]');
        if (ollamaOption) {
            const map = {
                'local': 'Local LLM',
                'gemini': 'Google Gemini',
                'openai': 'OpenAI',
                'openrouter': 'OpenRouter'
            };
            ollamaOption.text = map[config.provider] || config.provider || 'Local LLM';
        }
    }
}

document.getElementById('save-btn').onclick = async () => {
    // We allow empty logs because the user might be querying historical sessions.
    // if (logs.length === 0) { ... }

    const provider = document.getElementById('provider').value;
    const userQuery = document.getElementById('query').value;
    console.log(`SidePanel: Analyzing with ${provider}... Query: ${userQuery}`);

    if (userQuery) {
        renderQuery(userQuery);
        saveHistoryItem({ type: 'query', data: userQuery });
        // Clear input? Maybe keep it for reference? Let's keep it.
    }

    // OLLAMA (Native Host)
    const btn = document.getElementById('save-btn');
    const originalText = btn.innerText;
    btn.innerText = "⏳ ANALYST THINKING...";
    btn.disabled = true;

    // Load Settings using the helper (so it includes start/end time)
    const settings = getAnalysisConfig();

    // Inject user query into prompt - OVERRIDE default prompt if query exists
    if (userQuery) {
        const systemPrompt = settings.prompt || "Analyze these FDC3 logs:";
        settings.prompt = `${systemPrompt}\n\nUser Question: ${userQuery}`;
    }

    try {
        chrome.runtime.sendNativeMessage('com.interop.ai.lab', {
            logs: logs,
            config: settings // Pass config to Host
        }, (resp) => {
            btn.innerText = originalText;
            btn.disabled = false;

            if (chrome.runtime.lastError) {
                alert("Extension Error: " + chrome.runtime.lastError.message);
                return;
            }
            if (resp && resp.analysis) {
                addAnalysisToUI(resp.analysis);
            } else if (resp && resp.status === 'Error') {
                // Show detailed error from Host
                alert("Analyst Error:\n" + (resp.error || "Unknown Error from Host"));
            } else if (resp && resp.status) {
                alert("Status: " + resp.status);
            } else {
                alert("Error: Native Host returned no data/empty response.");
            }
        });
    } catch (e) {
        console.error("SidePanel: Exception calling sendNativeMessage", e);
        alert("SidePanel Exception:\n" + e.message);
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

// --- SETTINGS LOGIC ---
const mainView = document.getElementById('main-view');
const settingsView = document.getElementById('settings-view');

// 1. View Toggling
document.getElementById('params-btn').onclick = () => {
    mainView.style.display = 'none';
    settingsView.style.display = 'block';
};

document.getElementById('cfg-cancel-btn').onclick = () => {
    settingsView.style.display = 'none';
    mainView.style.display = 'block';
};

// 2. Provider Logic (Show/Hide fields)
document.getElementById('cfg-provider').onchange = (e) => {
    const provider = e.target.value;
    const urlField = document.getElementById('field-url');
    const keyField = document.getElementById('field-key');
    const urlInput = document.getElementById('cfg-url');

    if (provider === 'local') {
        urlField.style.display = 'block';
        keyField.style.display = 'none';
        if (urlInput.value.includes('api.openai.com')) {
            urlInput.value = "http://localhost:11434/v1";
        }
    } else {
        urlField.style.display = 'block';
        keyField.style.display = 'block';

        // Defaults for cloud providers
        if (provider === 'openai') urlInput.value = "https://api.openai.com/v1";
        if (provider === 'gemini') urlInput.value = "https://generativelanguage.googleapis.com/v1beta/openai";
        if (provider === 'openrouter') urlInput.value = "https://openrouter.ai/api/v1";
    }
};

// 3. Temperature Slider
document.getElementById('cfg-temp').oninput = (e) => {
    document.getElementById('val-temp').innerText = e.target.value;
};

// 4. Save Logic
document.getElementById('cfg-save-btn').onclick = () => {
    const config = {
        provider: document.getElementById('cfg-provider').value,
        url: document.getElementById('cfg-url').value,
        apiKey: document.getElementById('cfg-key').value,
        model: document.getElementById('cfg-model').value,
        temperature: parseFloat(document.getElementById('cfg-temp').value),
        prompt: document.getElementById('cfg-prompt').value,
        startTime: document.getElementById('cfg-start').value,
        endTime: document.getElementById('cfg-end').value
    };
    chrome.storage.local.set({ 'ai_config': config }, () => {
        alert("Settings Saved!");
        updateDropdownModel(config);
        settingsView.style.display = 'none';
        mainView.style.display = 'flex';
    });
};

// 5. Test Logic
document.getElementById('cfg-test-btn').onclick = () => {
    const btn = document.getElementById('cfg-test-btn');
    const originalText = btn.innerText;
    btn.innerText = "⏳ TESTING...";
    btn.disabled = true;

    const config = {
        provider: document.getElementById('cfg-provider').value,
        url: document.getElementById('cfg-url').value,
        apiKey: document.getElementById('cfg-key').value,
        model: document.getElementById('cfg-model').value
    };

    chrome.runtime.sendNativeMessage('com.interop.ai.lab', {
        action: 'test',
        config: config
    }, (resp) => {
        btn.innerText = originalText;
        btn.disabled = false;

        if (chrome.runtime.lastError) {
            alert("Error: " + chrome.runtime.lastError.message);
        } else if (resp && resp.status === 'Success') {
            try {
                // Try to parse model list
                const data = JSON.parse(resp.analysis.trim());
                if (data.models && Array.isArray(data.models)) {
                    const select = document.getElementById('cfg-model-select');
                    select.innerHTML = '<option value="" disabled selected>Select a model...</option>';
                    data.models.forEach(m => {
                        const opt = document.createElement('option');
                        opt.value = m;
                        opt.innerText = m;
                        select.appendChild(opt);
                    });
                    select.style.display = 'block';
                    select.onchange = () => {
                        document.getElementById('cfg-model').value = select.value;
                        select.style.display = 'none';
                    };
                    alert(`✅ Connection Successful!\nFound ${data.models.length} models. Select one from the list.`);
                } else {
                    alert("✅ Connection Successful!\n" + resp.analysis);
                }
            } catch (e) {
                // Not JSON or no models, just show raw output
                alert("✅ Connection Successful!\n" + resp.analysis);
            }
        } else {
            alert("❌ Connection Failed:\n" + (resp.error || "Unknown Error"));
        }
    });
};

// 7. Fetch Models Logic
document.getElementById('cfg-list-models-btn').onclick = () => {
    const btn = document.getElementById('cfg-list-models-btn');
    const originalText = btn.innerText;
    btn.innerText = "⏳";
    btn.disabled = true;

    const config = {
        provider: document.getElementById('cfg-provider').value,
        url: document.getElementById('cfg-url').value,
        apiKey: document.getElementById('cfg-key').value
    };

    chrome.runtime.sendNativeMessage('com.interop.ai.lab', {
        action: 'test',
        config: config
    }, (resp) => {
        btn.innerText = originalText;
        btn.disabled = false;

        if (chrome.runtime.lastError) {
            alert("Error: " + chrome.runtime.lastError.message);
        } else if (resp && resp.status === 'Success') {
            try {
                const data = JSON.parse(resp.analysis.trim());
                if (data.models && Array.isArray(data.models)) {
                    const select = document.getElementById('cfg-model-select');
                    select.innerHTML = '<option value="" disabled selected>Select a model...</option>';
                    data.models.forEach(m => {
                        const opt = document.createElement('option');
                        opt.value = m;
                        opt.innerText = m;
                        select.appendChild(opt);
                    });
                    select.style.display = 'block';
                    select.onchange = () => {
                        document.getElementById('cfg-model').value = select.value;
                        select.style.display = 'none';
                    };
                } else {
                    alert("No models list found in response.");
                }
            } catch (e) {
                alert("Could not parse models: " + resp.analysis);
            }
        } else {
            alert("Connection Failed");
        }
    });
};

// 6. Analysis Override (Pass full config)
const getAnalysisConfig = () => {
    return {
        url: document.getElementById('cfg-url').value,
        apiKey: document.getElementById('cfg-key').value,
        model: document.getElementById('cfg-model').value,
        temperature: document.getElementById('cfg-temp').value,
        prompt: document.getElementById('cfg-prompt').value,
        startTime: document.getElementById('cfg-start').value,
        endTime: document.getElementById('cfg-end').value
    };
};
// NOTE: Must update sendNativeMessage call in main click handler to use this.

// Load on startup
chrome.storage.local.get(['ai_config', 'last_provider'], (res) => {
    // 1. Restore Main Provider Selection
    if (res.last_provider) {
        const pSelect = document.getElementById('provider');
        if (pSelect) pSelect.value = res.last_provider;
    }

    // 2. Restore Settings
    if (res.ai_config) {
        const c = res.ai_config;
        if (c.provider) document.getElementById('cfg-provider').value = c.provider;
        if (c.url) document.getElementById('cfg-url').value = c.url;
        if (c.apiKey) document.getElementById('cfg-key').value = c.apiKey;
        if (c.model) document.getElementById('cfg-model').value = c.model;
        if (c.temperature) {
            document.getElementById('cfg-temp').value = c.temperature;
            document.getElementById('val-temp').innerText = c.temperature;
        }
        if (c.prompt) document.getElementById('cfg-prompt').value = c.prompt;
        if (c.startTime) document.getElementById('cfg-start').value = c.startTime;
        if (c.endTime) document.getElementById('cfg-end').value = c.endTime;

        // Trigger change event to set visibility
        document.getElementById('cfg-provider').dispatchEvent(new Event('change'));
        updateDropdownModel(c);
    }
});

// Save Main Provider Selection
document.getElementById('provider').onchange = (e) => {
    chrome.storage.local.set({ last_provider: e.target.value });
};

// Clear History Logic
document.getElementById('clear-btn').onclick = () => {
    if (confirm("Clear all chat history?")) {
        chrome.storage.local.remove('chat_history', () => {
            document.getElementById('log-list').innerHTML = '';
            logs = [];
        });
    }
};

// Toggle Filter Panel
document.getElementById('filter-btn').onclick = () => {
    const p = document.getElementById('filter-panel');
    p.style.display = p.style.display === 'none' ? 'block' : 'none';
};

// Filter Logic Helper
const setFilter = (mode) => {
    const now = new Date();
    const start = document.getElementById('cfg-start');
    const end = document.getElementById('cfg-end');

    // Helper to format local ISO string (remove seconds/ms)
    // datetime-local expects YYYY-MM-DDTHH:mm
    const toLocalISO = (d) => {
        const offset = d.getTimezoneOffset() * 60000;
        const local = new Date(d.getTime() - offset);
        return local.toISOString().slice(0, 16);
    };

    end.value = toLocalISO(now);

    if (mode === '1h') {
        const past = new Date(now.getTime() - 60 * 60 * 1000);
        start.value = toLocalISO(past);
    } else if (mode === '24h') {
        const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        start.value = toLocalISO(past);
    } else if (mode === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        start.value = toLocalISO(today);
    } else if (mode === 'all') {
        start.value = '';
        end.value = '';
    }

    // Auto-save settings when filter changes? Ideally yes or user has to click Save.
    // For now, user has to click SAVE SETTINGS in settings view, but these inputs are in main view.
    // The "Send" logic reads these inputs via getAnalysisConfig(), so it's fine.
};

// Bind Filter Buttons
document.getElementById('filter-1h').onclick = () => setFilter('1h');
document.getElementById('filter-24h').onclick = () => setFilter('24h');
document.getElementById('filter-today').onclick = () => setFilter('today');
document.getElementById('filter-all').onclick = () => setFilter('all');

// Default to 'today' on initialization
setFilter('today');

// Enable Enter key for chat prompt
document.getElementById('query').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('save-btn').click();
    }
});
