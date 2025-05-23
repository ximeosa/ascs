document.addEventListener('DOMContentLoaded', function() {
    const channelsList = document.getElementById('channels-list');
    const channelSortOptions = document.getElementById('channel-sort-options');
    const statusMessageEl = document.getElementById('status-message'); // Renamed for clarity

    function clearStatusMessage() {
        statusMessageEl.textContent = '';
        statusMessageEl.className = ''; // Clear any existing status classes
    }

    function setStatusMessage(message, type) {
        statusMessageEl.textContent = message;
        statusMessageEl.className = `status-${type}`; // e.g., status-success, status-error
        setTimeout(clearStatusMessage, 3000);
    }

    function handleDeleteChannel(channelUrl) {
        chrome.storage.sync.get({savedChannels: []}, function(data) {
            if (chrome.runtime.lastError) {
                setStatusMessage('Error loading channels for deletion.', 'error');
                console.error("Storage.get error for channels (delete):", chrome.runtime.lastError.message);
                return;
            }
            let channels = data.savedChannels.filter(channel => channel.url !== channelUrl);
            chrome.storage.sync.set({savedChannels: channels}, function() {
                if (chrome.runtime.lastError) {
                    setStatusMessage('Error deleting channel.', 'error');
                    console.error(chrome.runtime.lastError.message);
                } else {
                    setStatusMessage('Channel deleted!', 'success');
                    displaySavedChannels(); // Refresh the list
                }
            });
        });
    }

    function displaySavedChannels() {
        clearStatusMessage();
        channelsList.innerHTML = ''; // Clear current list

        chrome.storage.sync.get({savedChannels: []}, function(data) {
            if (chrome.runtime.lastError) {
                setStatusMessage('Error loading saved channels.', 'error');
                channelsList.innerHTML = '<li>Error loading channels.</li>';
                console.error("Storage.get error for savedChannels:", chrome.runtime.lastError.message);
                return;
            }

            let savedChannels = data.savedChannels || [];

            const sortValue = channelSortOptions.value;
            savedChannels.sort((a, b) => {
                if (sortValue === 'dateAdded') {
                    return new Date(b.dateAdded) - new Date(a.dateAdded);
                } else if (sortValue === 'name') {
                    return a.name.localeCompare(b.name);
                }
                return 0;
            });

            if (savedChannels.length === 0) {
                channelsList.innerHTML = '<li>No channels saved yet. Add some channels to see them here!</li>';
                return;
            }

            savedChannels.forEach(channel => {
                const listItem = document.createElement('li');

                const link = document.createElement('a');
                link.href = channel.url;
                link.textContent = channel.name;
                link.target = '_blank';

                const dateSpan = document.createElement('span');
                dateSpan.textContent = `Added: ${new Date(channel.dateAdded).toLocaleDateString()}`;
                dateSpan.style.display = 'block'; // For better readability

                const deleteButton = document.createElement('button');
                deleteButton.textContent = 'Delete';
                deleteButton.classList.add('delete-btn');
                deleteButton.dataset.channelurl = channel.url;
                deleteButton.addEventListener('click', function() {
                    handleDeleteChannel(this.dataset.channelurl);
                });

                listItem.appendChild(link);
                listItem.appendChild(dateSpan);
                listItem.appendChild(deleteButton);
                channelsList.appendChild(listItem);
            });
        });
    }

    channelSortOptions.addEventListener('change', displaySavedChannels);

    // Initial display
    displaySavedChannels();
});
