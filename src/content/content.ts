import { findTweetElements, applyTweetEffect, removeTweetEffect, throttle, debounce, TweetElement, setDebugMode, replaceWithHiddenMessage, addDebugHighlight } from '../utils/dom';
import { getStorageValue, STORAGE_KEYS, DEFAULT_VALUES } from '../utils/storage';
import { isSlop, isWhitelisted } from '../rules/rules';

// Extension state variables
let observer: MutationObserver | null = null;
let isEnabled = false;
let blurMode = true;
let debugModeEnabled = false;
let userWhitelist: string[] = [];
let processedTweets = new Set<Element>();

async function initialize(): Promise<void> {
  console.log('Slop Block content script initializing...');
  
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getState' });
    if (response) {
      isEnabled = response.enabled;
      blurMode = response.blurMode;
    }
    
    userWhitelist = await getStorageValue(STORAGE_KEYS.USER_WHITELIST, DEFAULT_VALUES[STORAGE_KEYS.USER_WHITELIST]);
    
    // Enable debug mode if in development (check for localhost or specific debug parameter)
    debugModeEnabled = location.hostname === 'localhost' || 
                       new URLSearchParams(location.search).has('slopDebug') ||
                       location.hash.includes('slopDebug');
    setDebugMode(debugModeEnabled);
    
    console.log(`Slop Block initialized: enabled=${isEnabled}, blurMode=${blurMode}, debug=${debugModeEnabled}`);
    
    if (isEnabled) {
      startObserving();
    }
    
    processExistingTweets();
    
  } catch (error) {
    console.error('Failed to initialize Slop Block:', error);
  }
}

function startObserving(): void {
  if (observer) {
    observer.disconnect();
  }
  
  observer = new MutationObserver(throttle((mutations: MutationRecord[]) => {
    if (!isEnabled) return;
    
    mutations.forEach((mutation: MutationRecord) => {
      mutation.addedNodes.forEach((node: Node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          processTweetsInNode(node as Element);
        }
      });
    });
  }, 100));
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  console.log('DOM observer started');
}

function stopObserving(): void {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  console.log('DOM observer stopped');
}

const processExistingTweets = debounce((): void => {
  if (!isEnabled) return;
  
  console.log('Processing existing tweets...');
  processTweetsInNode(document.body);
}, 200);

function processTweetsInNode(node: Element): void {
  const tweets = findTweetElements(node);
  tweets.forEach(tweet => processTweet(tweet));
}

function processTweet(tweet: TweetElement): void {
  if (processedTweets.has(tweet.element)) {
    return;
  }
  
  try {
    // Debug: Log tweet processing
    if (debugModeEnabled) {
      console.log('Processing tweet:', {
        textLength: tweet.textContent.length,
        textPreview: tweet.textContent.substring(0, 100),
        username: tweet.metadata.username,
        element: tweet.element
      });
    }
    
    if (tweet.metadata.username && isWhitelisted(tweet.metadata.username, userWhitelist)) {
      addDebugHighlight(tweet.element, false);
      processedTweets.add(tweet.element);
      return;
    }
    
    const isSlopContent = isSlop(tweet.textContent, tweet.metadata);
    
    if (isSlopContent) {
      console.log('🚨 Slop detected:', {
        text: tweet.textContent.substring(0, 100) + '...',
        username: tweet.metadata.username,
        engagement: {
          likes: tweet.metadata.likes,
          retweets: tweet.metadata.retweets,
          replies: tweet.metadata.replies
        }
      });
      
      // Use content replacement instead of just CSS effects
      if (blurMode) {
        // Old blur effect as fallback
        applyTweetEffect(tweet.element, 'blur');
      } else {
        // New content replacement
        replaceWithHiddenMessage(tweet.element);
      }
      
      addDebugHighlight(tweet.element, true);
      
      chrome.runtime.sendMessage({ action: 'updateCount', count: 1 })
        .catch(error => console.log('Background script not ready:', error));
    } else {
      removeTweetEffect(tweet.element);
      addDebugHighlight(tweet.element, false);
    }
    
    processedTweets.add(tweet.element);
  } catch (error) {
    console.error('Error processing tweet:', error);
    if (debugModeEnabled) {
      console.error('Tweet element:', tweet.element);
      console.error('Tweet text:', tweet.textContent);
    }
  }
}

function clearAllEffects(): void {
  processedTweets.forEach(element => {
    removeTweetEffect(element);
  });
  processedTweets.clear();
  console.log('All tweet effects cleared');
}

// Handle messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);
  
  switch (message.action) {
    case 'toggleSlop':
      isEnabled = message.enabled;
      console.log(`Slop Block ${isEnabled ? 'enabled' : 'disabled'}`);
      
      if (isEnabled) {
        startObserving();
        processExistingTweets();
      } else {
        stopObserving();
        clearAllEffects();
      }
      break;
      
    case 'updateSettings':
      if (message.blurMode !== undefined) {
        blurMode = message.blurMode;
        if (isEnabled) {
          clearAllEffects();
          processExistingTweets();
        }
      }
      if (message.whitelist !== undefined) {
        userWhitelist = message.whitelist;
        if (isEnabled) {
          clearAllEffects();
          processExistingTweets();
        }
      }
      break;
      
    default:
      console.warn('Unknown message action:', message.action);
  }
  
  sendResponse({ success: true });
  return true;
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Handle SPA navigation
let currentUrl = location.href;
new MutationObserver(() => {
  if (location.href !== currentUrl) {
    currentUrl = location.href;
    console.log('Page navigation detected, reinitializing...');
    
    processedTweets.clear();
    
    setTimeout(() => {
      if (isEnabled) {
        processExistingTweets();
      }
    }, 1000);
  }
}).observe(document, { subtree: true, childList: true });

console.log('Slop Block content script loaded'); 