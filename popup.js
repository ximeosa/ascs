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

  // Helper function for saveChannelButton when isVideoUrl is true
  function getChannelInfoAndSave(currentTabId, videoPageUrl, videoPageTitle) {
    console.log(`[Popup LOG] getChannelInfoAndSave called. Tab ID: ${currentTabId}, Video Page URL: ${videoPageUrl}, Video Page Title: ${videoPageTitle}`); // <-- ADD THIS
    // Note: videoPageUrl and videoPageTitle are currently unused but passed for potential future use
    // The content script (getChannelInfo) is expected to determine the actual channel URL and name
    chrome.tabs.sendMessage(currentTabId, { action: "getChannelInfo" }, function(response) {
      if (chrome.runtime.lastError) {
        setStatusMessage('Error communicating with the page to get channel info.', 'error');
        console.error("Error sending getChannelInfo message after ping/injection:", chrome.runtime.lastError.message);
        return; 
      }
      if (response && response.success && response.url && response.name) {
        const channelToSave = {
          url: response.url,
          name: response.name,
          dateAdded: new Date().toISOString(),
          logoUrl: response.logoUrl || null
        };
        console.log('[Popup LOG] Attempting to save channel:', JSON.stringify(channelToSave)); // <-- ADD THIS
        saveChannelToStorage(channelToSave); // saveChannelToStorage is an existing function
      } else {
        let errorMsg = 'Failed to get channel info from video page.';
        if (response && response.error) errorMsg = response.error;
        else if (response && (!response.url || !response.name)) errorMsg = 'Content script returned incomplete channel info.';
        setStatusMessage(errorMsg, 'error');
        console.warn("getChannelInfo response problematic:", response);
      }
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
      console.log(`[Popup LOG] Save Channel Button Clicked. Tab URL: ${url}, Tab Title: ${title}`); // <-- ADD THIS

      const isVideoUrl = url.includes('youtube.com/watch');
      const isKnownChannelUrl = url.includes('youtube.com/channel/') || url.includes('youtube.com/user/') || url.includes('youtube.com/@');

      if (isVideoUrl) {
        // Attempt to ping the content script first
        chrome.tabs.sendMessage(tab.id, { action: "ping" }, response => {
          if (chrome.runtime.lastError) {
            // Ping failed, runtime.lastError is set. Script is likely not there or not listening.
            console.warn("YouTube Bookmarker: Ping failed, attempting to inject content script. Error:", chrome.runtime.lastError.message);
            setStatusMessage('Initializing channel fetch...', 'info'); // Inform user

            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['get_channel_info_content_script.js']
            }, (injectionResults) => {
              if (chrome.runtime.lastError || !injectionResults || injectionResults.length === 0) {
                setStatusMessage('Failed to inject script for channel info.', 'error');
                console.error('Failed to inject get_channel_info_content_script.js:', chrome.runtime.lastError ? chrome.runtime.lastError.message : "No injection results");
                return;
              }
              console.log("YouTube Bookmarker: Content script injected successfully.");
              // After successful injection, call the helper function
              getChannelInfoAndSave(tab.id, url, title); 
            });
          } else if (response && response.success && response.action === "pong") {
            // Ping successful, content script is active
            console.log("YouTube Bookmarker: Ping successful, content script is active.");
            getChannelInfoAndSave(tab.id, url, title);
          } else {
            // Ping was received by something, but response was not the expected pong.
            setStatusMessage('Unexpected response from page, cannot get channel info.', 'error');
            console.error('Ping received unexpected response:', response);
          }
        });
      } else if (isKnownChannelUrl) {
        // Logic for direct channel pages:
        // For now, we'll keep the existing logic which tries to message directly.
        // This could also be updated to use the ping-then-inject pattern if needed.
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
