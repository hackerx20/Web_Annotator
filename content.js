
chrome.runtime.onMessage.addListener((msg, src, reply) => {
    switch (msg.action) {
        case 'HighlightText':
            highlightSelectedText(msg.color);
            break;
        case 'AddNotes':
            addNoteToSelectedText(msg.color);
            break;
    }
});


function highlightSelectedText(color) {
    const userSelection = window.getSelection();
    if (!userSelection.rangeCount) {
        alert('Please select the text to be highlighted.');
        return;
    }

    const textRange = userSelection.getRangeAt(0);
    const selectedText = textRange.toString();
    alert('Done Highlight.');

    if (selectedText) {
        const highlightSpan = document.createElement('span');
        highlightSpan.style.backgroundColor = color;

        const surroundContent = textRange.extractContents();

        surroundContent.childNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE && node.style.backgroundColor) {
                node.style.backgroundColor = '';
            }
        });

        highlightSpan.appendChild(surroundContent);

        textRange.insertNode(highlightSpan);

        userSelection.removeAllRanges();

        const newAnnotation = {
            text: selectedText,
            url: window.location.href,
            color: color,
            type: 'HighlightText',
            timestamp: Date.now()
        };

        chrome.storage.sync.get({ annotations: [] }, function(data) {
            let annotationsArray = data.annotations;
            annotationsArray.push(newAnnotation);
            chrome.storage.sync.set({ annotations: annotationsArray });
        });
    } else {
        alert('Please select the text to be highlighted.');
    }
}

function addNoteToSelectedText(color) {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const textRange = selection.getRangeAt(0);
        const selectedText = textRange.toString();
    

        const noteElement = document.createElement('div');
        noteElement.contentEditable = true;
        noteElement.textContent = 'Enter your Comment:';
        noteElement.style.border = '2px solid grey';
        noteElement.style.borderRadius='10px';
        noteElement.style.backgroundColor = '#ffffff';
        noteElement.style.display = 'inline-block';
        noteElement.style.marginLeft = '7px';
        noteElement.style.padding = '4px';
        noteElement.style.fontSize = '0.9em';
        textRange.collapse(false);
        textRange.insertNode(noteElement);

        const annotationDetails = {
            text: noteElement.textContent,
            url: window.location.href,
            color: color,
            type: 'note',
            selectedText: selectedText,
            timestamp: Date.now()
        };

        chrome.storage.sync.get({ annotations: [] }, function(data) {
            const annotationsArray = data.annotations;
            annotationsArray.push(annotationDetails);
            chrome.storage.sync.set({ annotations: annotationsArray });
        });


        noteElement.addEventListener('input', function() {
            annotationDetails.text = noteElement.textContent;
            chrome.storage.sync.get({ annotations: [] }, function(result) {
                let annotationsList = result.annotations;
                let index = annotationsList.findIndex(a => a.timestamp === annotationDetails.timestamp);
                if (index > -1) {
                    annotationsList[index] = annotationDetails;
                    chrome.storage.sync.set({ annotations: annotationsList });
                }
            });
        });        
    }
}
