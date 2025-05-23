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
          let videoId = null;
          try {
            videoId = new URL(url).searchParams.get('v');
          } catch (e) {
            console.warn("Could not parse URL to get video ID:", e);
          }
          
          let thumbnailUrl = '';
          if (videoId) {
            thumbnailUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
          }

          const category = categoryInput.value.trim();
          const bookmark = { url, title, category, dateAdded: new Date().toISOString(), thumbnailUrl: thumbnailUrl };

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

  document.getElementById('view-all-items').addEventListener('click', function() {
    chrome.tabs.create({ url: chrome.runtime.getURL('all_saved_items.html') });
  });
});
