chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getChannelInfo") {
    try {
      let channelName = null;
      let channelUrl = null;
      let videoCategory = null;
    let channelLogoUrl = null; // New variable

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
            if (channelName && channelUrl) { /* break; */ } // Don't break yet, might find category in another script tag
            // Attempt to get category from the same JSON-LD script
            if (jsonData && jsonData['@type'] === 'VideoObject' && jsonData.genre) {
              if (Array.isArray(jsonData.genre) && jsonData.genre.length > 0) {
                videoCategory = jsonData.genre[0];
              } else if (typeof jsonData.genre === 'string') {
                videoCategory = jsonData.genre;
              }
            }
            // If we have all three, we can break
            if (channelName && channelUrl && videoCategory) break;
          }
        }
      } catch (e) {
        console.warn("YouTube Bookmarker: Error parsing JSON-LD for channel/category info:", e);
      }
    }
    
    // Fallback to meta tag for category if not found via JSON-LD
    if (!videoCategory) {
      try {
        const metaGenre = document.querySelector('meta[itemprop="genre"]');
        if (metaGenre) {
          videoCategory = metaGenre.content;
        }
      } catch (e) {
        console.warn("Error accessing meta[itemprop='genre']:", e);
      }
    }

    // Attempt to find channelLogoUrl
    // This logic runs regardless of whether channelUrl was found earlier,
    // as og:image might be present on video pages and point to the channel logo,
    // or specific selectors might work on channel pages even if the earlier channelUrl logic failed.
    try {
        const metaOgImage = document.querySelector('meta[property="og:image"]');
        if (metaOgImage && metaOgImage.content) {
            channelLogoUrl = metaOgImage.content;
        }
    } catch (e) { console.warn("YouTube Bookmarker: Error accessing og:image for channel logo:", e); }

    if (!channelLogoUrl) {
        try {
            // Selectors for channel avatar/logo on channel pages or sometimes available on video pages
            const logoSelectors = [
                '#avatar img.yt-img-shadow', // Common on channel pages
                'ytd-video-owner-renderer #avatar img', // Channel avatar in video owner block
                'yt-img-shadow#avatar img', // Older/variant selector for channel avatar
                'img#img.styleable-image.yt-img-shadow' // Another older variant
            ];
            let logoElement = null;
            for (const selector of logoSelectors) {
                logoElement = document.querySelector(selector);
                if (logoElement && logoElement.src) {
                    channelLogoUrl = new URL(logoElement.src, document.baseURI).href; // Resolve relative URLs
                    break;
                }
            }
        } catch (e) { console.warn("YouTube Bookmarker: Error accessing img selectors for channel logo:", e); }
    }


    // Determine success based on whether we found at least something useful
    const foundSomething = channelName || channelUrl || videoCategory || channelLogoUrl;

      if (foundSomething) {
        sendResponse({
          success: true,
          name: channelName || null,
          url: channelUrl || null,
          category: videoCategory || null,
          logoUrl: channelLogoUrl || null
        });
      } else {
        sendResponse({ success: false, error: "Could not automatically determine any page information." });
      }
    } catch (e) {
      console.error("Content script error in getChannelInfo:", e);
      sendResponse({ 
        success: false, 
        error: "Internal content script error: " + (e.message ? e.message : "Unknown error") 
      });
    }
    return true; // Indicates that the response is sent asynchronously
  }
  // If there are other actions, they might need similar error handling or a default response.
  // For now, only "getChannelInfo" is critical.
  return true; // Ensure it returns true for other message types too, if any, to keep the port open if they are async. Or remove if no other types. For safety, keep it.
});
