import { getStorageValue, setStorageValue, STORAGE_KEYS, DEFAULT_VALUES } from '../utils/storage';
import { getTweetElements, extractTweetData, applyTweetEffect, removeTweetEffect, addDebugHighlight } from '../utils/dom';
import { analyzeTweet } from '../rules/rules';

let isEnabled = false;
let processingQueue: Element[] = [];
let isProcessingQueue = false;
let observer: MutationObserver | null = null;
let loadCheckInterval: number | null = null;
let navigationTimeout: number | null = null;

function log(...args: any[]): void {
  console.log('[SlopBlock Content]', ...args);
}

function isTwitterLoaded(): boolean {
  return document.querySelectorAll('[data-testid="tweet"]').length > 0;
}

function startLoadCheck(): void {
  if (loadCheckInterval) {
    clearInterval(loadCheckInterval);
  }
  
  loadCheckInterval = window.setInterval(() => {
    log('⏳ Checking if Twitter is loaded...');
    if (isTwitterLoaded()) {
      log('✅ Twitter loaded, starting slop detection');
      clearInterval(loadCheckInterval!);
      loadCheckInterval = null;
      
      if (isEnabled) {
        initializeSlop();
      }
    }
  }, 1000);
}

function debugLog(...args: any[]): void {
  if (window.location.hash.includes('slopDebug')) {
    console.log('[SlopBlock Debug]', ...args);
  }
}

function addToProcessingQueue(element: Element): void {
  if (!processingQueue.includes(element)) {
    processingQueue.push(element);
  }
  
  if (!isProcessingQueue) {
    scheduleQueueProcessing();
  }
}

function scheduleQueueProcessing(): void {
  if (isProcessingQueue) return;
  
  isProcessingQueue = true;
  setTimeout(() => {
    processQueue();
    isProcessingQueue = false;
  }, 200);
}

function processQueue(): void {
  if (processingQueue.length === 0) return;
  
  log(`📦 Processing queue of ${processingQueue.length} elements`);
  
  const currentQueue = [...processingQueue];
  processingQueue = [];
  
  currentQueue.forEach(element => {
    if (document.contains(element)) {
      processTweet(element as HTMLElement);
    }
  });
}

function initializeSlop(): void {
  if (!isEnabled) {
    log('❌ Slop detection disabled, skipping initialization');
    return;
  }

  log('🚀 Initializing slop detection system...');
  
  startObserver();
  
  setTimeout(() => {
    processTweets();
  }, 500);
}

function processTweets(): void {
  log('🔍 Scanning for tweets...');
  
  const tweets = getTweetElements();
  log(`📊 Found ${tweets.length} unprocessed tweets`);
  
  tweets.forEach(element => {
    addToProcessingQueue(element);
  });
}

function processTweet(element: HTMLElement): void {
  try {
    const tweet = extractTweetData(element);
    if (!tweet) {
      debugLog('❌ Could not extract tweet data from element:', element);
      return;
    }

    debugLog('📝 Processing tweet:', {
      username: tweet.username,
      textLength: tweet.text.length,
      textPreview: tweet.text.substring(0, 100)
    });

    const analysis = analyzeTweet(tweet);
    
    debugLog('🎯 Analysis result:', {
      isSlop: analysis.isSlop,
      confidence: analysis.confidence,
      reasons: analysis.reasons
    });

    if (analysis.isSlop) {
      log(`🚫 SLOP DETECTED (confidence: ${(analysis.confidence * 100).toFixed(1)}%):`, {
        username: tweet.username,
        reasons: analysis.reasons,
        text: tweet.text.substring(0, 100) + '...'
      });
      
      applyTweetEffect(tweet.element, 'hide');
    }

    addDebugHighlight(tweet.element, analysis.isSlop);
    tweet.element.closest('article')?.setAttribute('data-slop-processed', 'true');

  } catch (error) {
    console.error('❌ Error processing tweet:', error, element);
  }
}

function startObserver(): void {
  if (observer) {
    observer.disconnect();
  }

  observer = new MutationObserver((mutations) => {
    if (!isEnabled) return;

    const addedNodes: Element[] = [];
    
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;
          
          const tweets = element.querySelectorAll ? 
            Array.from(element.querySelectorAll('[data-testid="tweet"]')) : [];
          
          if (element.matches && element.matches('[data-testid="tweet"]')) {
            tweets.push(element);
          }
          
          addedNodes.push(...tweets);
        }
      });
    });

    if (addedNodes.length > 0) {
      debugLog(`👀 Observer detected ${addedNodes.length} new tweet(s)`);
      addedNodes.forEach(element => {
        addToProcessingQueue(element);
      });
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false
  });

  log('👁️ MutationObserver started for dynamic content detection');
}

function stopObserver(): void {
  if (observer) {
    observer.disconnect();
    observer = null;
    log('🛑 MutationObserver stopped');
  }
}

function cleanupSlop(): void {
  log('🧹 Cleaning up slop effects...');
  
  const processedTweets = document.querySelectorAll('[data-slop-processed="true"]');
  processedTweets.forEach(tweet => {
    const tweetElement = tweet as HTMLElement;
    removeTweetEffect(tweetElement);
    tweetElement.removeAttribute('data-slop-processed');
  });
  
  log(`✅ Cleaned up ${processedTweets.length} processed tweets`);
}

async function updateState(enabled: boolean): Promise<void> {
  const wasEnabled = isEnabled;
  isEnabled = enabled;
  
  log(`🔄 State changed: ${wasEnabled} → ${enabled}`);
  
  if (enabled && !wasEnabled) {
    if (isTwitterLoaded()) {
      initializeSlop();
    } else {
      startLoadCheck();
    }
  } else if (!enabled && wasEnabled) {
    stopObserver();
    cleanupSlop();
    if (loadCheckInterval) {
      clearInterval(loadCheckInterval);
      loadCheckInterval = null;
    }
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (message.action === 'stateChanged') {
      updateState(message.enabled);
      sendResponse({ success: true });
    }
  } catch (error) {
    console.error('Error in message listener:', error);
    sendResponse({ success: false, error: String(error) });
  }
  
  return true;
});

function handleNavigation(): void {
  log('🧭 Navigation detected, reinitializing...');
  
  if (navigationTimeout) {
    clearTimeout(navigationTimeout);
  }
  
  navigationTimeout = window.setTimeout(() => {
    if (isEnabled) {
      processTweets();
    }
  }, 1000);
}

let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    handleNavigation();
  }
}).observe(document, { subtree: true, childList: true });

async function initialize(): Promise<void> {
  try {
    log('🔧 Initializing content script...');
    
    const enabled = await getStorageValue(STORAGE_KEYS.SLOP_BLOCK_ENABLED, DEFAULT_VALUES[STORAGE_KEYS.SLOP_BLOCK_ENABLED]);
    log(`📊 Initial state from storage: ${enabled}`);
    
    await updateState(enabled);
    
    if (!isTwitterLoaded()) {
      log('⏳ Twitter not loaded yet, starting load check...');
      startLoadCheck();
    }
    
    log('✅ Content script initialization complete');
  } catch (error) {
    console.error('❌ Content script initialization failed:', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}