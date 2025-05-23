chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getChannelInfo") {
    let channelName = null;
    let channelUrl = null;

    // Method 1: Try common selectors for channel link
    try {
      const channelLinkSelectors = [
        '#meta #channel-name a.yt-simple-endpoint',
        '#owner #channel-name a.yt-simple-endpoint',
        '#upload-info a.yt-simple-endpoint', // Often found in #upload-info within #meta or #owner
        'ytd-video-owner-renderer a.yt-simple-endpoint', // More general owner renderer
        '#top-row .ytd-video-owner-renderer a.yt-simple-endpoint', // Common on new UIs
        'a.ytp-title-channel-name', // In the player itself, usually for channel link in title
        // The following selector targets the channel link in the metadata section below the video.
        // It looks for a ytd-channel-name element, and then finds an anchor tag within it.
        'ytd-channel-name a.yt-simple-endpoint' 
      ];
      let channelLinkElement = null;
      for (const selector of channelLinkSelectors) {
         channelLinkElement = document.querySelector(selector);
         if (channelLinkElement && channelLinkElement.href && channelLinkElement.textContent) { // Ensure element has href and text
            // Check if the href seems like a valid channel/user/handle URL
            if (channelLinkElement.href.includes('/channel/') || channelLinkElement.href.includes('/user/') || channelLinkElement.href.includes('/@')) {
                break; 
            } else {
                channelLinkElement = null; // Not a valid channel link, continue searching
            }
         } else {
            channelLinkElement = null; // Not a valid element, continue searching
         }
      }

      if (channelLinkElement) {
        channelName = channelLinkElement.textContent.trim();
        // Ensure URL is absolute and clean
        channelUrl = new URL(channelLinkElement.href, document.baseURI).toString();
      }
    } catch (e) {
      console.warn("YouTube Bookmarker: Error accessing channel link element via querySelector:", e);
    }

    // Method 2: Try parsing JSON-LD if Method 1 failed
    if (!channelName || !channelUrl) {
      try {
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (const script of scripts) {
          const jsonData = JSON.parse(script.textContent);
          // Look for VideoObject specifically, as it's most relevant
          if (jsonData && jsonData['@type'] === 'VideoObject' && jsonData.author && jsonData.author.name && (jsonData.author.url || jsonData.author['@id'])) {
            channelName = jsonData.author.name.trim();
            channelUrl = jsonData.author.url || jsonData.author['@id'];
            if (channelUrl && channelUrl.startsWith('/')) { 
                channelUrl = 'https://www.youtube.com' + channelUrl;
            }
            // Normalize URL just in case
            if (channelUrl) {
                channelUrl = new URL(channelUrl).toString();
            }
            if (channelName && channelUrl) break; // Found good data from VideoObject
          }
        }
      } catch (e) {
        console.warn("YouTube Bookmarker: Error parsing JSON-LD for channel info:", e);
      }
    }

    if (channelName && channelUrl) {
      sendResponse({ success: true, name: channelName, url: channelUrl });
    } else {
      sendResponse({ success: false, error: "Could not automatically determine channel information." });
    }
    return true; // Indicates that the response is sent asynchronously
  }
});
