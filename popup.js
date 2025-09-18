document.addEventListener('DOMContentLoaded', () => {
    // Initialize UI
    initializeColorPicker();
    initializeEventListeners();
    loadAndDisplayAnnotations();
    updateAnnotationsCount();

    // Color picker initialization
    function initializeColorPicker() {
        chrome.storage.sync.get('highlightColor', (data) => {
            const color = data.highlightColor || '#fbbf24';
            document.getElementById('highlightColor').value = color;
            updateActiveColorPreset(color);
        });

        // Color input change
        document.getElementById('highlightColor').addEventListener('input', (event) => {
            const color = event.target.value;
            chrome.storage.sync.set({ highlightColor: color });
            updateActiveColorPreset(color);
        });

        // Color presets
        document.querySelectorAll('.color-preset').forEach(preset => {
            preset.addEventListener('click', () => {
                const color = preset.dataset.color;
                document.getElementById('highlightColor').value = color;
                chrome.storage.sync.set({ highlightColor: color });
                updateActiveColorPreset(color);
            });
        });
    }

    function updateActiveColorPreset(color) {
        document.querySelectorAll('.color-preset').forEach(preset => {
            preset.classList.toggle('active', preset.dataset.color === color);
        });
    }

    // Event listeners
    function initializeEventListeners() {
        // Action buttons
        document.getElementById('Highlight').addEventListener('click', () => {
            executeAction('HighlightText');
        });

        document.getElementById('AddNote').addEventListener('click', () => {
            executeAction('AddNotes');
        });

        // Search functionality
        document.getElementById('Search').addEventListener('click', performSearch);
        document.getElementById('mySearch').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performSearch();
            }
        });

        // Export functionality
        document.getElementById('exportFiles').addEventListener('click', exportAnnotations);

        // Instructions toggle
        document.getElementById('instructionsToggle').addEventListener('click', toggleInstructions);
    }

    function executeAction(action) {
        chrome.storage.sync.get('highlightColor', (data) => {
            const color = data.highlightColor || '#fbbf24';
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, { action: action, color: color }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.log('Content script not ready, injecting...');
                            chrome.scripting.executeScript({
                                target: { tabId: tabs[0].id },
                                files: ['content.js']
                            }, () => {
                                // Retry after injection
                                setTimeout(() => {
                                    chrome.tabs.sendMessage(tabs[0].id, { action: action, color: color });
                                }, 100);
                            });
                        }
                    });
                }
            });
        });
    }

    function performSearch() {
        const searchTerm = document.getElementById('mySearch').value.toLowerCase().trim();
        
        if (!searchTerm) {
            loadAndDisplayAnnotations();
            return;
        }

        chrome.storage.sync.get({ annotations: [] }, (data) => {
            const annotations = data.annotations;
            const filteredAnnotations = annotations.filter(annotation => {
                const text = annotation.type === 'note' 
                    ? `${annotation.selectedText || ''}: ${annotation.text}`
                    : annotation.text;
                const url = new URL(annotation.url).hostname;
                const title = annotation.pageTitle || '';
                
                return text.toLowerCase().includes(searchTerm) ||
                       url.toLowerCase().includes(searchTerm) ||
                       title.toLowerCase().includes(searchTerm);
            });
            
            displayAnnotations(filteredAnnotations);
            updateAnnotationsCount(filteredAnnotations.length);
        });
    }

    function loadAndDisplayAnnotations() {
        chrome.storage.sync.get({ annotations: [] }, (data) => {
            const annotations = data.annotations;
            displayAnnotations(annotations);
            updateAnnotationsCount(annotations.length);
        });
    }

    function displayAnnotations(annotations) {
        const container = document.getElementById('annotationItems');
        
        if (annotations.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="material-icons">note_alt</span>
                    <p>No annotations found</p>
                    <small>Try adjusting your search or start annotating</small>
                </div>
            `;
            return;
        }

        // Group annotations by date
        const groupedAnnotations = groupAnnotationsByDate(annotations);
        const sortedDates = Object.keys(groupedAnnotations).sort((a, b) => new Date(b) - new Date(a));

        let html = '';
        sortedDates.forEach(date => {
            html += `<div class="annotation-date">${date}</div>`;
            
            const dateAnnotations = groupedAnnotations[date]
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, 5); // Show max 5 per date

            dateAnnotations.forEach(annotation => {
                const hostname = new URL(annotation.url).hostname;
                const text = annotation.type === 'note' 
                    ? `Note: ${annotation.text}`
                    : `Highlight: ${annotation.text}`;
                
                html += `
                    <div class="annotation-item">
                        <div class="annotation-content">
                            <div>
                                <div class="annotation-text">${truncateText(text, 100)}</div>
                                <div class="annotation-url">${hostname}</div>
                            </div>
                            <button class="delete-btn" data-timestamp="${annotation.timestamp}">
                                <span class="material-icons">delete</span>
                            </button>
                        </div>
                    </div>
                `;
            });
        });

        container.innerHTML = html;

        // Add delete event listeners
        container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const timestamp = parseInt(btn.dataset.timestamp);
                deleteAnnotation(timestamp);
            });
        });
    }

    function groupAnnotationsByDate(annotations) {
        const grouped = {};
        annotations.forEach(annotation => {
            const date = new Date(annotation.timestamp).toLocaleDateString('en-US', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            if (!grouped[date]) {
                grouped[date] = [];
            }
            grouped[date].push(annotation);
        });
        return grouped;
    }

    function truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    function deleteAnnotation(timestamp) {
        chrome.storage.sync.get({ annotations: [] }, (data) => {
            const annotations = data.annotations;
            const updatedAnnotations = annotations.filter(annotation => 
                annotation.timestamp !== timestamp
            );
            
            chrome.storage.sync.set({ annotations: updatedAnnotations }, () => {
                loadAndDisplayAnnotations();
                showNotification('Annotation deleted', 'success');
            });
        });
    }

    function updateAnnotationsCount(count) {
        if (count === undefined) {
            chrome.storage.sync.get({ annotations: [] }, (data) => {
                document.getElementById('annotationsCount').textContent = data.annotations.length;
            });
        } else {
            document.getElementById('annotationsCount').textContent = count;
        }
    }

    function exportAnnotations() {
        chrome.storage.sync.get({ annotations: [] }, (data) => {
            const annotations = data.annotations;
            
            if (annotations.length === 0) {
                showNotification('No annotations to export', 'warning');
                return;
            }

            // Create enhanced export data
            const exportData = {
                exportDate: new Date().toISOString(),
                totalAnnotations: annotations.length,
                annotations: annotations.map(annotation => ({
                    ...annotation,
                    formattedDate: new Date(annotation.timestamp).toLocaleString(),
                    hostname: new URL(annotation.url).hostname
                }))
            };

            const json = JSON.stringify(exportData, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `annotations-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showNotification(`Exported ${annotations.length} annotations`, 'success');
        });
    }

    function toggleInstructions() {
        const toggle = document.getElementById('instructionsToggle');
        const instructions = document.getElementById('instructions');
        
        toggle.classList.toggle('active');
        instructions.classList.toggle('show');
    }

    function showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        // Style the notification
        Object.assign(notification.style, {
            position: 'fixed',
            top: '10px',
            right: '10px',
            padding: '12px 16px',
            borderRadius: '8px',
            color: 'white',
            fontSize: '14px',
            fontWeight: '500',
            zIndex: '10000',
            maxWidth: '300px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            animation: 'slideIn 0.3s ease'
        });

        // Set background color based on type
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };
        notification.style.backgroundColor = colors[type] || colors.info;

        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, 3000);
    }

    // Add CSS for notification animations
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    // Listen for storage changes to update UI
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync' && changes.annotations) {
            loadAndDisplayAnnotations();
        }
    });
});