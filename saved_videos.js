document.addEventListener('DOMContentLoaded', function() {
    const videosList = document.getElementById('videos-list');
    const videoSortOptions = document.getElementById('video-sort-options');
    const videoCategoryFilter = document.getElementById('video-category-filter');
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

    function populateCategoryFilter(bookmarks) {
        const currentFilterValue = videoCategoryFilter.value;
        // Store existing "All Categories" option
        const allCategoriesOption = videoCategoryFilter.querySelector('option[value="all"]');
        videoCategoryFilter.innerHTML = ''; // Clear existing options
        if (allCategoriesOption) {
            videoCategoryFilter.appendChild(allCategoriesOption); // Add "All Categories" back
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
                    displaySavedVideos(); // Refresh the list
                }
            });
        });
    }

    function displaySavedVideos() {
        clearStatusMessage();
        videosList.innerHTML = ''; // Clear current list

        chrome.storage.sync.get({bookmarks: []}, function(data) {
            if (chrome.runtime.lastError) {
                setStatusMessage('Error loading saved videos.', 'error');
                videosList.innerHTML = '<li>Error loading videos.</li>';
                console.error("Storage.get error for bookmarks:", chrome.runtime.lastError.message);
                return;
            }

            let bookmarks = data.bookmarks || [];
            populateCategoryFilter(bookmarks); // Populate filter before filtering

            const categoryFilterValue = videoCategoryFilter.value;
            if (categoryFilterValue !== 'all') {
                bookmarks = bookmarks.filter(bookmark => bookmark.category === categoryFilterValue);
            }

            const sortValue = videoSortOptions.value;
            bookmarks.sort((a, b) => {
                if (sortValue === 'dateAdded') {
                    return new Date(b.dateAdded) - new Date(a.dateAdded);
                } else if (sortValue === 'category') {
                    const catA = a.category || 'zzzz'; // Treat undefined/empty categories as last
                    const catB = b.category || 'zzzz';
                    return catA.localeCompare(catB);
                } else if (sortValue === 'title') {
                    return a.title.localeCompare(b.title);
                }
                return 0;
            });

            if (bookmarks.length === 0) {
                videosList.innerHTML = '<li>No videos saved yet. Add some videos to see them here!</li>';
                if (categoryFilterValue !== 'all') {
                    videosList.innerHTML = '<li>No videos found for this category.</li>';
                }
                return;
            }

            bookmarks.forEach(bookmark => {
                const listItem = document.createElement('li');

                const link = document.createElement('a');
                link.href = bookmark.url;
                link.textContent = bookmark.title;
                link.target = '_blank';

                const categorySpan = document.createElement('span');
                categorySpan.textContent = `Category: ${bookmark.category || 'None'}`;
                categorySpan.style.display = 'block'; // For better readability

                const dateSpan = document.createElement('span');
                dateSpan.textContent = `Added: ${new Date(bookmark.dateAdded).toLocaleDateString()}`;
                dateSpan.style.display = 'block'; // For better readability

                const deleteButton = document.createElement('button');
                deleteButton.textContent = 'Delete';
                deleteButton.classList.add('delete-btn');
                deleteButton.dataset.videourl = bookmark.url;
                deleteButton.addEventListener('click', function() {
                    handleDeleteVideo(this.dataset.videourl);
                });

                listItem.appendChild(link);
                listItem.appendChild(categorySpan);
                listItem.appendChild(dateSpan);
                listItem.appendChild(deleteButton);
                videosList.appendChild(listItem);
            });
        });
    }

    videoSortOptions.addEventListener('change', displaySavedVideos);
    videoCategoryFilter.addEventListener('change', displaySavedVideos);

    // Initial display
    displaySavedVideos();
});
