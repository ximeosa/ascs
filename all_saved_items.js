document.addEventListener('DOMContentLoaded', function() {
    const statusMessageEl = document.getElementById('status-message');
    const videosListEl = document.getElementById('videos-list'); // For videos from unsaved channels
    const videoSortOptionsEl = document.getElementById('video-sort-options');
    const videoCategoryFilterEl = document.getElementById('video-category-filter');
    const channelsListEl = document.getElementById('channels-list'); // For saved channels and their videos
    const channelSortOptionsEl = document.getElementById('channel-sort-options');

    // --- Common Functions ---
    function clearStatusMessage() {
        statusMessageEl.textContent = '';
        statusMessageEl.className = '';
    }

    function setStatusMessage(message, type) {
        statusMessageEl.textContent = message;
        statusMessageEl.className = `status-${type}`;
        setTimeout(clearStatusMessage, 3000);
    }

    // --- Helper for creating video list item ---
    function createVideoListItem(bookmark) {
        const listItem = document.createElement('li');
        listItem.classList.add('video-item'); // Add class for potential specific styling

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
        
        // Display channel info if available and if this video is part of "unsaved channels" list.
        // For videos under saved channels, this info is redundant.
        if (bookmark.videoChannelName && bookmark.videoChannelUrl && !listItem.closest('.channel-videos-list')) {
            const videoChannelInfoSpan = document.createElement('span');
            videoChannelInfoSpan.classList.add('item-details');
            const channelLink = document.createElement('a');
            channelLink.href = bookmark.videoChannelUrl;
            channelLink.textContent = bookmark.videoChannelName;
            channelLink.target = '_blank';
            channelLink.style.fontWeight = 'bold'; 
            videoChannelInfoSpan.appendChild(document.createTextNode('Channel: '));
            videoChannelInfoSpan.appendChild(channelLink);
            textDetailsDiv.appendChild(videoChannelInfoSpan);
        }


        contentDiv.appendChild(textDetailsDiv);

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.classList.add('delete-btn');
        deleteButton.dataset.videourl = bookmark.url;
        deleteButton.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent triggering channel collapse/expand
            handleDeleteVideo(this.dataset.videourl);
        });

        listItem.appendChild(contentDiv);
        listItem.appendChild(deleteButton);
        return listItem;
    }

    // --- Helper for creating channel list item ---
    function createChannelListItem(channel, allVideos) {
        const listItem = document.createElement('li');
        listItem.classList.add('channel-item');

        const channelInfoDiv = document.createElement('div');
        channelInfoDiv.style.display = 'flex';
        channelInfoDiv.style.justifyContent = 'space-between';
        channelInfoDiv.style.alignItems = 'center';
        channelInfoDiv.style.width = '100%';
        channelInfoDiv.style.cursor = 'pointer';


        const textDetailsDiv = document.createElement('div');
        textDetailsDiv.style.flexGrow = '1';

        const link = document.createElement('a');
        link.href = channel.url;
        link.textContent = channel.name;
        link.target = '_blank';
        link.addEventListener('click', (e) => e.stopPropagation()); // Don't toggle collapse when clicking link
        textDetailsDiv.appendChild(link);

        const dateSpan = document.createElement('span');
        dateSpan.textContent = `Added: ${new Date(channel.dateAdded).toLocaleDateString()}`;
        dateSpan.classList.add('item-details');
        textDetailsDiv.appendChild(dateSpan);
        
        const videoCount = channel.videos ? channel.videos.length : 0;
        const videoCountSpan = document.createElement('span');
        videoCountSpan.textContent = ` (${videoCount} video${videoCount !== 1 ? 's' : ''})`;
        videoCountSpan.classList.add('item-details');
        videoCountSpan.style.marginLeft = '5px';
        textDetailsDiv.appendChild(videoCountSpan);

        channelInfoDiv.appendChild(textDetailsDiv);

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete Channel';
        deleteButton.classList.add('delete-btn');
        deleteButton.dataset.channelurl = channel.url;
        deleteButton.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent expand/collapse
            handleDeleteChannel(this.dataset.channelurl);
        });
        channelInfoDiv.appendChild(deleteButton);
        listItem.appendChild(channelInfoDiv);

        const videosUl = document.createElement('ul');
        videosUl.classList.add('channel-videos-list'); // For styling, initially hidden
        videosUl.style.display = 'none';
        videosUl.style.marginLeft = '20px'; // Indent video list
        listItem.appendChild(videosUl);

        channelInfoDiv.addEventListener('click', () => {
            const isHidden = videosUl.style.display === 'none';
            videosUl.style.display = isHidden ? 'block' : 'none';
             // Simple text indicator for expand/collapse - could be replaced with an icon
            link.textContent = `${channel.name} ${isHidden ? '[-]':'[+]'}`;
        });
        
        if (videoCount > 0) {
            link.textContent = `${channel.name} [+]`; // Initial state
            renderVideosForChannel(videosUl, channel.videos, allVideos); // Pass allVideos for category filter
        }


        return listItem;
    }
    
    function renderVideosForChannel(containerUl, channelVideos, allFetchedVideos) {
        containerUl.innerHTML = ''; // Clear previous videos
        
        const categoryFilterValue = videoCategoryFilterEl.value;
        const sortValue = videoSortOptionsEl.value;

        let videosToDisplay = [...channelVideos];

        if (categoryFilterValue !== 'all') {
            videosToDisplay = videosToDisplay.filter(video => video.category === categoryFilterValue);
        }

        videosToDisplay.sort((a, b) => {
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

        if (videosToDisplay.length === 0) {
            containerUl.innerHTML = `<li class="empty-state" style="background-color: transparent; margin-left: 20px;">No videos for this channel match the current filter.</li>`;
            return;
        }

        videosToDisplay.forEach(video => {
            containerUl.appendChild(createVideoListItem(video));
        });
    }


    function populateCategoryFilter(allVideos) {
        const currentFilterValue = videoCategoryFilterEl.value;
        const allCategoriesOption = videoCategoryFilterEl.querySelector('option[value="all"]');
        videoCategoryFilterEl.innerHTML = '';
        if (allCategoriesOption) {
            videoCategoryFilterEl.appendChild(allCategoriesOption);
        }

        const categories = new Set();
        if (allVideos) {
            allVideos.forEach(bookmark => {
                if (bookmark.category) {
                    categories.add(bookmark.category);
                }
            });
        }

        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            videoCategoryFilterEl.appendChild(option);
        });

        if (Array.from(videoCategoryFilterEl.options).some(opt => opt.value === currentFilterValue)) {
            videoCategoryFilterEl.value = currentFilterValue;
        } else {
            videoCategoryFilterEl.value = 'all';
        }
    }

    function handleDeleteVideo(videoUrl) {
        chrome.storage.sync.get({bookmarks: []}, function(data) {
            if (chrome.runtime.lastError) {
                setStatusMessage('Error loading bookmarks for deletion.', 'error');
                return;
            }
            let bookmarks = data.bookmarks.filter(bookmark => bookmark.url !== videoUrl);
            chrome.storage.sync.set({bookmarks: bookmarks}, function() {
                if (chrome.runtime.lastError) {
                    setStatusMessage('Error deleting video.', 'error');
                } else {
                    setStatusMessage('Video deleted!', 'success');
                    displayGroupedItems(); 
                }
            });
        });
    }

    function handleDeleteChannel(channelUrl) {
        // Also delete videos associated with this channel from the main bookmarks list
        chrome.storage.sync.get({savedChannels: [], bookmarks: []}, function(data) {
            if (chrome.runtime.lastError) {
                setStatusMessage('Error loading data for deletion.', 'error');
                return;
            }
            let channels = data.savedChannels.filter(channel => channel.url !== channelUrl);
            let bookmarks = data.bookmarks.filter(bookmark => bookmark.videoChannelUrl !== channelUrl);

            chrome.storage.sync.set({savedChannels: channels, bookmarks: bookmarks}, function() {
                if (chrome.runtime.lastError) {
                    setStatusMessage('Error deleting channel and its videos.', 'error');
                } else {
                    setStatusMessage('Channel and its associated videos deleted!', 'success');
                    displayGroupedItems();
                }
            });
        });
    }

    async function displayGroupedItems() {
        clearStatusMessage();
        channelsListEl.innerHTML = '';
        videosListEl.innerHTML = ''; // For videos from unsaved channels

        // Adjust heading for videosListEl
        let videosFromUnsavedHeading = document.getElementById('videos-from-unsaved-heading');
        if (videosFromUnsavedHeading) videosFromUnsavedHeading.remove();


        try {
            const channelsData = await new Promise((resolve, reject) => {
                chrome.storage.sync.get({savedChannels: []}, data => {
                    if (chrome.runtime.lastError) reject(chrome.runtime.lastError.message);
                    else resolve(data.savedChannels || []);
                });
            });

            const videosData = await new Promise((resolve, reject) => {
                chrome.storage.sync.get({bookmarks: []}, data => {
                    if (chrome.runtime.lastError) reject(chrome.runtime.lastError.message);
                    else resolve(data.bookmarks || []);
                });
            });

            populateCategoryFilter(videosData); // Populate with ALL videos

            const channelsMap = new Map(channelsData.map(ch => [ch.url, {...ch, videos: []}]));
            const videosFromUnsavedChannels = [];

            videosData.forEach(video => {
                if (video.videoChannelUrl && channelsMap.has(video.videoChannelUrl)) {
                    channelsMap.get(video.videoChannelUrl).videos.push(video);
                } else {
                    videosFromUnsavedChannels.push(video);
                }
            });

            // Render Saved Channels
            const sortedChannels = Array.from(channelsMap.values()).sort((a, b) => {
                const sortValue = channelSortOptionsEl.value;
                if (sortValue === 'dateAdded') return new Date(b.dateAdded) - new Date(a.dateAdded);
                if (sortValue === 'name') return a.name.localeCompare(b.name);
                return 0;
            });

            if (sortedChannels.length === 0) {
                channelsListEl.innerHTML = '<li class="empty-state">No channels saved yet.</li>';
            } else {
                sortedChannels.forEach(channel => {
                    channelsListEl.appendChild(createChannelListItem(channel, videosData));
                });
            }

            // Render Videos from Unsaved Channels
            if (videosFromUnsavedChannels.length > 0) {
                if (!videosFromUnsavedHeading) {
                    videosFromUnsavedHeading = document.createElement('h2');
                    videosFromUnsavedHeading.id = 'videos-from-unsaved-heading';
                    videosFromUnsavedHeading.textContent = 'Videos from Unsaved/Other Channels';
                    // Insert before the videosListEl or its parent controls
                    const videoControlsSection = document.getElementById('video-controls-section');
                    videoControlsSection.parentNode.insertBefore(videosFromUnsavedHeading, videoControlsSection.nextSibling.nextSibling); // Attempt to place before videosListEl
                }
                videosFromUnsavedHeading.style.display = 'block';


                const categoryFilter = videoCategoryFilterEl.value;
                const videoSort = videoSortOptionsEl.value;
                
                let filteredUnsavedVideos = videosFromUnsavedChannels;
                if (categoryFilter !== 'all') {
                    filteredUnsavedVideos = filteredUnsavedVideos.filter(v => v.category === categoryFilter);
                }

                filteredUnsavedVideos.sort((a, b) => {
                    if (videoSort === 'dateAdded') return new Date(b.dateAdded) - new Date(a.dateAdded);
                    if (videoSort === 'category') return (a.category || 'zzzz').localeCompare(b.category || 'zzzz');
                    if (videoSort === 'title') return a.title.localeCompare(b.title);
                    return 0;
                });
                
                if(filteredUnsavedVideos.length === 0){
                    videosListEl.innerHTML = `<li class="empty-state">No videos from unsaved channels match the current filter.</li>`;
                } else {
                     filteredUnsavedVideos.forEach(video => {
                        videosListEl.appendChild(createVideoListItem(video));
                    });
                }
            } else {
                 if (videosFromUnsavedHeading) videosFromUnsavedHeading.style.display = 'none';
                 videosListEl.innerHTML = `<li class="empty-state">No videos from unsaved channels.</li>`;
            }

        } catch (error) {
            setStatusMessage(`Error displaying items: ${error}`, 'error');
            console.error(error);
            channelsListEl.innerHTML = '<li class="empty-state">Error loading channels.</li>';
            videosListEl.innerHTML = '<li class="empty-state">Error loading videos.</li>';
        }
    }

    videoSortOptionsEl.addEventListener('change', displayGroupedItems);
    videoCategoryFilterEl.addEventListener('change', displayGroupedItems);
    channelSortOptionsEl.addEventListener('change', displayGroupedItems);

    const exportDataButton = document.getElementById('export-data-button');
    if (exportDataButton) {
        exportDataButton.addEventListener('click', async function() {
            try {
                const videosData = await new Promise((resolve, reject) => {
                    chrome.storage.sync.get({bookmarks: []}, data => {
                        if (chrome.runtime.lastError) reject(chrome.runtime.lastError.message);
                        else resolve(data.bookmarks || []);
                    });
                });

                const channelsData = await new Promise((resolve, reject) => {
                    chrome.storage.sync.get({savedChannels: []}, data => {
                        if (chrome.runtime.lastError) reject(chrome.runtime.lastError.message);
                        else resolve(data.savedChannels || []);
                    });
                });

                const dataToExport = {
                    savedVideos: videosData,
                    savedChannels: channelsData
                };

                const jsonString = JSON.stringify(dataToExport, null, 2);
                const blob = new Blob([jsonString], {type: 'application/json'});
                const url = URL.createObjectURL(blob);

                const a = document.createElement('a');
                a.href = url;
                a.download = 'youtube_bookmarks_export.json';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                setStatusMessage('Data exported successfully!', 'success');

            } catch (error) {
                setStatusMessage(`Error exporting data: ${error}`, 'error');
                console.error('Export error:', error);
            }
        });
    }

    displayGroupedItems();

    const importDataButton = document.getElementById('import-data-button');
    const importFileInput = document.getElementById('import-file-input');
    const importStatusMessagesEl = document.getElementById('import-status-messages');

    if (importDataButton && importFileInput) {
        importDataButton.addEventListener('click', function() {
            importFileInput.click(); // Trigger hidden file input
        });

        importFileInput.addEventListener('change', function(event) {
            const file = event.target.files[0];
            if (!file) {
                return;
            }

            const reader = new FileReader();

            reader.onload = async function(e) {
                const fileContent = e.target.result;
                let importedData;
                try {
                    importedData = JSON.parse(fileContent);
                } catch (error) {
                    setStatusMessage('Error: Invalid JSON file.', 'error');
                    importStatusMessagesEl.textContent = 'Import failed: File is not valid JSON.';
                    console.error("Import JSON parse error:", error);
                    event.target.value = null; // Reset file input
                    return;
                }

                if (!importedData || typeof importedData !== 'object' || 
                    !Array.isArray(importedData.savedVideos) || 
                    !Array.isArray(importedData.savedChannels)) {
                    setStatusMessage('Error: Invalid data structure in file.', 'error');
                    importStatusMessagesEl.textContent = 'Import failed: JSON structure is invalid. Expected "savedVideos" and "savedChannels" arrays.';
                    event.target.value = null; // Reset file input
                    return;
                }

                try {
                    const currentStorage = await new Promise((resolve, reject) => {
                        chrome.storage.sync.get({bookmarks: [], savedChannels: []}, data => {
                            if (chrome.runtime.lastError) reject(chrome.runtime.lastError.message);
                            else resolve(data);
                        });
                    });

                    let existingBookmarks = currentStorage.bookmarks || [];
                    let existingChannels = currentStorage.savedChannels || [];
                    
                    let newVideosAdded = 0;
                    let newChannelsAdded = 0;

                    const finalBookmarks = [...existingBookmarks];
                    const existingVideoUrls = new Set(existingBookmarks.map(v => v.url));

                    importedData.savedVideos.forEach(video => {
                        if (video && video.url && !existingVideoUrls.has(video.url)) {
                            finalBookmarks.push(video);
                            existingVideoUrls.add(video.url); 
                            newVideosAdded++;
                        }
                    });

                    const finalChannels = [...existingChannels];
                    const existingChannelUrls = new Set(existingChannels.map(c => c.url));

                    importedData.savedChannels.forEach(channel => {
                        if (channel && channel.url && !existingChannelUrls.has(channel.url)) {
                            finalChannels.push(channel);
                            existingChannelUrls.add(channel.url); 
                            newChannelsAdded++;
                        }
                    });

                    await new Promise((resolve, reject) => {
                        chrome.storage.sync.set({bookmarks: finalBookmarks, savedChannels: finalChannels}, () => {
                            if (chrome.runtime.lastError) reject(chrome.runtime.lastError.message);
                            else resolve();
                        });
                    });
                    
                    const importLog = `Import complete. Added ${newVideosAdded} new video(s) and ${newChannelsAdded} new channel(s).`;
                    setStatusMessage(importLog, 'success');
                    importStatusMessagesEl.textContent = importLog;
                    displayGroupedItems();

                } catch (storageError) {
                    setStatusMessage(`Error during import storage operations: ${storageError}`, 'error');
                    importStatusMessagesEl.textContent = `Import failed: ${storageError}`;
                    console.error("Import storage error:", storageError);
                } finally {
                    event.target.value = null; // Reset file input
                }
            };

            reader.onerror = function() {
                setStatusMessage('Error reading file.', 'error');
                importStatusMessagesEl.textContent = 'Import failed: Could not read the file.';
                event.target.value = null; // Reset file input
            };

            reader.readAsText(file);
        });
    }
});
