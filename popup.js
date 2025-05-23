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

  // New function to handle the actual saving of the video bookmark
  function saveVideoBookmark(videoUrl, videoTitle, videoCategory, channelUrl, channelName) {
    let videoId = null;
    try {
      videoId = new URL(videoUrl).searchParams.get('v');
    } catch (e) {
      // console.error("Error parsing video URL for videoId:", e); // Less noisy
      console.warn("Could not parse video URL for videoId:", e.message);
    }
    const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : '';

    const bookmark = {
      url: videoUrl,
      title: videoTitle,
      category: videoCategory,
      dateAdded: new Date().toISOString(),
      thumbnailUrl: thumbnailUrl,
      videoChannelUrl: channelUrl,
      videoChannelName: channelName
    };

    chrome.storage.sync.get({bookmarks: []}, function(data) {
      if (chrome.runtime.lastError) {
        setStatusMessage('Error loading existing bookmarks.', 'error');
        console.error("Storage.get error for bookmarks:", chrome.runtime.lastError.message);
        return;
      }
      const bookmarks = data.bookmarks;
      bookmarks.push(bookmark); // Duplicate videos are allowed
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
  }

  saveButton.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0] && tabs[0].url) {
        const tab = tabs[0];
        const url = tab.url;
        const title = tab.title;

        if (url.includes('youtube.com/watch')) {
          // Get channel info first
          chrome.tabs.sendMessage(tab.id, { action: "getChannelInfo" }, function(response) {
            let chUrl = null;
            let chName = null;
            let autoCategory = null;

            if (chrome.runtime.lastError) {
              console.warn("Error getting channel/category info:", chrome.runtime.lastError.message);
              // Set a general status message, but still allow saving.
              setStatusMessage('Could not retrieve all page details. Saving video with available info.', 'info');
            } else if (response && response.success) {
              chUrl = response.url || null;
              chName = response.name || null;
              autoCategory = response.category || null;

              if (autoCategory) {
                categoryInput.value = autoCategory; // Pre-fill category
                // Optionally, provide a subtle status message if desired, e.g.,
                // setStatusMessage('Category auto-detected: ' + autoCategory, 'info'); 
                // For now, simple pre-fill is less intrusive.
              }
              // No specific status message here if channel/category is partially missing,
              // as the content script or saveVideoBookmark might provide more context if needed.
            } else {
              // Failed to get info, or content script reported failure
              console.warn("Failed to get channel/category info:", response ? response.error : "No response");
              setStatusMessage(response && response.error ? response.error : 'Failed to get page details. Saving video.', 'info');
            }
            // The categoryInput.value will be read by saveVideoBookmark, picking up auto-filled or user-entered value.
            saveVideoBookmark(url, title, categoryInput.value.trim(), chUrl, chName);
          });
        } else {
          setStatusMessage('Not a YouTube video page.', 'info');
        }
      } else {
        setStatusMessage('Could not get current tab information.', 'error');
      }
    });
  });

  function saveChannelToStorage(channelObject) {
    chrome.storage.sync.get({savedChannels: []}, function(data) {
      if (chrome.runtime.lastError) {
        setStatusMessage('Error loading existing channels.', 'error');
        console.error("Storage.get error for channels:", chrome.runtime.lastError.message);
        return;
      }
      let savedChannels = data.savedChannels || [];
      if (savedChannels.some(c => c.url === channelObject.url)) {
        setStatusMessage('Channel already saved.', 'info');
        return;
      }
      savedChannels.push(channelObject);
      chrome.storage.sync.set({savedChannels: savedChannels}, function() {
        if (chrome.runtime.lastError) {
          setStatusMessage('Error saving channel.', 'error');
          console.error(chrome.runtime.lastError.message);
        } else {
          setStatusMessage('Channel saved!', 'success');
        }
      });
    });
  }

  saveChannelButton.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs[0] || !tabs[0].url) {
        setStatusMessage('Could not get current tab information.', 'error');
        return;
      }
      const tab = tabs[0];
      const url = tab.url;
      let title = tab.title; // Title is primarily for direct channel pages

      const isVideoUrl = url.includes('youtube.com/watch');
      const isKnownChannelUrl = url.includes('youtube.com/channel/') || url.includes('youtube.com/user/') || url.includes('youtube.com/@');

      if (isVideoUrl) {
        chrome.tabs.sendMessage(tab.id, { action: "getChannelInfo" }, function(response) {
          if (chrome.runtime.lastError) {
            setStatusMessage('Error communicating with the page to get channel info.', 'error');
            console.error("Error sending message to content script (video page):", chrome.runtime.lastError.message);
            // Potentially save with whatever info we have, or indicate failure
            // For now, we'll let the user know it failed.
            return; 
          }
          if (response && response.success && response.url && response.name) { // Ensure we have URL and Name
            const channelToSave = {
              url: response.url,
              name: response.name,
              dateAdded: new Date().toISOString(),
              logoUrl: response.logoUrl || null // Add logoUrl
            };
            saveChannelToStorage(channelToSave);
          } else {
            // If response.url or response.name is missing, it's problematic.
            let errorMsg = 'Failed to get channel info from video page.';
            if (response && response.error) errorMsg = response.error;
            else if (response && (!response.url || !response.name)) errorMsg = 'Content script returned incomplete channel info.';
            setStatusMessage(errorMsg, 'error');
          }
        });
      } else if (isKnownChannelUrl) {
        // NOW, message content script even for direct channel pages to get logo and potentially better name
        chrome.tabs.sendMessage(tab.id, { action: "getChannelInfo" }, function(response) {
          let channelName = title.replace('- YouTube', '').trim(); // Use tab title as fallback
          let channelLogo = null;

          if (chrome.runtime.lastError) {
            console.warn("Error getting info from content script on channel page:", chrome.runtime.lastError.message);
            // Proceed with tab title if content script fails
          } else if (response && response.success) {
            // Prefer content script's name & logo if available
            channelName = response.name || channelName; // Use CS name if it's valid
            channelLogo = response.logoUrl || null;
            // We could also update tab.url with response.url if it's more canonical, but prompt says use tab.url
          }
          // Note: url is tab.url from outer scope for this branch
          const channelToSave = {
            url: url, 
            name: channelName,
            dateAdded: new Date().toISOString(),
            logoUrl: channelLogo
          };
          saveChannelToStorage(channelToSave);
        });
      } else {
        setStatusMessage('Not a YouTube video or recognized channel page.', 'info');
      }
    });
  });

  document.getElementById('view-all-items').addEventListener('click', function() {
    chrome.tabs.create({ url: chrome.runtime.getURL('all_saved_items.html') });
  });
});
