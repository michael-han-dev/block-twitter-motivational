/**
 * Background service worker for Slop Block extension
 * Handles toolbar toggle, state management, and icon updates
 */

import { getStorageValue, setStorageValue, STORAGE_KEYS, DEFAULT_VALUES } from '../utils/storage';

// Icon paths for different states
const ICONS = {
  ENABLED: {
    16: 'icons/icon16.png',
    32: 'icons/icon32.png',
    48: 'icons/icon32.png',
    128: 'icons/icon128.png'
  },
  DISABLED: {
    16: 'icons/icon16.png', // Same icons for now, could be different
    32: 'icons/icon32.png',
    48: 'icons/icon32.png', 
    128: 'icons/icon128.png'
  }
};

/**
 * Handle extension installation and updates
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Slop Block extension installed/updated:', details.reason);
  
  // Initialize default settings
  if (details.reason === 'install') {
    await setStorageValue(STORAGE_KEYS.SLOP_BLOCK_ENABLED, DEFAULT_VALUES[STORAGE_KEYS.SLOP_BLOCK_ENABLED]);
    await setStorageValue(STORAGE_KEYS.BLUR_MODE, DEFAULT_VALUES[STORAGE_KEYS.BLUR_MODE]);
    await setStorageValue(STORAGE_KEYS.DETECTION_COUNT, DEFAULT_VALUES[STORAGE_KEYS.DETECTION_COUNT]);
    await setStorageValue(STORAGE_KEYS.USER_WHITELIST, DEFAULT_VALUES[STORAGE_KEYS.USER_WHITELIST]);
  }
  
  // Set initial icon state
  const isEnabled = await getStorageValue(STORAGE_KEYS.SLOP_BLOCK_ENABLED, DEFAULT_VALUES[STORAGE_KEYS.SLOP_BLOCK_ENABLED]);
  await updateIcon(isEnabled);
});

/**
 * Handle toolbar button clicks
 */
chrome.action.onClicked.addListener(async (tab) => {
  try {
    console.log('Extension icon clicked for tab:', tab.id);
    
    // Get current state
    const isEnabled = await getStorageValue(STORAGE_KEYS.SLOP_BLOCK_ENABLED, DEFAULT_VALUES[STORAGE_KEYS.SLOP_BLOCK_ENABLED]);
    const newState = !isEnabled;
    
    // Update storage
    await setStorageValue(STORAGE_KEYS.SLOP_BLOCK_ENABLED, newState);
    
    // Update icon
    await updateIcon(newState);
    
    // Notify content script if tab is Twitter/X
    if (tab.id && isTwitterTab(tab.url)) {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'toggleSlop',
          enabled: newState
        });
        console.log(`Extension ${newState ? 'enabled' : 'disabled'} for tab ${tab.id}`);
      } catch (error) {
        console.warn('Failed to send message to content script:', error);
        // Content script might not be ready yet, that's okay
      }
    }
    
    // Update badge to show state
    await updateBadge(newState, tab.id);
    
  } catch (error) {
    console.error('Error handling action click:', error);
  }
});

/**
 * Handle messages from content scripts
 */
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  try {
    switch (message.action) {
      case 'getState':
        const isEnabled = await getStorageValue(STORAGE_KEYS.SLOP_BLOCK_ENABLED, DEFAULT_VALUES[STORAGE_KEYS.SLOP_BLOCK_ENABLED]);
        const blurMode = await getStorageValue(STORAGE_KEYS.BLUR_MODE, DEFAULT_VALUES[STORAGE_KEYS.BLUR_MODE]);
        sendResponse({
          enabled: isEnabled,
          blurMode: blurMode
        });
        break;
        
      case 'updateCount':
        const currentCount = await getStorageValue(STORAGE_KEYS.DETECTION_COUNT, DEFAULT_VALUES[STORAGE_KEYS.DETECTION_COUNT]);
        const newCount = currentCount + (message.count || 1);
        await setStorageValue(STORAGE_KEYS.DETECTION_COUNT, newCount);
        
        // Update badge with detection count
        if (sender.tab?.id) {
          await updateBadge(true, sender.tab.id, newCount);
        }
        break;
        
      default:
        console.warn('Unknown message action:', message.action);
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
  
  return true; // Keep message channel open for async response
});

/**
 * Update extension icon based on state
 */
async function updateIcon(enabled: boolean): Promise<void> {
  try {
    const iconSet = enabled ? ICONS.ENABLED : ICONS.DISABLED;
    await chrome.action.setIcon({ path: iconSet });
    
    const title = enabled ? 'Slop Block: ON (click to disable)' : 'Slop Block: OFF (click to enable)';
    await chrome.action.setTitle({ title });
    
    console.log(`Icon updated: ${enabled ? 'enabled' : 'disabled'}`);
  } catch (error) {
    console.error('Failed to update icon:', error);
  }
}

/**
 * Update extension badge
 */
async function updateBadge(enabled: boolean, tabId?: number, count?: number): Promise<void> {
  try {
    if (!enabled) {
      await chrome.action.setBadgeText({ text: '', tabId });
      return;
    }
    
    if (count !== undefined && count > 0) {
      const badgeText = count > 99 ? '99+' : count.toString();
      await chrome.action.setBadgeText({ text: badgeText, tabId });
      await chrome.action.setBadgeBackgroundColor({ color: '#ff4444', tabId });
    } else {
      await chrome.action.setBadgeText({ text: 'ON', tabId });
      await chrome.action.setBadgeBackgroundColor({ color: '#00aa00', tabId });
    }
  } catch (error) {
    console.error('Failed to update badge:', error);
  }
}

/**
 * Check if a URL is a Twitter/X page
 */
function isTwitterTab(url?: string): boolean {
  if (!url) return false;
  return url.includes('twitter.com') || url.includes('x.com');
}

/**
 * Handle tab updates to refresh badge
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && isTwitterTab(tab.url)) {
    const isEnabled = await getStorageValue(STORAGE_KEYS.SLOP_BLOCK_ENABLED, DEFAULT_VALUES[STORAGE_KEYS.SLOP_BLOCK_ENABLED]);
    await updateBadge(isEnabled, tabId);
  }
});

console.log('Slop Block background service worker loaded'); 