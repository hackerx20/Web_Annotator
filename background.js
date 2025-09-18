// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
    // Inject content script if not already present
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
    }).then(() => {
        // Load annotations after script injection
        chrome.tabs.sendMessage(tab.id, { action: 'loadAnnotations' });
    }).catch((error) => {
        console.log('Script injection failed:', error);
    });
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
    const actions = ["HighLightText", "AddNotes"];
    
    if (actions.includes(command)) {
        chrome.storage.sync.get('highlightColor', (data) => {
            const color = data.highlightColor || '#fbbf24';
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    // Ensure content script is loaded
                    chrome.scripting.executeScript({
                        target: { tabId: tabs[0].id },
                        files: ['content.js']
                    }).then(() => {
                        chrome.tabs.sendMessage(tabs[0].id, { action: command, color: color });
                    }).catch(() => {
                        // Script might already be loaded, try sending message anyway
                        chrome.tabs.sendMessage(tabs[0].id, { action: command, color: color });
                    });
                }
            });
        });
    }
});

// Handle tab updates to restore annotations
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
        // Inject content script and load annotations
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
        }).then(() => {
            // Small delay to ensure script is ready
            setTimeout(() => {
                chrome.tabs.sendMessage(tabId, { action: 'loadAnnotations' });
            }, 100);
        }).catch((error) => {
            // Script might already be loaded or page might not support injection
            console.log('Script injection failed for tab:', tabId, error);
        });
    }
});

// Install/update handler
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        // Set default highlight color
        chrome.storage.sync.set({ highlightColor: '#fbbf24' });
        
        // Open welcome page or show notification
        chrome.tabs.create({
            url: chrome.runtime.getURL('popup.html')
        });
    }
});