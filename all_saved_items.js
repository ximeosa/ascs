document.addEventListener('DOMContentLoaded', function() {
    // Common elements
    const statusMessageEl = document.getElementById('status-message');

    // Video specific elements
    const videosList = document.getElementById('videos-list');
    const videoSortOptions = document.getElementById('video-sort-options');
    const videoCategoryFilter = document.getElementById('video-category-filter');

    // Channel specific elements
    const channelsList = document.getElementById('channels-list');
    const channelSortOptions = document.getElementById('channel-sort-options');

    // --- Common Functions ---
    function clearStatusMessage() {
        statusMessageEl.textContent = '';
        statusMessageEl.className = ''; // Clear any existing status classes
    }

    function setStatusMessage(message, type) {
        statusMessageEl.textContent = message;
        statusMessageEl.className = `status-${type}`; // e.g., status-success, status-error
        setTimeout(clearStatusMessage, 3000);
    }

    // --- Video Logic (Adapted from saved_videos.js) ---
    function populateCategoryFilter(bookmarks) {
        const currentFilterValue = videoCategoryFilter.value;
        const allCategoriesOption = videoCategoryFilter.querySelector('option[value="all"]');
        videoCategoryFilter.innerHTML = ''; 
        if (allCategoriesOption) {
            videoCategoryFilter.appendChild(allCategoriesOption); 
        }

        const categories = new Set();
        if (bookmarks) {
            bookmarks.forEach(bookmark => {
                if (bookmark.category) {
                    categories.add(bookmark.category);
                }
            });
        }

        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            videoCategoryFilter.appendChild(option);
        });

        if (Array.from(videoCategoryFilter.options).some(opt => opt.value === currentFilterValue)) {
            videoCategoryFilter.value = currentFilterValue;
        } else {
            videoCategoryFilter.value = 'all';
        }
    }

    function handleDeleteVideo(videoUrl) {
        chrome.storage.sync.get({bookmarks: []}, function(data) {
            if (chrome.runtime.lastError) {
                setStatusMessage('Error loading bookmarks for deletion.', 'error');
                console.error("Storage.get error for bookmarks (delete):", chrome.runtime.lastError.message);
                return;
            }
            let bookmarks = data.bookmarks.filter(bookmark => bookmark.url !== videoUrl);
            chrome.storage.sync.set({bookmarks: bookmarks}, function() {
                if (chrome.runtime.lastError) {
                    setStatusMessage('Error deleting video.', 'error');
                    console.error(chrome.runtime.lastError.message);
                } else {
                    setStatusMessage('Video deleted!', 'success');
                    displaySavedVideos(); // Refresh the video list
                }
            });
        });
    }

    function displaySavedVideos() {
        clearStatusMessage();
        videosList.innerHTML = ''; 

        chrome.storage.sync.get({bookmarks: []}, function(data) {
            if (chrome.runtime.lastError) {
                setStatusMessage('Error loading saved videos.', 'error');
                videosList.innerHTML = '<li class="empty-state">Error loading videos.</li>';
                console.error("Storage.get error for bookmarks:", chrome.runtime.lastError.message);
                return;
            }

            let bookmarks = data.bookmarks || [];
            populateCategoryFilter(bookmarks); 

            const categoryFilterValue = videoCategoryFilter.value;
            if (categoryFilterValue !== 'all') {
                bookmarks = bookmarks.filter(bookmark => bookmark.category === categoryFilterValue);
            }

            const sortValue = videoSortOptions.value;
            bookmarks.sort((a, b) => {
                if (sortValue === 'dateAdded') {
                    return new Date(b.dateAdded) - new Date(a.dateAdded);
                } else if (sortValue === 'category') {
                    const catA = a.category || 'zzzz'; 
                    const catB = b.category || 'zzzz';
                    return catA.localeCompare(catB);
                } else if (sortValue === 'title') {
                    return a.title.localeCompare(b.title);
                }
                return 0;
            });

            if (bookmarks.length === 0) {
                videosList.innerHTML = `<li class="empty-state">No videos saved yet. ${categoryFilterValue !== 'all' ? 'for this category.' : 'Add some videos to see them here!'}</li>`;
                return;
            }

            bookmarks.forEach(bookmark => {
                const listItem = document.createElement('li');

                const contentDiv = document.createElement('div');
                contentDiv.style.display = 'flex';
                contentDiv.style.alignItems = 'center';
                contentDiv.style.flexGrow = '1';

                if (bookmark.thumbnailUrl) {
                    const img = document.createElement('img');
                    img.src = bookmark.thumbnailUrl;
                    img.alt = `Thumbnail for ${bookmark.title}`;
                    img.style.width = '120px';
                    img.style.height = '90px';
                    img.style.marginRight = '10px';
                    img.style.objectFit = 'cover';
                    contentDiv.appendChild(img);
                }

                const textDetailsDiv = document.createElement('div');

                const link = document.createElement('a');
                link.href = bookmark.url;
                link.textContent = bookmark.title;
                link.target = '_blank';
                textDetailsDiv.appendChild(link);

                const categorySpan = document.createElement('span');
                categorySpan.textContent = `Category: ${bookmark.category || 'None'}`;
                categorySpan.classList.add('item-details');
                textDetailsDiv.appendChild(categorySpan);

                const dateSpan = document.createElement('span');
                dateSpan.textContent = `Added: ${new Date(bookmark.dateAdded).toLocaleDateString()}`;
                dateSpan.classList.add('item-details');
                textDetailsDiv.appendChild(dateSpan);
                
                contentDiv.appendChild(textDetailsDiv);

                const deleteButton = document.createElement('button');
                deleteButton.textContent = 'Delete';
                deleteButton.classList.add('delete-btn');
                deleteButton.dataset.videourl = bookmark.url;
                deleteButton.addEventListener('click', function() {
                    handleDeleteVideo(this.dataset.videourl);
                });

                listItem.appendChild(contentDiv);
                listItem.appendChild(deleteButton);
                videosList.appendChild(listItem);
            });
        });
    }

    // --- Channel Logic (Adapted from saved_channels.js) ---
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
                    displaySavedChannels(); // Refresh the channel list
                }
            });
        });
    }

    function displaySavedChannels() {
        clearStatusMessage();
        channelsList.innerHTML = ''; 

        chrome.storage.sync.get({savedChannels: []}, function(data) {
            if (chrome.runtime.lastError) {
                setStatusMessage('Error loading saved channels.', 'error');
                channelsList.innerHTML = '<li class="empty-state">Error loading channels.</li>';
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
                channelsList.innerHTML = '<li class="empty-state">No channels saved yet. Add some channels to see them here!</li>';
                return;
            }

            savedChannels.forEach(channel => {
                const listItem = document.createElement('li');
                
                const contentDiv = document.createElement('div'); // For text content, to align with video structure
                contentDiv.style.flexGrow = '1'; // Allow it to take up space

                const link = document.createElement('a');
                link.href = channel.url;
                link.textContent = channel.name;
                link.target = '_blank';
                contentDiv.appendChild(link);

                const dateSpan = document.createElement('span');
                dateSpan.textContent = `Added: ${new Date(channel.dateAdded).toLocaleDateString()}`;
                dateSpan.classList.add('item-details');
                contentDiv.appendChild(dateSpan);

                const deleteButton = document.createElement('button');
                deleteButton.textContent = 'Delete';
                deleteButton.classList.add('delete-btn');
                deleteButton.dataset.channelurl = channel.url;
                deleteButton.addEventListener('click', function() {
                    handleDeleteChannel(this.dataset.channelurl);
                });

                listItem.appendChild(contentDiv);
                listItem.appendChild(deleteButton);
                channelsList.appendChild(listItem);
            });
        });
    }

    // --- Event Listeners ---
    videoSortOptions.addEventListener('change', displaySavedVideos);
    videoCategoryFilter.addEventListener('change', displaySavedVideos);
    channelSortOptions.addEventListener('change', displaySavedChannels);

    // --- Initial Display Calls ---
    displaySavedVideos();
    displaySavedChannels();
});
