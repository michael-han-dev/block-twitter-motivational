/**
 * Content script for Slop Block extension
 * Runs on Twitter/X pages to detect and hide/blur slop content
 */

import { findTweetElements, applyTweetEffect, removeTweetEffect, throttle, TweetElement } from '../utils/dom';
import { getStorageValue, STORAGE_KEYS, DEFAULT_VALUES } from '../utils/storage';
import { isSlop, isWhitelisted } from '../rules/rules';

// Extension state
let isEnabled = false;
let blurMode = true;
let userWhitelist: string[] = [];
let processedTweets = new Set<Element>();

/**
 * Initialize the content script
 */
async function initialize(): Promise<void> {
  console.log('Slop Block content script initializing...');
  
  try {
    // Get initial state from background
    const response = await chrome.runtime.sendMessage({ action: 'getState' });
    if (response) {
      isEnabled = response.enabled;
      blurMode = response.blurMode;
    }
    
    // Get user whitelist
    userWhitelist = await getStorageValue(STORAGE_KEYS.USER_WHITELIST, DEFAULT_VALUES[STORAGE_KEYS.USER_WHITELIST]);
    
    console.log(`Slop Block initialized: enabled=${isEnabled}, blurMode=${blurMode}`);
    
    // Start observing if enabled
    if (isEnabled) {
      startObserving();
    }
    
    // Process existing tweets
    processExistingTweets();
    
  } catch (error) {
    console.error('Failed to initialize Slop Block:', error);
  }
}

/**
 * Start observing DOM changes for new tweets
 */
function startObserving(): void {
  if (observer) {
    observer.disconnect();
  }
  
  observer = new MutationObserver(throttle((mutations) => {
    if (!isEnabled) return;
    
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
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

/**
 * Stop observing DOM changes
 */
function stopObserving(): void {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  console.log('DOM observer stopped');
}

/**
 * Process existing tweets on the page
 */
function processExistingTweets(): void {
  if (!isEnabled) return;
  
  console.log('Processing existing tweets...');
  processTweetsInNode(document.body);
}

/**
 * Process tweets in a given DOM node
 */
function processTweetsInNode(node: Element): void {
  const tweets = findTweetElements(node);
  tweets.forEach(tweet => processTweet(tweet));
}

/**
 * Process a single tweet
 */
function processTweet(tweet: TweetElement): void {
  // Skip if already processed
  if (processedTweets.has(tweet.element)) {
    return;
  }
  
  try {
    // Check if user is whitelisted
    if (tweet.metadata.username && isWhitelisted(tweet.metadata.username, userWhitelist)) {
      processedTweets.add(tweet.element);
      return;
    }
    
    // Run slop detection
    const isSlopContent = isSlop(tweet.textContent, tweet.metadata);
    
    if (isSlopContent) {
      console.log('Slop detected:', {
        text: tweet.textContent.substring(0, 100) + '...',
        username: tweet.metadata.username,
        engagement: {
          likes: tweet.metadata.likes,
          retweets: tweet.metadata.retweets,
          replies: tweet.metadata.replies
        }
      });
      
      // Apply visual effect
      const effect = blurMode ? 'blur' : 'hide';
      applyTweetEffect(tweet.element, effect);
      
      // Update detection count
      chrome.runtime.sendMessage({ action: 'updateCount', count: 1 });
    } else {
      // Ensure no effects are applied
      removeTweetEffect(tweet.element);
    }
    
    processedTweets.add(tweet.element);
  } catch (error) {
    console.error('Error processing tweet:', error);
  }
}

/**
 * Clear all effects from processed tweets
 */
function clearAllEffects(): void {
  processedTweets.forEach(element => {
    removeTweetEffect(element);
  });
  processedTweets.clear();
  console.log('All tweet effects cleared');
}

/**
 * Handle messages from background script
 */
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
          // Reprocess all tweets with new mode
          clearAllEffects();
          processExistingTweets();
        }
      }
      if (message.whitelist !== undefined) {
        userWhitelist = message.whitelist;
        if (isEnabled) {
          // Reprocess all tweets with new whitelist
          clearAllEffects();
          processExistingTweets();
        }
      }
      break;
      
    default:
      console.warn('Unknown message action:', message.action);
  }
  
  sendResponse({ success: true });
});

// Global observer variable
let observer: MutationObserver | null = null;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Handle page navigation (Twitter/X is a SPA)
let currentUrl = location.href;
new MutationObserver(() => {
  if (location.href !== currentUrl) {
    currentUrl = location.href;
    console.log('Page navigation detected, reinitializing...');
    
    // Clear processed tweets cache
    processedTweets.clear();
    
    // Reinitialize after a brief delay to let the page load
    setTimeout(() => {
      if (isEnabled) {
        processExistingTweets();
      }
    }, 1000);
  }
}).observe(document, { subtree: true, childList: true });

console.log('Slop Block content script loaded'); 