// Load and restore annotations when page loads
document.addEventListener('DOMContentLoaded', loadAnnotations);
window.addEventListener('load', loadAnnotations);

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
                highlightSpan.style.padding = '1px 2px';
                highlightSpan.dataset.annotationId = annotation.timestamp;
                
                try {
                    range.surroundContents(highlightSpan);
                    break; // Only highlight first occurrence
                } catch (e) {
                    // Handle cases where range spans multiple elements
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
        // Create note element
        const noteElement = document.createElement('div');
        noteElement.className = 'annotation-note';
        noteElement.contentEditable = true;
        noteElement.textContent = annotation.text;
        noteElement.dataset.annotationId = annotation.timestamp;
        
        // Modern note styling
        Object.assign(noteElement.style, {
            border: '2px solid #4f46e5',
            borderRadius: '8px',
            backgroundColor: '#f8fafc',
            color: '#1e293b',
            display: 'inline-block',
            marginLeft: '8px',
            padding: '8px 12px',
            fontSize: '0.875rem',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            maxWidth: '300px',
            wordWrap: 'break-word',
            position: 'relative',
            zIndex: '1000'
        });
        
        // Add to page (append to body for now - ideally would restore to original position)
        document.body.appendChild(noteElement);
        
        // Update annotation when edited
        noteElement.addEventListener('input', function() {
            updateAnnotation(annotation.timestamp, noteElement.textContent);
        });
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
        highlightSpan.style.padding = '1px 2px';
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
    const selection = window.getSelection();
    if (!selection.rangeCount) {
        showNotification('Please select text to add a note', 'warning');
        return;
    }

    const textRange = selection.getRangeAt(0);
    const selectedText = textRange.toString().trim();

    const noteElement = document.createElement('div');
    noteElement.className = 'annotation-note';
    noteElement.contentEditable = true;
    noteElement.textContent = 'Click to add your note...';
    
    // Modern note styling
    Object.assign(noteElement.style, {
        border: '2px solid #4f46e5',
        borderRadius: '8px',
        backgroundColor: '#f8fafc',
        color: '#64748b',
        display: 'inline-block',
        marginLeft: '8px',
        padding: '8px 12px',
        fontSize: '0.875rem',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        maxWidth: '300px',
        wordWrap: 'break-word',
        cursor: 'text',
        transition: 'all 0.2s ease',
        position: 'relative',
        zIndex: '1000'
    });

    // Focus styling
    noteElement.addEventListener('focus', function() {
        this.style.borderColor = '#6366f1';
        this.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
        this.style.color = '#1e293b';
        if (this.textContent === 'Click to add your note...') {
            this.textContent = '';
        }
    });

    noteElement.addEventListener('blur', function() {
        this.style.borderColor = '#4f46e5';
        this.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
        if (this.textContent.trim() === '') {
            this.textContent = 'Click to add your note...';
            this.style.color = '#64748b';
        }
    });

    textRange.collapse(false);
    textRange.insertNode(noteElement);

    const annotationDetails = {
        text: noteElement.textContent,
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

    noteElement.addEventListener('input', function() {
        annotationDetails.text = noteElement.textContent;
        updateAnnotation(annotationDetails.timestamp, noteElement.textContent);
    });

    // Auto-focus the note
    setTimeout(() => noteElement.focus(), 100);
    
    showNotification('Note added successfully!', 'success');
}

function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.annotation-notification');
    existingNotifications.forEach(notification => notification.remove());

    const notification = document.createElement('div');
    notification.className = 'annotation-notification';
    notification.textContent = message;

    const colors = {
        success: { bg: '#10b981', border: '#059669' },
        error: { bg: '#ef4444', border: '#dc2626' },
        warning: { bg: '#f59e0b', border: '#d97706' },
        info: { bg: '#3b82f6', border: '#2563eb' }
    };

    const color = colors[type] || colors.info;

    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        backgroundColor: color.bg,
        color: 'white',
        padding: '12px 16px',
        borderRadius: '8px',
        border: `2px solid ${color.border}`,
        fontSize: '14px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontWeight: '500',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        zIndex: '10000',
        maxWidth: '300px',
        wordWrap: 'break-word',
        animation: 'slideInRight 0.3s ease-out'
    });

    // Add animation keyframes
    if (!document.querySelector('#annotation-styles')) {
        const style = document.createElement('style');
        style.id = 'annotation-styles';
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideInRight 0.3s ease-out reverse';
            setTimeout(() => notification.remove(), 300);
        }
    }, 3000);
}