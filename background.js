// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        // Set default highlight color
        chrome.storage.sync.set({ highlightColor: '#fbbf24' });
        console.log('AnnotateMe extension installed successfully');
    }
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
    const actionMap = {
        "HighLightText": "HighlightText",
        "AddNotes": "AddNotes"
    };
    
    const action = actionMap[command];
    if (action) {
        chrome.storage.sync.get('highlightColor', (data) => {
            const color = data.highlightColor || '#fbbf24';
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0] && !tabs[0].url.startsWith('chrome://')) {
                    executeContentScript(tabs[0].id, action, color);
                }
            });
        });
    }
});

// Handle tab updates to restore annotations
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && 
        tab.url && 
        !tab.url.startsWith('chrome://') && 
        !tab.url.startsWith('chrome-extension://') &&
        !tab.url.startsWith('moz-extension://')) {
        
        // Inject content script and load annotations
        executeContentScript(tabId, 'loadAnnotations');
    }
});

// Function to execute content script with error handling
function executeContentScript(tabId, action, color = null) {
    // First try to send message to existing content script
    chrome.tabs.sendMessage(tabId, { action: action, color: color }, (response) => {
        if (chrome.runtime.lastError) {
            // Content script not loaded, inject it
            chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content.js']
            }).then(() => {
                // Wait a bit for script to initialize, then send message
                setTimeout(() => {
                    chrome.tabs.sendMessage(tabId, { action: action, color: color }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.log('Failed to communicate with content script:', chrome.runtime.lastError.message);
                        }
                    });
                }, 200);
            }).catch((error) => {
                console.log('Failed to inject content script:', error);
            });
        }
    });
}

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'notificationShown') {
        // Handle any background tasks when notifications are shown
        console.log('Notification shown:', message.message);
    }
    
    // Always send a response to avoid errors
    sendResponse({ received: true });
});

// Clean up old annotations periodically (optional)
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'cleanupAnnotations') {
        cleanupOldAnnotations();
    }
});

// Set up periodic cleanup (runs once a week)
chrome.runtime.onStartup.addListener(() => {
    chrome.alarms.create('cleanupAnnotations', { 
        delayInMinutes: 1, 
        periodInMinutes: 10080 // 1 week
    });
});

function cleanupOldAnnotations() {
    chrome.storage.sync.get({ annotations: [] }, (data) => {
        const annotations = data.annotations;
        const sixMonthsAgo = Date.now() - (6 * 30 * 24 * 60 * 60 * 1000); // 6 months
        
        const recentAnnotations = annotations.filter(annotation => 
            annotation.timestamp > sixMonthsAgo
        );
        
        if (recentAnnotations.length !== annotations.length) {
            chrome.storage.sync.set({ annotations: recentAnnotations });
            console.log(`Cleaned up ${annotations.length - recentAnnotations.length} old annotations`);
        }
    });
}