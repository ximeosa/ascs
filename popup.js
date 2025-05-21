document.addEventListener('DOMContentLoaded', function() {
  const saveButton = document.getElementById('save-video-button');
  const categoryInput = document.getElementById('category-input');
  const statusMessage = document.getElementById('status-message');
  const saveChannelButton = document.getElementById('save-channel-button');

  function clearStatusMessage() {
    const statusMessage = document.getElementById('status-message');
    statusMessage.textContent = '';
    statusMessage.className = ''; // Clear any existing status classes
  }

  function setStatusMessage(message, type) {
    const statusMessage = document.getElementById('status-message');
    statusMessage.textContent = message;
    statusMessage.className = `status-${type}`; // e.g., status-success, status-error
     // Clear message after 3 seconds
    setTimeout(clearStatusMessage, 3000);
  }

  saveButton.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        const tab = tabs[0];
        const url = tab.url;
        const title = tab.title;

        if (url && url.includes('youtube.com/watch')) {
          const category = categoryInput.value.trim();
          const bookmark = { url, title, category, dateAdded: new Date().toISOString() };

          chrome.storage.sync.get({bookmarks: []}, function(data) {
            if (chrome.runtime.lastError) {
              setStatusMessage('Error loading existing bookmarks.', 'error');
              console.error("Storage.get error for bookmarks:", chrome.runtime.lastError.message);
              return;
            }
            const bookmarks = data.bookmarks;
            bookmarks.push(bookmark);
            chrome.storage.sync.set({bookmarks: bookmarks}, function() {
              if (chrome.runtime.lastError) {
                setStatusMessage('Error saving bookmark.', 'error');
                console.error(chrome.runtime.lastError.message);
              } else {
                setStatusMessage('Video saved!', 'success');
                categoryInput.value = ''; // Clear input field
                displaySavedItems(); // Refresh the list
              }
            });
          });
        } else {
          setStatusMessage('Not a YouTube video page.', 'info');
        }
      } else {
        setStatusMessage('Could not get current tab information.', 'error');
      }
    });
  });

  saveChannelButton.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        const tab = tabs[0];
        const url = tab.url;
        let title = tab.title;

        const isChannelUrl = url && (url.includes('youtube.com/channel/') || url.includes('youtube.com/user/') || url.includes('youtube.com/@'));

        if (isChannelUrl) {
          // Attempt to derive channel name from title
          title = title.replace('- YouTube', '').trim();
          const channel = { url, name: title, dateAdded: new Date().toISOString() };

          chrome.storage.sync.get({savedChannels: []}, function(data) {
            if (chrome.runtime.lastError) {
              setStatusMessage('Error loading existing channels.', 'error');
              console.error("Storage.get error for channels:", chrome.runtime.lastError.message);
              return;
            }
            const savedChannels = data.savedChannels;
            // Check if channel already exists
            if (savedChannels.some(c => c.url === url)) {
              setStatusMessage('Channel already saved.', 'info');
              return;
            }
            savedChannels.push(channel);
            chrome.storage.sync.set({savedChannels: savedChannels}, function() {
              if (chrome.runtime.lastError) {
                setStatusMessage('Error saving channel.', 'error');
                console.error(chrome.runtime.lastError.message);
              } else {
                setStatusMessage('Channel saved!', 'success');
                displaySavedItems(); // Refresh the list
              }
            });
          });
        } else {
          setStatusMessage('Not a YouTube channel page.', 'info');
        }
      } else {
        setStatusMessage('Could not get current tab information.', 'error');
      }
    });
  });

  function populateCategoryFilter(bookmarks) {
    const categoryFilterSelect = document.getElementById('video-category-filter');
    const currentFilterValue = categoryFilterSelect.value;
    // Store existing "All Categories" option
    const allCategoriesOption = categoryFilterSelect.querySelector('option[value="all"]');
    categoryFilterSelect.innerHTML = ''; // Clear existing options
    if (allCategoriesOption) {
      categoryFilterSelect.appendChild(allCategoriesOption); // Add "All Categories" back
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
      categoryFilterSelect.appendChild(option);
    });

    // Try to reapply the previously selected filter
    if (Array.from(categoryFilterSelect.options).some(opt => opt.value === currentFilterValue)) {
        categoryFilterSelect.value = currentFilterValue;
    } else {
        categoryFilterSelect.value = 'all'; // Default to 'all' if previous selection is no longer valid
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
          displaySavedItems(); // Refresh the list
        }
      });
    });
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
          displaySavedItems(); // Refresh the list
        }
      });
    });
  }

  function displaySavedItems() {
    clearStatusMessage(); // Clear status message at the start
    const videosList = document.getElementById('videos-list');
    const channelsList = document.getElementById('channels-list');

    videosList.innerHTML = ''; // Clear existing video items
    channelsList.innerHTML = ''; // Clear existing channel items

    const videoSortBy = document.getElementById('video-sort-options').value;
    const categoryFilter = document.getElementById('video-category-filter').value;
    const channelSortBy = document.getElementById('channel-sort-options').value;

    // Display Saved Videos
    chrome.storage.sync.get({bookmarks: []}, function(data) {
      if (chrome.runtime.lastError) {
        setStatusMessage('Error loading saved videos.', 'error');
        console.error("Storage.get error for bookmarks (display):", chrome.runtime.lastError.message);
        videosList.innerHTML = '<li class="empty-state">Error loading videos.</li>'; // Show error in list
        return;
      }
      let videos = [...(data.bookmarks || [])];
      populateCategoryFilter(videos); // Populate/update category filter dropdown

      // Filter
      if (categoryFilter !== 'all') {
        videos = videos.filter(video => video.category === categoryFilter);
      }

      // Sort Videos
      if (videoSortBy === 'dateAdded') {
        videos.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
      } else if (videoSortBy === 'category') {
        videos.sort((a, b) => {
          const categoryA = a.category || '';
          const categoryB = b.category || '';
          if (categoryA.toLowerCase() < categoryB.toLowerCase()) return -1;
          if (categoryA.toLowerCase() > categoryB.toLowerCase()) return 1;
          // Secondary sort by title if categories are same
          const titleA = a.title || '';
          const titleB = b.title || '';
          if (titleA.toLowerCase() < titleB.toLowerCase()) return -1;
          if (titleA.toLowerCase() > titleB.toLowerCase()) return 1;
          return 0;
        });
      } else if (videoSortBy === 'title') {
        videos.sort((a, b) => {
          const titleA = a.title || '';
          const titleB = b.title || '';
          if (titleA.toLowerCase() < titleB.toLowerCase()) return -1;
          if (titleA.toLowerCase() > titleB.toLowerCase()) return 1;
          return 0;
        });
      }

      if (videos.length > 0) {
        videos.forEach(function(bookmark) {
          const listItem = document.createElement('li');
          const link = document.createElement('a');
          link.href = bookmark.url;
          link.textContent = bookmark.title;
          link.target = '_blank';
          
          const categorySpan = document.createElement('span');
          categorySpan.textContent = ` (Category: ${bookmark.category || 'None'})`;
          categorySpan.className = 'item-details';
          
          const dateSpan = document.createElement('span');
          dateSpan.textContent = ` (Added: ${new Date(bookmark.dateAdded).toLocaleDateString()})`;
          dateSpan.className = 'item-details';

          const deleteButton = document.createElement('button');
          deleteButton.textContent = 'Delete';
          deleteButton.className = 'delete-btn';
          deleteButton.dataset.videourl = bookmark.url; // Use data attribute to store URL
          deleteButton.addEventListener('click', function() {
            handleDeleteVideo(this.dataset.videourl);
          });
          
          const textContainer = document.createElement('div'); // Container for text elements
          textContainer.appendChild(link);
          textContainer.appendChild(categorySpan);
          textContainer.appendChild(dateSpan);

          listItem.appendChild(textContainer); // Add text container
          listItem.appendChild(deleteButton); // Add delete button
          videosList.appendChild(listItem);
        });
      } else {
        const emptyLi = document.createElement('li');
        emptyLi.textContent = `No videos found for "${categoryFilter === 'all' ? 'any category' : categoryFilter}".`;
        emptyLi.className = 'empty-state';
        videosList.appendChild(emptyLi);
      }
    });

    // Display Saved Channels
    chrome.storage.sync.get({savedChannels: []}, function(data) {
      if (chrome.runtime.lastError) {
        setStatusMessage('Error loading saved channels.', 'error');
        console.error("Storage.get error for channels (display):", chrome.runtime.lastError.message);
        channelsList.innerHTML = '<li class="empty-state">Error loading channels.</li>'; // Show error in list
        return;
      }
      let channels = [...(data.savedChannels || [])];

      // Sort Channels
      if (channelSortBy === 'dateAdded') {
        channels.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
      } else if (channelSortBy === 'name') {
        channels.sort((a, b) => {
          const nameA = a.name || '';
          const nameB = b.name || '';
          if (nameA.toLowerCase() < nameB.toLowerCase()) return -1;
          if (nameA.toLowerCase() > nameB.toLowerCase()) return 1;
          return 0;
        });
      }

      if (channels.length > 0) {
        channels.forEach(function(channel) {
          const listItem = document.createElement('li');
          const link = document.createElement('a');
          link.href = channel.url;
          link.textContent = channel.name;
          link.target = '_blank';

          const dateSpan = document.createElement('span');
          dateSpan.textContent = ` (Added: ${new Date(channel.dateAdded).toLocaleDateString()})`;
          dateSpan.className = 'item-details';

          const deleteButton = document.createElement('button');
          deleteButton.textContent = 'Delete';
          deleteButton.className = 'delete-btn';
          deleteButton.dataset.channelurl = channel.url; // Use data attribute
          deleteButton.addEventListener('click', function() {
            handleDeleteChannel(this.dataset.channelurl);
          });

          const textContainer = document.createElement('div');
          textContainer.appendChild(link);
          textContainer.appendChild(dateSpan);
          
          listItem.appendChild(textContainer);
          listItem.appendChild(deleteButton);
          channelsList.appendChild(listItem);
        });
      } else {
        const emptyLi = document.createElement('li');
        emptyLi.textContent = 'No channels saved yet.';
        emptyLi.className = 'empty-state';
        channelsList.appendChild(emptyLi);
      }
    });
  }

  // Event listeners for sort/filter controls
  document.getElementById('video-sort-options').addEventListener('change', displaySavedItems);
  document.getElementById('video-category-filter').addEventListener('change', displaySavedItems);
  document.getElementById('channel-sort-options').addEventListener('change', displaySavedItems);
  
  // Initial display of saved items when popup loads
  displaySavedItems();
});
