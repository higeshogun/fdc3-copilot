console.log("Background Service Worker Started");

// Ensure Side Panel opens on action click (Chrome 114+)
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.source === 'INTEROP_SNIFFER') {
        console.log("Background received FDC3 event:", message);
        // Return true to keep the message channel open if needed
        return true;
    }
});
