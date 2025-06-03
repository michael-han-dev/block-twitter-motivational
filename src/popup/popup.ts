import { getStorageValue, setStorageValue, STORAGE_KEYS, DEFAULT_VALUES } from '../utils/storage';

class PopupController {
  private toggleSwitch: HTMLInputElement;

  constructor() {
    this.toggleSwitch = document.getElementById('toggleSwitch') as HTMLInputElement;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.loadCurrentState();
    this.setupEventListeners();
  }

  private async loadCurrentState(): Promise<void> {
    try {
      const isEnabled = await getStorageValue(STORAGE_KEYS.SLOP_BLOCK_ENABLED, DEFAULT_VALUES[STORAGE_KEYS.SLOP_BLOCK_ENABLED]);
      this.toggleSwitch.checked = isEnabled;
    } catch (error) {
      console.error('Failed to load current state:', error);
    }
  }

  private setupEventListeners(): void {
    this.toggleSwitch.addEventListener('change', async () => {
      await this.handleToggleChange();
    });
  }

  private async handleToggleChange(): Promise<void> {
    try {
      const newState = this.toggleSwitch.checked;
      
      await setStorageValue(STORAGE_KEYS.SLOP_BLOCK_ENABLED, newState);
      
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id && this.isTwitterTab(tabs[0].url)) {
        try {
          await chrome.tabs.sendMessage(tabs[0].id, { 
            action: 'toggleSlop', 
            enabled: newState 
          });
        } catch (error) {
          console.log('Content script not ready, will sync on next page load');
        }
      }
      
      try {
        await chrome.runtime.sendMessage({
          action: 'stateChanged',
          enabled: newState
        });
      } catch (error) {
        console.log('Background script not ready');
      }
      
    } catch (error) {
      console.error('Failed to handle toggle change:', error);
      this.toggleSwitch.checked = !this.toggleSwitch.checked;
    }
  }

  private isTwitterTab(url?: string): boolean {
    if (!url) return false;
    return url.includes('twitter.com') || url.includes('x.com');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
}); 