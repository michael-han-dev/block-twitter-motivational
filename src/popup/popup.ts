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
      console.log('🔍 Popup loading current state from storage...');
      const isEnabled = await getStorageValue(STORAGE_KEYS.SLOP_BLOCK_ENABLED, DEFAULT_VALUES[STORAGE_KEYS.SLOP_BLOCK_ENABLED]);
      console.log('📊 Current state from storage:', isEnabled);
      this.toggleSwitch.checked = isEnabled;
      console.log('✅ Toggle switch updated to:', isEnabled);
    } catch (error) {
      console.error('❌ Failed to load current state:', error);
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
      console.log('🔄 Toggle changed to:', newState);
      
      console.log('💾 Saving new state to storage...');
      await setStorageValue(STORAGE_KEYS.SLOP_BLOCK_ENABLED, newState);
      console.log('✅ State saved to storage');
      
      try {
        console.log('📡 Notifying background script...');
        await chrome.runtime.sendMessage({
          action: 'stateChanged',
          enabled: newState
        });
        console.log('✅ Background script notified');
      } catch (error) {
        console.log('⚠️ Background script not ready:', error);
      }
      
    } catch (error) {
      console.error('❌ Failed to handle toggle change:', error);
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