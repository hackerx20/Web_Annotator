document.addEventListener('DOMContentLoaded', () => {
    var footer = document.getElementsByClassName("footer")[0];
    var instructions = document.getElementsByClassName("instructions")[0];
    footer.addEventListener("click", () => {
        if (
            instructions.style.display == "none" ||
            instructions.style.display == ""
        ) {
            instructions.style.display = "block";
            footer.style.height = "510px";
            footer.style.transition = "1s";
            document.getElementsByClassName("instructions-up")[0].style.display =
                "none";
            document.getElementsByClassName("instructions-down")[0].style.display =
                "inline-block";
        } else {
            instructions.style.display = "none";
            footer.style.height = "40px";
            footer.style.transition = "1s";
            document.getElementsByClassName("instructions-up")[0].style.display =
                "inline-block";
            document.getElementsByClassName("instructions-down")[0].style.display =
                "none";
        }
    });
    chrome.storage.sync.get('highlightColor', (data) => {
        const color = data.highlightColor || '#000000'; //black
        document.getElementById('highlightColor').value = color;
    });
    document.getElementById('highlightColor').addEventListener('change', (event) => {
        chrome.storage.sync.set({ highlightColor: event.target.value });//color change
    });
    document.getElementById('Highlight').addEventListener('click', () => {
        chrome.storage.sync.get('highlightColor', (data) => {
            const color = data.highlightColor || '#000000';
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'HighlightText', color: color });
            });
        });
    });
    document.getElementById('AddNote').addEventListener('click', () => {
        chrome.storage.sync.get('highlightColor', (data) => {
            const color = data.highlightColor || '#000000';
            chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'AddNotes', color: color });
            });
        });
    });
    chrome.storage.sync.get({ annotations: [] }, (data) => {
        const annotations = data.annotations;
        const groupedAnnotations = groupAnnotationsByDate(annotations);
        displayAnnotations(groupedAnnotations);
    });
    function groupAnnotationsByDate(annotations) {
        const grouped = {};
        annotations.forEach(annotation => {
            const date = new Date(annotation.timestamp).toLocaleDateString();
            if (!grouped[date]) {
                grouped[date] = [];
            }
            grouped[date].push(annotation);
        });

        for (const date in grouped) {
            grouped[date].sort((a, b) => b.timestamp - a.timestamp);
        }
        return grouped;
    }
    function displayAnnotations(groupedAnnotations) {
        const annotationItems = document.getElementById('annotationItems');
        annotationItems.innerHTML = '';
        const dates = Object.keys(groupedAnnotations).sort((a, b) => new Date(b) - new Date(a));
        dates.forEach(date => {
            const dateHeader = document.createElement('li');
            dateHeader.textContent = date;
            dateHeader.style.fontWeight = 'bold';
            dateHeader.style.color = '#ffffff';
            annotationItems.appendChild(dateHeader);
            const annotations = groupedAnnotations[date];
            const rannotations = annotations.slice().reverse();
            if (rannotations.length > 3) {
                const recentAnnotations = rannotations.slice(-3).reverse();
                recentAnnotations.forEach(annotation => {
                    const li = document.createElement('li');
                    li.style.color = annotation.color;
                    if (annotation.type == 'note') {
                        li.textContent = `${annotation.select} : ${annotation.text} (${new URL(annotation.url).hostname})`;
                    }
                    else {
                        li.textContent = `${annotation.text} (${new URL(annotation.url).hostname})`;
                    }
                    const deleteIcon = document.createElement('span');
                    deleteIcon.textContent = ' \u2716';
                    deleteIcon.style.color = 'red';
                    deleteIcon.style.cursor = 'pointer';
                    deleteIcon.style.marginLeft = '5px';
                    deleteIcon.addEventListener('click', () => {
                        deleteAnnotation(annotation);
                    });
                    li.appendChild(deleteIcon);
                    annotationItems.appendChild(li);
                });
                const moreLi = document.createElement('li');
                moreLi.textContent = '...more';
                moreLi.classList.add('more-item');
                moreLi.addEventListener('click', () => {
                    displayAllAnnotations(annotations);
                });
                annotationItems.appendChild(moreLi);
            } else {
                const reversedAnnotations = rannotations.slice().reverse();
                reversedAnnotations.forEach(annotation => {
                    const li = document.createElement('li');
                    li.style.color = annotation.color;
                    if (annotation.type == 'note') {
                        li.textContent = `${annotation.select}: ${annotation.text} (${new URL(annotation.url).hostname})`;
                    }
                    else {
                        li.textContent = `${annotation.text} (${new URL(annotation.url).hostname})`;
                    }
                    const deleteIcon = document.createElement('span');
                    deleteIcon.textContent = ' \u2716';
                    deleteIcon.style.color = 'red';
                    deleteIcon.style.cursor = 'pointer';
                    deleteIcon.style.marginLeft = '5px';
                    deleteIcon.addEventListener('click', () => {
                        deleteAnnotation(annotation);
                    });
                    li.appendChild(deleteIcon);
                    annotationItems.appendChild(li);
                });
            }
        })
    };
    function displayAllAnnotations(annotations) {
        const annotationItems = document.getElementById('annotationItems');
        annotationItems.innerHTML = '';
        const date = new Date(annotations[0].timestamp).toLocaleDateString();
        const dateHeader = document.createElement('li');
        dateHeader.textContent = date;
        dateHeader.style.fontWeight = 'bold';
        dateHeader.style.color = '#ffffff';
        annotationItems.appendChild(dateHeader);
        annotations.forEach(annotation => {
            const li = document.createElement('li');
            li.style.color = annotation.color;
            if (annotation.type === 'note') {
                li.textContent = `${annotation.select}: ${annotation.text} (${new URL(annotation.url).hostname})`;
            } else {
                li.textContent = `${annotation.text} (${new URL(annotation.url).hostname})`;
            }
            const deleteIcon = document.createElement('span');
            deleteIcon.textContent = ' \u2716';
            deleteIcon.style.color = 'red';
            deleteIcon.style.cursor = 'pointer';
            deleteIcon.style.marginLeft = '5px';
            deleteIcon.addEventListener('click', () => {
                deleteAnnotation(annotation);
            });
            li.appendChild(deleteIcon);
            annotationItems.appendChild(li);
        });
    }
    document.getElementById('Search').addEventListener('click', () => {
        const searchTerm = document.getElementById('mySearch').value.toLowerCase();
        chrome.storage.sync.get({ annotations: [] }, (data) => {
            const annotations = data.annotations;
            const filteredAnnotations = annotations.filter(annotation => {
                const annotationText = annotation.type === 'note'
                    ? `${annotation.select}: ${annotation.text}`
                    : annotation.text;
                return annotationText.toLowerCase().includes(searchTerm);
            });
            displayFilteredAnnotations(filteredAnnotations);
        });
    });
    function displayFilteredAnnotations(annotations) {
        const annotationItems = document.getElementById('annotationItems');
        annotationItems.innerHTML = '';
        const groupedAnnotations = groupAnnotationsByDate(annotations);
        const dates = Object.keys(groupedAnnotations).sort((a, b) => new Date(b) - new Date(a));
        dates.forEach(date => {
            const dateHeader = document.createElement('li');
            dateHeader.textContent = date;
            dateHeader.style.fontWeight = 'bold';
            dateHeader.style.color = '#ffffff';
            annotationItems.appendChild(dateHeader);
            const dateAnnotations = groupedAnnotations[date];
            dateAnnotations.forEach(annotation => {
                const li = document.createElement('li');
                li.style.color = annotation.color;
                if (annotation.type === 'note') {
                    li.textContent = `${annotation.select}: ${annotation.text} (${new URL(annotation.url).hostname})`;
                } else {
                    li.textContent = `${annotation.text} (${new URL(annotation.url).hostname})`;
                }
                const deleteIcon = document.createElement('span');
                deleteIcon.textContent = ' \u2716';
                deleteIcon.style.color = 'red';
                deleteIcon.style.cursor = 'pointer';
                deleteIcon.style.marginLeft = '5px';
                deleteIcon.addEventListener('click', () => {
                    deleteAnnotation(annotation);
                });
                li.appendChild(deleteIcon);
                annotationItems.appendChild(li);
            });
        })
    }
    function deleteAnnotation(annotationToDelete) {
        chrome.storage.sync.get({ annotations: [] }, (data) => {
            const annotations = data.annotations;
            const updatedAnnotations = annotations.filter(annotation => annotation.timestamp !== annotationToDelete.timestamp);
            chrome.storage.sync.set({ annotations: updatedAnnotations }, () => {

                const groupedAnnotations = groupAnnotationsByDate(updatedAnnotations);
                displayAnnotations(groupedAnnotations);
            });
        });
    }
});
document.getElementById('exportIcon').addEventListener('click', () => {
    exportAnnotations();
});

function exportAnnotations() {
    chrome.storage.sync.get({ annotations: [] }, (data) => {
        const annotations = data.annotations;
        const json = JSON.stringify(annotations, null, 2); 
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        //temp div download ke liye
        const a = document.createElement('a');
        a.href = url;
        a.download = 'annotations.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url); 
    });
}