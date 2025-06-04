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

chrome.storage.onChanged.addListener(async (changes, area) => {
  console.log('🔄 Storage change detected:', { area, changes });
  
  if (area === 'sync') {
    if (changes[STORAGE_KEYS.SLOP_BLOCK_ENABLED]) {
      const oldValue = changes[STORAGE_KEYS.SLOP_BLOCK_ENABLED].oldValue;
      const newEnabled = changes[STORAGE_KEYS.SLOP_BLOCK_ENABLED].newValue;
      console.log(`📱 Toggle state change: ${oldValue} → ${newEnabled}`);
      
      if (newEnabled !== isEnabled) {
        isEnabled = newEnabled;
        console.log(`✅ Extension ${isEnabled ? 'ENABLED' : 'DISABLED'} via storage change`);
        
        if (isEnabled) {
          startObserving();
          processExistingTweets();
        } else {
          stopObserving();
          clearAllEffects();
        }
      }
    }
    
    if (changes[STORAGE_KEYS.BLUR_MODE]) {
      const newBlurMode = changes[STORAGE_KEYS.BLUR_MODE].newValue;
      console.log(`🎨 Blur mode change: ${blurMode} → ${newBlurMode}`);
      if (newBlurMode !== blurMode) {
        blurMode = newBlurMode;
        if (isEnabled) {
          clearAllEffects();
          processExistingTweets();
        }
      }
    }
    
    if (changes[STORAGE_KEYS.USER_WHITELIST]) {
      const newWhitelist = changes[STORAGE_KEYS.USER_WHITELIST].newValue;
      console.log(`📝 Whitelist change:`, newWhitelist);
      userWhitelist = newWhitelist;
      if (isEnabled) {
        clearAllEffects();
        processExistingTweets();
      }
    }
  }
});

async function initialize(): Promise<void> {
  console.log('🚀 Slop Block content script initializing...');
  
  try {
    console.log('📖 Reading initial storage values...');
    isEnabled = await getStorageValue(STORAGE_KEYS.SLOP_BLOCK_ENABLED, DEFAULT_VALUES[STORAGE_KEYS.SLOP_BLOCK_ENABLED]);
    blurMode = await getStorageValue(STORAGE_KEYS.BLUR_MODE, DEFAULT_VALUES[STORAGE_KEYS.BLUR_MODE]);
    userWhitelist = await getStorageValue(STORAGE_KEYS.USER_WHITELIST, DEFAULT_VALUES[STORAGE_KEYS.USER_WHITELIST]);
    
    console.log('📊 Initial state:', { isEnabled, blurMode, whitelistLength: userWhitelist.length });
    
    debugModeEnabled = location.hostname === 'localhost' || 
                       new URLSearchParams(location.search).has('slopDebug') ||
                       location.hash === '#slopDebug';
    setDebugMode(debugModeEnabled);
    
    if (debugModeEnabled) {
      console.log('🔧 DEBUG MODE ENABLED - Verbose logging active');
    }
    
    console.log(`✅ Slop Block initialized: enabled=${isEnabled}, blurMode=${blurMode}, debug=${debugModeEnabled}`);
    
    if (isEnabled) {
      console.log('👀 Starting DOM observation...');
      startObserving();
      console.log('🔍 Processing existing tweets...');
      processExistingTweets();
    } else {
      console.log('😴 Extension disabled - skipping DOM observation');
    }
    
  } catch (error) {
    console.error('❌ Failed to initialize Slop Block:', error);
  }
}

function startObserving(): void {
  if (observer) {
    observer.disconnect();
  }
  
  let processingTimeout: number | null = null;
  let pendingNodes: Element[] = [];
  
  observer = new MutationObserver((mutations: MutationRecord[]) => {
    if (!isEnabled) {
      console.log('⚠️ Observer triggered but extension disabled');
      return;
    }
    
    // Collect all added nodes from mutations
    mutations.forEach((mutation: MutationRecord) => {
      mutation.addedNodes.forEach((node: Node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          pendingNodes.push(node as Element);
        }
      });
    });
    
    // Batch process nodes to avoid excessive processing
    if (processingTimeout) {
      clearTimeout(processingTimeout);
    }
    
    processingTimeout = setTimeout(() => {
      if (pendingNodes.length > 0) {
        console.log(`🔄 Batch processing ${pendingNodes.length} DOM changes`);
        
        // Process all pending nodes at once
        pendingNodes.forEach(node => processTweetsInNode(node));
        pendingNodes = [];
      }
    }, 200); // Batch changes within 200ms window
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  console.log('👁️ DOM observer started with batching');
}

function stopObserving(): void {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  console.log('DOM observer stopped');
}

const processExistingTweets = debounce((): void => {
  if (!isEnabled) {
    console.log('⚠️ processExistingTweets called but extension disabled');
    return;
  }
  
  // Wait for Twitter to load tweets before processing
  const checkForTweets = () => {
    console.log('🔍 Checking for existing tweets...');
    const startTime = performance.now();
    
    const tweetCount = document.querySelectorAll('[data-testid="tweet"]').length;
    console.log(`📊 Found ${tweetCount} tweet elements in DOM`);
    
    if (tweetCount > 0) {
      processTweetsInNode(document.body);
      const endTime = performance.now();
      console.log(`⏱️ Tweet processing completed in ${(endTime - startTime).toFixed(2)}ms`);
    } else {
      console.log('⏳ No tweets found yet, will retry when DOM changes');
    }
  };
  
  // Initial check
  checkForTweets();
}, 300);

function processTweetsInNode(node: Element): void {
  const tweets = findTweetElements(node);
  
  if (debugModeEnabled) {
    console.log(`🐦 Found ${tweets.length} tweet elements`);
    
    if (tweets.length === 0) {
      console.log('📄 No tweets found - checking selectors on current page');
      const testSelectors = [
        '[data-testid="tweet"]',
        'article[data-testid="tweet"]',
        '[data-testid="tweetText"]'
      ];
      testSelectors.forEach(selector => {
        const elements = node.querySelectorAll(selector);
        console.log(`🎯 Selector "${selector}": ${elements.length} elements`);
      });
    }
  }
  
  tweets.forEach((tweet, index) => {
    if (debugModeEnabled) {
      console.log(`🔄 Processing tweet ${index + 1}/${tweets.length}`);
    }
    processTweet(tweet);
  });
}

function processTweet(tweet: TweetElement): void {
  if (processedTweets.has(tweet.element)) {
    console.log('⏭️ Tweet already processed, skipping');
    return;
  }
  
  try {
    console.log('📝 Tweet details:', {
      textLength: tweet.textContent.length,
      textPreview: tweet.textContent.substring(0, 50) + (tweet.textContent.length > 50 ? '...' : ''),
      username: tweet.metadata.username,
      hasElement: !!tweet.element
    });
    
    if (tweet.metadata.username && isWhitelisted(tweet.metadata.username, userWhitelist)) {
      console.log(`✅ User "${tweet.metadata.username}" is whitelisted, skipping`);
      addDebugHighlight(tweet.element, false);
      processedTweets.add(tweet.element);
      return;
    }
    
    console.log('🤖 Running slop detection...');
    const isSlopContent = isSlop(tweet.textContent, tweet.metadata);
    console.log(`🎯 Slop detection result: ${isSlopContent ? 'SLOP DETECTED' : 'NOT SLOP'}`);
    
    if (isSlopContent) {
      console.log('🚨 SLOP DETECTED - Applying effects:', {
        text: tweet.textContent.substring(0, 100) + '...',
        username: tweet.metadata.username,
        engagement: {
          likes: tweet.metadata.likes,
          retweets: tweet.metadata.retweets,
          replies: tweet.metadata.replies
        }
      });
      
      console.log('📦 Applying collapse effect');
      applyTweetEffect(tweet.element, 'hide'); // Effect type doesn't matter, always collapses
      
      addDebugHighlight(tweet.element, true);
      
      safeRuntimeMessage({ action: 'updateCount', count: 1 });
    } else {
      console.log('✅ Tweet is not slop, removing any effects');
      removeTweetEffect(tweet.element);
      addDebugHighlight(tweet.element, false);
    }
    
    processedTweets.add(tweet.element);
    console.log(`📊 Total processed tweets: ${processedTweets.size}`);
  } catch (error) {
    console.error('❌ Error processing tweet:', error);
    console.error('🐛 Tweet data:', { element: tweet.element, text: tweet.textContent });
  }
}

function clearAllEffects(): void {
  processedTweets.forEach(element => {
    removeTweetEffect(element);
  });
  processedTweets.clear();
  console.log('All tweet effects cleared');
}

function isExtensionContextValid(): boolean {
  try {
    return !!(chrome.runtime && chrome.runtime.id);
  } catch {
    return false;
  }
}

function safeRuntimeMessage(message: any): void {
  if (!isExtensionContextValid()) {
    console.log('⚠️ Extension context invalid, skipping runtime message');
    return;
  }
  
  try {
    chrome.runtime.sendMessage(message).catch(() => {
      // Silently ignore runtime message failures
    });
  } catch {
    // Extension context invalidated during call
  }
}

// Handle messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);
  
  switch (message.action) {
    case 'toggleSlop':
      isEnabled = message.enabled;
      console.log(`✅ Extension ${isEnabled ? 'ENABLED' : 'DISABLED'} via message`);
      
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