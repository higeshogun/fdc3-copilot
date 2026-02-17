(function () {
    if (window.__INTEROP_INJECTED__) return;
    window.__INTEROP_INJECTED__ = true;

    const notify = (origin, type, data) => {
        window.postMessage({
            source: 'INTEROP_SNIFFER',
            payload: {
                origin,
                type,
                data,
                timestamp: Date.now()
            }
        }, '*');
    };

    const patchFdc3 = (obj) => {
        if (!obj || obj.__PATCHED__) return obj;
        const originalBroadcast = obj.broadcast;
        obj.broadcast = function (ctx) {
            notify('FDC3', 'Broadcast', ctx);
            return originalBroadcast.apply(this, arguments);
        };
        obj.__PATCHED__ = true;
        return obj;
    };

    // Mock FDC3 Implementation for Apps that expect an Agent
    const createMockFdc3 = () => ({
        broadcast: (context) => {
            notify('FDC3', 'Broadcast', context);
            console.log("[MockFDC3] Broadcast:", context);
        },
        raiseIntent: (intent, context) => {
            notify('FDC3', `Intent: ${intent}`, context);
            console.log("[MockFDC3] RaiseIntent:", intent, context);
            return Promise.resolve({ source: { appId: "mock" }, intent: intent });
        },
        addContextListener: (type, handler) => {
            console.log("[MockFDC3] addContextListener:", type);
            if (typeof type === 'function') { handler = type; type = null; }
            return { unsubscribe: () => { } };
        },
        addIntentListener: (intent, handler) => {
            console.log("[MockFDC3] addIntentListener:", intent);
            return { unsubscribe: () => { } };
        },
        joinUserChannel: (channelId) => {
            console.log("[MockFDC3] joinUserChannel:", channelId);
            notify('FDC3', `Joined Channel: ${channelId}`, { channelId });
            return Promise.resolve();
        },
        getOrCreateChannel: (channelId) => {
            return Promise.resolve({
                id: channelId,
                type: 'user',
                broadcast: (ctx) => notify('FDC3', `Broadcast on ${channelId}`, ctx),
                addContextListener: () => ({ unsubscribe: () => { } }),
                getCurrentContext: () => Promise.resolve(null)
            });
        },
        getUserChannels: () => {
            console.log("[MockFDC3] getUserChannels request");
            return Promise.resolve([
                { id: 'global', type: 'global', displayMetadata: { name: 'Global' } },
                { id: 'red', type: 'user', displayMetadata: { name: 'Red', color: 'red' } },
                { id: 'blue', type: 'user', displayMetadata: { name: 'Blue', color: 'blue' } }
            ]);
        },
        getSystemChannels: () => { // Backwards compatibility for some 1.2 apps
            console.log("[MockFDC3] getSystemChannels request");
            return Promise.resolve([
                { id: 'red', type: 'user', displayMetadata: { name: 'Red', color: 'red' } },
                { id: 'blue', type: 'user', displayMetadata: { name: 'Blue', color: 'blue' } }
            ]);
        },
        getCurrentChannel: () => {
            console.log("[MockFDC3] getCurrentChannel");
            // Return null context for default channel
            return Promise.resolve(null);
        },
        leaveCurrentChannel: () => {
            console.log("[MockFDC3] leaveCurrentChannel");
            return Promise.resolve();
        },
        getInfo: () => ({
            fdc3Version: "2.0",
            provider: "Interop Trader"
        })
    });

    // 1. Hook into the standard 'fdc3Ready' event to catch Real Agents (e.g., Sail)
    window.addEventListener('fdc3Ready', (event) => {
        if (event.detail && event.detail.fdc3) {
            console.log("🕵️ Injector: Real FDC3 Agent Detected via fdc3Ready!");
            patchFdc3(event.detail.fdc3);
        }
    }, { capture: true });

    let _fdc3 = window.fdc3;

    // 2. HYBRID STRATEGY:
    // If an agent exists (Sail/Desktop), we patch it.
    // If NOT, we Inject our Mock Agent so apps like Workbench can run.

    if (_fdc3) {
        _fdc3 = patchFdc3(_fdc3);
        console.log('✅ FDC3 Patched (Existing Global)');
    } else {
        // No agent found? Create one!
        _fdc3 = createMockFdc3();
        console.log('✅ FDC3 Polyfilled (Mock Agent for Workbench)');
    }

    // Always dispatch fdc3Ready so the app knows we are here
    setTimeout(() => {
        window.dispatchEvent(new CustomEvent('fdc3Ready', { detail: { fdc3: _fdc3 } }));
        console.log('🚀 Dispatched fdc3Ready event');
    }, 100); // Slight delay to ensure app listeners are ready

    Object.defineProperty(window, 'fdc3', {
        get: () => _fdc3,
        set: (val) => {
            console.log('✅ FDC3 Global Set - Patching...');
            _fdc3 = patchFdc3(val);
        },
        configurable: true
    });


})();
