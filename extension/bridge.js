if (window.__INTEROP_BRIDGE_INJECTED__) {
    // Already running
} else {
    window.__INTEROP_BRIDGE_INJECTED__ = true;
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL('injector.js');
    (document.head || document.documentElement).appendChild(s);

    window.addEventListener("message", (event) => {
        // Basic filter
        if (event.source !== window) return;

        if (event.data && event.data.source === 'INTEROP_SNIFFER') {
            console.log("Bridge: Forwarding FDC3 event to extension", event.data);
            try {
                chrome.runtime.sendMessage(event.data).catch(err => {
                    // This usually happens if the side panel is closed
                    console.warn("Bridge: Could not send to side panel (is it open?)", err);
                });
            } catch (e) {
                console.error("Bridge Exception:", e);
            }
        }
    });
}
