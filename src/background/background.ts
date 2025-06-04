import { getStorageValue, setStorageValue, STORAGE_KEYS, DEFAULT_VALUES } from '../utils/storage';

/**
 * Background service worker for Slop Block extension
 * Handles toolbar toggle, state management, and icon updates
 */

const ICONS = {
  ENABLED: {
    16: 'icons/icon16.png',
    32: 'icons/icon32.png',
    48: 'icons/icon32.png',
    128: 'icons/icon128.png'
  },
  DISABLED: {
    16: 'icons/icon16-disabled.png',
    32: 'icons/icon32-disabled.png',
    48: 'icons/icon32-disabled.png', 
    128: 'icons/icon128-disabled.png'
  }
};

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Slop Block extension installed/updated:', details.reason);
  
  if (details.reason === 'install') {
    await setStorageValue(STORAGE_KEYS.SLOP_BLOCK_ENABLED, DEFAULT_VALUES[STORAGE_KEYS.SLOP_BLOCK_ENABLED]);
    await setStorageValue(STORAGE_KEYS.BLUR_MODE, DEFAULT_VALUES[STORAGE_KEYS.BLUR_MODE]);
    await setStorageValue(STORAGE_KEYS.DETECTION_COUNT, DEFAULT_VALUES[STORAGE_KEYS.DETECTION_COUNT]);
    await setStorageValue(STORAGE_KEYS.USER_WHITELIST, DEFAULT_VALUES[STORAGE_KEYS.USER_WHITELIST]);
  }
  
  const isEnabled = await getStorageValue(STORAGE_KEYS.SLOP_BLOCK_ENABLED, DEFAULT_VALUES[STORAGE_KEYS.SLOP_BLOCK_ENABLED]);
  await updateIcon(isEnabled);
});

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  console.log('📨 Background received message:', message);
  
  try {
    switch (message.action) {        
      case 'stateChanged':
        console.log('🔄 Processing state change:', message.enabled);
        await updateIcon(message.enabled);
        console.log('✅ Icon updated for state change');
        sendResponse({ success: true });
        break;
        
      case 'updateCount':
        console.log('📊 Processing count update:', message.count);
        const currentCount = await getStorageValue(STORAGE_KEYS.DETECTION_COUNT, DEFAULT_VALUES[STORAGE_KEYS.DETECTION_COUNT]);
        const newCount = currentCount + (message.count || 1);
        await setStorageValue(STORAGE_KEYS.DETECTION_COUNT, newCount);
        console.log('📈 Count updated:', currentCount, '→', newCount);
        
        if (sender.tab?.id) {
          console.log('🏷️ Updating badge for tab:', sender.tab.id);
          await updateBadge(true, sender.tab.id, newCount);
        }
        sendResponse({ success: true });
        break;
        
      default:
        console.warn('⚠️ Unknown message action:', message.action);
        sendResponse({ error: 'Unknown action' });
    }
  } catch (error) {
    console.error('❌ Error handling message:', error);
    sendResponse({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
  
  return true;
});

async function updateIcon(enabled: boolean): Promise<void> {
  try {
    console.log('🎯 Updating icon for enabled state:', enabled);
    const title = enabled ? 'Slop Block: ON (click to disable)' : 'Slop Block: OFF (click to enable)';
    await chrome.action.setTitle({ title });
    console.log('📝 Title updated:', title);
    
    const tabs = await chrome.tabs.query({});
    const twitterTabs = tabs.filter(tab => isTwitterTab(tab.url));
    console.log('🐦 Found Twitter tabs:', twitterTabs.length);
    
    for (const tab of twitterTabs) {
      if (tab.id) {
        console.log('🏷️ Updating badge for Twitter tab:', tab.id, tab.url);
        await updateBadge(enabled, tab.id);
      }
    }
    
    console.log(`✅ Icon updated: ${enabled ? 'enabled' : 'disabled'}`);
  } catch (error) {
    console.error('❌ Failed to update icon:', error);
  }
}

async function updateBadge(enabled: boolean, tabId?: number, count?: number): Promise<void> {
  try {
    console.log('🏷️ Updating badge:', { enabled, tabId, count });
    
    if (!enabled) {
      console.log('🚫 Extension disabled - clearing badge');
      await chrome.action.setBadgeText({ text: '', tabId });
      return;
    }
    
    if (count !== undefined && count > 0) {
      const badgeText = count > 99 ? '99+' : count.toString();
      console.log('🔢 Setting count badge:', badgeText);
      await chrome.action.setBadgeText({ text: badgeText, tabId });
      await chrome.action.setBadgeBackgroundColor({ color: '#ff4444', tabId });
    } else {
      console.log('✅ Setting ON badge');
      await chrome.action.setBadgeText({ text: 'ON', tabId });
      await chrome.action.setBadgeBackgroundColor({ color: '#00aa00', tabId });
    }
    console.log('✅ Badge update completed');
  } catch (error) {
    console.error('❌ Failed to update badge:', error);
  }
}

function isTwitterTab(url?: string): boolean {
  if (!url) return false;
  return url.includes('twitter.com') || url.includes('x.com');
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && isTwitterTab(tab.url)) {
    const isEnabled = await getStorageValue(STORAGE_KEYS.SLOP_BLOCK_ENABLED, DEFAULT_VALUES[STORAGE_KEYS.SLOP_BLOCK_ENABLED]);
    await updateBadge(isEnabled, tabId);
  }
});

console.log('Slop Block background service worker loaded'); 