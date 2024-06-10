function Export() {
    chrome.storage.sync.get({ annotations: [] }, (data) => {
        const annotations = data.annotations;
        const json = JSON.stringify(annotations, null, 2); 
        const File = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(File);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Export.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url); 
    });
}
document.addEventListener('DOMContentLoaded', () => {
    function FilteredChanges(annotations) {
        const annotationItems = document.getElementById('annotationItems');
        annotationItems.innerHTML = '';
        const organizedAnnotations = organizeAnnotations(annotations);
        const dateKey = Object.keys(organizedAnnotations).sort((a, b) => new Date(b) - new Date(a));
        dateKey.forEach(date => {
            const dinakHeader = document.createElement('li');
            dinakHeader.textContent = date;
            dinakHeader.style.fontWeight = 'bold';
            dinakHeader.style.color = '#ffffff';
            annotationItems.appendChild(dinakHeader);
            const dateAnnotations = organizedAnnotations[date];
            dateAnnotations.forEach(annotation => {
                const li = document.createElement('li');
                li.style.color = '#ffffff';
                if (annotation.type === 'note') {
                    li.textContent = `${annotation.select}: ${annotation.text} (${new URL(annotation.url).hostname})`;
                } else {
                    li.textContent = `${annotation.text} (${new URL(annotation.url).hostname})`;
                }
                const deleteSymbol = document.createElement('i');
                deleteSymbol.classList.add("material-icons");
                deleteSymbol.textContent = ' delete';
                deleteSymbol.style.color = 'red';
                deleteSymbol.style.fontSize= '20px';
                deleteSymbol.style.marginLeft = '7px';
                deleteSymbol.addEventListener('click', () => {
                    Delete(annotation);
                });
                li.appendChild(deleteSymbol);
                annotationItems.appendChild(li);
            });
        })
    }
    function Delete(annotationToDelete) {
        chrome.storage.sync.get({ annotations: [] }, (data) => {
            const annotations = data.annotations;
            const updatedAnnotations = annotations.filter(annotation => annotation.timestamp !== annotationToDelete.timestamp);
            chrome.storage.sync.set({ annotations: updatedAnnotations }, () => {
                const organizedAnnotations = organizeAnnotations(updatedAnnotations);
                Display(organizedAnnotations);
            });
        });
    }
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
        let color = data.highlightColor ?? '#000000'; // Default to black if no color is set
        document.getElementById('highlightColor').value = color;
    });
    
    document.getElementById('highlightColor').addEventListener('input', (event) => {
        chrome.storage.sync.set({ highlightColor: event.target.value }); // Save the new color
    });
    
    document.getElementById('Highlight').addEventListener('click', () => {
        chrome.storage.sync.get('highlightColor', (data) => {
            let color = data.highlightColor ?? '#000000'; // Default to black if no color is set
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'HighlightText', color: color });
            });
        });
    });
    
    document.getElementById('AddNote').addEventListener('click', () => {
        chrome.storage.sync.get('highlightColor', (data) => {
            let color = data.highlightColor ?? '#000000'; // Default to black if no color is set
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'AddNotes', color: color });
            });
        });
    });
    

    chrome.storage.sync.get({ annotations: [] }, function(result) {
        let annotations = result.annotations;
        let organizedAnnotations = organizeAnnotations(annotations);
        Display(organizedAnnotations);
    });

    function organizeAnnotations(annotations) {
        const groupedAnnotations = {};
        annotations.forEach(annotation => {
            const dateKey = new Date(annotation.timestamp).toLocaleDateString();
            if (!groupedAnnotations[dateKey]) {
                groupedAnnotations[dateKey] = [];
            }
            groupedAnnotations[dateKey].push(annotation);
        });
    
        for (const dateKey in groupedAnnotations) {
            groupedAnnotations[dateKey].sort((a, b) => b.timestamp - a.timestamp);
        }
        return groupedAnnotations;
    }
    
    function Display(organizedAnnotations) {
        const annotationItems = document.getElementById('annotationItems');
        annotationItems.innerHTML = '';
        const dateKey = Object.keys(organizedAnnotations).sort((a, b) => new Date(b) - new Date(a));
        dateKey.forEach(date => {
            const dinakHeader = document.createElement('li');
            dinakHeader.textContent = date;
            dinakHeader.style.fontWeight = 'bold';
            dinakHeader.style.color = '	#00ff40';
            annotationItems.appendChild(dinakHeader);
            const annotations = organizedAnnotations[date];
            const rannotations = annotations.slice().reverse();
            if (rannotations.length > 3) {
                const recentAnnotations = rannotations.slice(-3).reverse();
                recentAnnotations.forEach(annotation => {
                    const li = document.createElement('li');
                    li.style.color = '#ffffff';
                    if (annotation.type == 'note') {
                        li.textContent = `${annotation.select} : ${annotation.text} (${new URL(annotation.url).hostname})`;
                    }
                    else {
                        li.textContent = `${annotation.text} (${new URL(annotation.url).hostname})`;
                    }
                    const deleteSymbol = document.createElement('i');
                    deleteSymbol.classList.add("material-icons");
                    deleteSymbol.textContent = ' delete';
                    deleteSymbol.style.color = 'red';
                    deleteSymbol.style.fontSize= '20px';
                    deleteSymbol.style.marginLeft = '7px';
                    deleteSymbol.addEventListener('click', () => {
                        Delete(annotation);
                    });
                    li.appendChild(deleteSymbol);
                    annotationItems.appendChild(li);
                });
            } else {
                const reversedAnnotations = rannotations.slice().reverse();
                reversedAnnotations.forEach(annotation => {
                    const li = document.createElement('li');
                    li.style.color = '#ffffff';
                    if (annotation.type == 'note') {
                        li.textContent = `${annotation.select}: ${annotation.text} (${new URL(annotation.url).hostname})`;
                    }
                    else {
                        li.textContent = `${annotation.text} (${new URL(annotation.url).hostname})`;
                    }
                    const deleteSymbol = document.createElement('i');
                    deleteSymbol.classList.add("material-icons");
                    deleteSymbol.textContent = ' delete';
                    deleteSymbol.style.color = 'red';
                    deleteSymbol.style.fontSize= '20px';
                    deleteSymbol.style.marginLeft = '7px';
                    deleteSymbol.addEventListener('click', () => {
                        Delete(annotation);
                    });
                    li.appendChild(deleteSymbol);
                    annotationItems.appendChild(li);
                });
            }
        })
    };
    
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
            FilteredChanges(filteredAnnotations);
        });
    });
});
document.getElementById('exportFiles').addEventListener('click', () => {
    Export();
});

