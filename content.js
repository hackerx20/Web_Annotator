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

    if (selectedText) {
        const highlightSpan = document.createElement('span');
        highlightSpan.style.backgroundColor = color;

        const extractedContent = textRange.extractContents();

        extractedContent.childNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE && node.style.backgroundColor) {
                node.style.backgroundColor = '';
            }
        });

        highlightSpan.appendChild(extractedContent);

        textRange.insertNode(highlightSpan);

        userSelection.removeAllRanges();

        const newAnnotation = {
            text: selectedText,
            url: window.location.href,
            color: color,
            type: 'highlight',
            timestamp: Date.now()
        };

        chrome.storage.sync.get({ annotations: [] }, (result) => {
            const annotationsList = result.annotations;
            annotationsList.push(newAnnotation);
            chrome.storage.sync.set({ annotations: annotationsList });
        });

    } else {
        alert('Please select the text to be highlighted.');
    }
}

// function highlightselectedText(color) {
//     const userSelection = window.getSelection();
//     if (!userSelection.rangeCount) {
//         alert('Please select the text to be highlighted.');
//         return;
//     }

//     const range = userSelection.getRangeAt(0);
//     const textSelected = range.toString();

//     if (textSelected) {
//         const span = document.createElement('span');
//         span.style.backgroundColor = color;

//         const documentFragment = range.extractContents();

//         documentFragment.childNodes.forEach(node => {
//             if (node.nodeType === 1 && node.style.backgroundColor) {
//                 node.style.backgroundColor = '';
//             }
//         });

//         span.appendChild(documentFragment);

//         range.insertNode(span);

//         userSelection.removeAllRanges();

//         const annotation = {
//             text: textSelected,
//             url: window.location.href,
//             color: color,
//             type: 'HighlightText',
//             timestamp: Date.now() 
//         };

//         chrome.storage.sync.get({ annotations: [] }, (data) => {
//             const annotations = data.annotations;
//             annotations.push(annotation);
//             chrome.storage.sync.set({ annotations: annotations });
//         });

//     }
//     else {
//         alert('Please select the text to be highlighted.');
//     }
// }



console.log("Content Script Loaded");

function addNoteToSelectedText(color) {
    const userSelection = window.getSelection();
    if (userSelection.rangeCount > 0) {
        const range = userSelection.getRangeAt(0);
        const textSelected = range.toString();
        const note = document.createElement('div');
        note.contentEditable = true;
        note.style.border = '2px solid grey';
        note.style.backgroundColor = color;
        note.style.display = 'inline-block';
        note.style.marginLeft = '7px';
        note.style.padding = '4px';
        note.style.fontSize = '0.9em';
        note.textContent = 'Enter your Comment:';
        range.collapse(false);
        range.insertNode(note);

        const annotation = {
            text: note.textContent,
            url: window.location.href,
            color: color,
            type: 'note',
            select: textSelected,
            timestamp: Date.now() 
        };

        chrome.storage.sync.get({ annotations: [] }, (data) => {
            const annotations = data.annotations;
            annotations.push(annotation);
            chrome.storage.sync.set({ annotations: annotations });
        });

        note.addEventListener('input', () => {
            annotation.text = note.textContent;
            chrome.storage.sync.get({ annotations: [] }, (data) => {
                const annotations = data.annotations;
                const index = annotations.findIndex(a => a.timestamp === annotation.timestamp);
                if (index > -1) {
                    annotations[index] = annotation;
                    chrome.storage.sync.set({ annotations: annotations });
                }
            });
        });
    }
}