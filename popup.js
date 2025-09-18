document.addEventListener('DOMContentLoaded', () => {
    // Initialize the popup
    initializeColorPicker();
    initializeEventListeners();
    loadAndDisplayAnnotations();
    updateAnnotationsCount();

    // Color picker functionality
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
        document.getElementById('mySearch').addEventListener('input', debounce(performSearch, 300));
        document.getElementById('mySearch').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performSearch();
            }
        });

        // Export functionality
        document.getElementById('exportFiles').addEventListener('click', exportAnnotations);

        // Help toggle
        document.getElementById('helpToggle').addEventListener('click', toggleHelp);
    }

    // Debounce function for search
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
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
                    <div class="empty-icon">📝</div>
                    <h3>No annotations found</h3>
                    <p>Try adjusting your search or start annotating pages</p>
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
                .slice(0, 10); // Show max 10 per date

            dateAnnotations.forEach(annotation => {
                const hostname = new URL(annotation.url).hostname;
                const text = annotation.type === 'note' 
                    ? `📝 ${annotation.text}`
                    : `🎨 ${annotation.text}`;
                
                html += `
                    <div class="annotation-item">
                        <div class="annotation-content">
                            <div>
                                <div class="annotation-text">${truncateText(text, 120)}</div>
                                <div class="annotation-url">${hostname}</div>
                            </div>
                            <button class="delete-btn" data-timestamp="${annotation.timestamp}" title="Delete annotation">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <polyline points="3,6 5,6 21,6"></polyline>
                                    <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                                    <line x1="10" y1="11" x2="10" y2="17"></line>
                                    <line x1="14" y1="11" x2="14" y2="17"></line>
                                </svg>
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
        if (!confirm('Are you sure you want to delete this annotation?')) {
            return;
        }

        chrome.storage.sync.get({ annotations: [] }, (data) => {
            const annotations = data.annotations;
            const updatedAnnotations = annotations.filter(annotation => 
                annotation.timestamp !== timestamp
            );
            
            chrome.storage.sync.set({ annotations: updatedAnnotations }, () => {
                loadAndDisplayAnnotations();
                showNotification('Annotation deleted successfully', 'success');
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
                exportInfo: {
                    date: new Date().toISOString(),
                    totalAnnotations: annotations.length,
                    version: '2.1'
                },
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
            a.download = `annotateme-export-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showNotification(`Successfully exported ${annotations.length} annotations`, 'success');
        });
    }

    function toggleHelp() {
        const toggle = document.getElementById('helpToggle');
        const content = document.getElementById('helpContent');
        
        toggle.classList.toggle('active');
        content.classList.toggle('show');
    }

    function showNotification(message, type = 'info') {
        // Remove existing notifications
        const existing = document.querySelectorAll('.popup-notification');
        existing.forEach(n => n.remove());

        const notification = document.createElement('div');
        notification.className = `popup-notification ${type}`;
        notification.textContent = message;
        
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };

        Object.assign(notification.style, {
            position: 'fixed',
            top: '16px',
            right: '16px',
            left: '16px',
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: colors[type] || colors.info,
            color: 'white',
            fontSize: '14px',
            fontWeight: '500',
            zIndex: '10000',
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            animation: 'slideDown 0.3s ease',
            pointerEvents: 'none'
        });

        // Add animation styles if not present
        if (!document.querySelector('#popup-notification-styles')) {
            const style = document.createElement('style');
            style.id = 'popup-notification-styles';
            style.textContent = `
                @keyframes slideDown {
                    from { transform: translateY(-100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                @keyframes slideUp {
                    from { transform: translateY(0); opacity: 1; }
                    to { transform: translateY(-100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideUp 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, 3000);
    }

    // Listen for storage changes to update UI
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync' && changes.annotations) {
            loadAndDisplayAnnotations();
        }
    });
});