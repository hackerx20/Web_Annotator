chrome.action.onClicked.addListener((tab) => {
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
    });
});
chrome.commands.onCommand.addListener((command) => {
    const actions = ["HighLightText", "AddNotes"];
    
    if (actions.includes(command)) {
        chrome.storage.sync.get('highlightColor', (data) => {
            const color = data.highlightColor || '#000000';
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                chrome.tabs.sendMessage(tabs[0].id, { action: command, color: color });
            });
        });
    }
});

