// Load and restore annotations when page loads
document.addEventListener('DOMContentLoaded', loadAnnotations);
window.addEventListener('load', loadAnnotations);

// Track active note to prevent duplicates
let activeNoteElement = null;
let isAddingNote = false;

// Listen for messages from popup and background
chrome.runtime.onMessage.addListener((msg, src, reply) => {
    switch (msg.action) {
        case 'HighlightText':
            highlightSelectedText(msg.color);
            break;
        case 'AddNotes':
            addNoteToSelectedText(msg.color);
            break;
        case 'loadAnnotations':
            loadAnnotations();
            break;
    }
});

function loadAnnotations() {
    chrome.storage.sync.get({ annotations: [] }, function(data) {
        const annotations = data.annotations;
        const currentUrl = window.location.href;
        
        // Filter annotations for current page
        const pageAnnotations = annotations.filter(annotation => 
            annotation.url === currentUrl
        );
        
        pageAnnotations.forEach(annotation => {
            if (annotation.type === 'HighlightText') {
                restoreHighlight(annotation);
            } else if (annotation.type === 'note') {
                restoreNote(annotation);
            }
        });
    });
}

function restoreHighlight(annotation) {
    try {
        // Find text nodes that contain the annotation text
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        let node;
        while (node = walker.nextNode()) {
            const text = node.textContent;
            const index = text.indexOf(annotation.text);
            
            if (index !== -1 && !node.parentElement.classList.contains('annotation-highlight')) {
                const range = document.createRange();
                range.setStart(node, index);
                range.setEnd(node, index + annotation.text.length);
                
                const highlightSpan = document.createElement('span');
                highlightSpan.className = 'annotation-highlight';
                highlightSpan.style.backgroundColor = annotation.color;
                highlightSpan.style.borderRadius = '3px';
                highlightSpan.style.padding = '2px 4px';
                highlightSpan.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';
                highlightSpan.dataset.annotationId = annotation.timestamp;
                
                try {
                    range.surroundContents(highlightSpan);
                    break;
                } catch (e) {
                    const contents = range.extractContents();
                    highlightSpan.appendChild(contents);
                    range.insertNode(highlightSpan);
                    break;
                }
            }
        }
    } catch (error) {
        console.log('Could not restore highlight:', error);
    }
}

function restoreNote(annotation) {
    try {
        const noteElement = document.createElement('div');
        noteElement.className = 'annotation-note';
        noteElement.contentEditable = true;
        noteElement.textContent = annotation.text;
        noteElement.dataset.annotationId = annotation.timestamp;
        
        Object.assign(noteElement.style, {
            position: 'absolute',
            top: '50px',
            right: '20px',
            width: '280px',
            minHeight: '60px',
            backgroundColor: '#fff',
            border: '2px solid #3b82f6',
            borderRadius: '12px',
            padding: '12px',
            fontSize: '14px',
            fontFamily: 'system-ui, sans-serif',
            boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
            zIndex: '10000',
            color: '#1f2937',
            lineHeight: '1.5',
            cursor: 'text',
            transition: 'all 0.2s ease'
        });
        
        document.body.appendChild(noteElement);
        
        noteElement.addEventListener('input', function() {
            updateAnnotation(annotation.timestamp, noteElement.textContent);
        });

        // Add delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '×';
        deleteBtn.style.cssText = `
            position: absolute;
            top: -8px;
            right: -8px;
            width: 24px;
            height: 24px;
            border: none;
            border-radius: 50%;
            background: #ef4444;
            color: white;
            font-size: 16px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        `;
        
        deleteBtn.addEventListener('click', () => {
            deleteAnnotation(annotation.timestamp);
            noteElement.remove();
        });
        
        noteElement.appendChild(deleteBtn);
        
    } catch (error) {
        console.log('Could not restore note:', error);
    }
}

function updateAnnotation(timestamp, newText) {
    chrome.storage.sync.get({ annotations: [] }, function(data) {
        let annotations = data.annotations;
        const index = annotations.findIndex(a => a.timestamp === timestamp);
        if (index > -1) {
            annotations[index].text = newText;
            chrome.storage.sync.set({ annotations: annotations });
        }
    });
}

function deleteAnnotation(timestamp) {
    chrome.storage.sync.get({ annotations: [] }, function(data) {
        let annotations = data.annotations;
        const updatedAnnotations = annotations.filter(a => a.timestamp !== timestamp);
        chrome.storage.sync.set({ annotations: updatedAnnotations });
    });
}

function highlightSelectedText(color) {
    const userSelection = window.getSelection();
    if (!userSelection.rangeCount) {
        showNotification('Please select text to highlight', 'warning');
        return;
    }

    const textRange = userSelection.getRangeAt(0);
    const selectedText = textRange.toString().trim();

    if (!selectedText) {
        showNotification('Please select text to highlight', 'warning');
        return;
    }

    try {
        const highlightSpan = document.createElement('span');
        highlightSpan.className = 'annotation-highlight';
        highlightSpan.style.backgroundColor = color;
        highlightSpan.style.borderRadius = '3px';
        highlightSpan.style.padding = '2px 4px';
        highlightSpan.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';
        highlightSpan.style.transition = 'all 0.2s ease';

        const surroundContent = textRange.extractContents();
        highlightSpan.appendChild(surroundContent);
        textRange.insertNode(highlightSpan);

        userSelection.removeAllRanges();

        const newAnnotation = {
            text: selectedText,
            url: window.location.href,
            color: color,
            type: 'HighlightText',
            timestamp: Date.now(),
            pageTitle: document.title
        };

        chrome.storage.sync.get({ annotations: [] }, function(data) {
            let annotationsArray = data.annotations;
            annotationsArray.push(newAnnotation);
            chrome.storage.sync.set({ annotations: annotationsArray });
        });

        showNotification('Text highlighted successfully!', 'success');
    } catch (error) {
        showNotification('Could not highlight selected text', 'error');
        console.error('Highlight error:', error);
    }
}

function addNoteToSelectedText(color) {
    // Prevent multiple notes from being created
    if (isAddingNote) {
        showNotification('Please finish the current note first', 'warning');
        return;
    }

    const selection = window.getSelection();
    if (!selection.rangeCount) {
        showNotification('Please select text to add a note', 'warning');
        return;
    }

    const textRange = selection.getRangeAt(0);
    const selectedText = textRange.toString().trim();

    if (!selectedText) {
        showNotification('Please select text to add a note', 'warning');
        return;
    }

    isAddingNote = true;

    // Remove any existing active note
    if (activeNoteElement) {
        activeNoteElement.remove();
        activeNoteElement = null;
    }

    const noteElement = document.createElement('div');
    noteElement.className = 'annotation-note';
    noteElement.contentEditable = true;
    noteElement.textContent = 'Type your note here...';
    
    Object.assign(noteElement.style, {
        position: 'fixed',
        top: '100px',
        right: '20px',
        width: '300px',
        minHeight: '80px',
        backgroundColor: '#ffffff',
        border: '2px solid #3b82f6',
        borderRadius: '12px',
        padding: '16px',
        fontSize: '14px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
        zIndex: '10001',
        color: '#374151',
        lineHeight: '1.6',
        cursor: 'text',
        transition: 'all 0.3s ease',
        animation: 'slideInRight 0.3s ease'
    });

    // Add animation styles
    if (!document.querySelector('#note-animations')) {
        const style = document.createElement('style');
        style.id = 'note-animations';
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    activeNoteElement = noteElement;
    document.body.appendChild(noteElement);

    // Focus and select placeholder text
    noteElement.focus();
    const range = document.createRange();
    range.selectNodeContents(noteElement);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    // Handle focus events
    noteElement.addEventListener('focus', function() {
        if (this.textContent === 'Type your note here...') {
            this.textContent = '';
        }
        this.style.borderColor = '#2563eb';
        this.style.boxShadow = '0 10px 30px rgba(37, 99, 235, 0.3)';
    });

    noteElement.addEventListener('blur', function() {
        if (this.textContent.trim() === '') {
            this.textContent = 'Type your note here...';
        }
        this.style.borderColor = '#3b82f6';
        this.style.boxShadow = '0 10px 30px rgba(0,0,0,0.2)';
    });

    // Save button
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.style.cssText = `
        position: absolute;
        bottom: -40px;
        right: 0;
        background: #10b981;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        transition: all 0.2s ease;
    `;

    saveBtn.addEventListener('click', () => {
        const noteText = noteElement.textContent.trim();
        if (noteText && noteText !== 'Type your note here...') {
            const annotationDetails = {
                text: noteText,
                url: window.location.href,
                color: color,
                type: 'note',
                selectedText: selectedText,
                timestamp: Date.now(),
                pageTitle: document.title
            };

            chrome.storage.sync.get({ annotations: [] }, function(data) {
                const annotationsArray = data.annotations;
                annotationsArray.push(annotationDetails);
                chrome.storage.sync.set({ annotations: annotationsArray });
            });

            showNotification('Note saved successfully!', 'success');
        }
        
        noteElement.remove();
        activeNoteElement = null;
        isAddingNote = false;
    });

    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = `
        position: absolute;
        bottom: -40px;
        right: 60px;
        background: #6b7280;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        transition: all 0.2s ease;
    `;

    cancelBtn.addEventListener('click', () => {
        noteElement.remove();
        activeNoteElement = null;
        isAddingNote = false;
    });

    noteElement.appendChild(saveBtn);
    noteElement.appendChild(cancelBtn);

    // Auto-save on Enter key
    noteElement.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && e.ctrlKey) {
            saveBtn.click();
        }
        if (e.key === 'Escape') {
            cancelBtn.click();
        }
    });
}

function showNotification(message, type = 'info') {
    const existingNotifications = document.querySelectorAll('.annotation-notification');
    existingNotifications.forEach(notification => notification.remove());

    const notification = document.createElement('div');
    notification.className = 'annotation-notification';
    notification.textContent = message;

    const colors = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
    };

    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        backgroundColor: colors[type] || colors.info,
        color: 'white',
        padding: '12px 20px',
        borderRadius: '8px',
        fontSize: '14px',
        fontFamily: 'system-ui, sans-serif',
        fontWeight: '500',
        boxShadow: '0 8px 25px rgba(0,0,0,0.2)',
        zIndex: '10002',
        maxWidth: '300px',
        animation: 'slideInRight 0.3s ease'
    });

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideInRight 0.3s ease reverse';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}