import { getStorageValue, setStorageValue, STORAGE_KEYS, DEFAULT_VALUES } from '../utils/storage';

interface UIElements {
  statusText: HTMLElement;
  toggleButton: HTMLElement;
  settingsButton: HTMLElement;
  mainView: HTMLElement;
  settingsView: HTMLElement;
  backButton: HTMLElement;
  apiKeyInput: HTMLInputElement;
  saveApiKeyButton: HTMLElement;
  customPromptInput: HTMLTextAreaElement;
  savePromptButton: HTMLElement;
}

let elements: UIElements;

function getUIElements(): UIElements {
  return {
    statusText: document.getElementById('statusText')!,
    toggleButton: document.getElementById('toggleButton')!,
    settingsButton: document.getElementById('settingsButton')!,
    mainView: document.getElementById('mainView')!,
    settingsView: document.getElementById('settingsView')!,
    backButton: document.getElementById('backButton')!,
    apiKeyInput: document.getElementById('apiKeyInput') as HTMLInputElement,
    saveApiKeyButton: document.getElementById('saveApiKeyButton')!,
    customPromptInput: document.getElementById('customPromptInput') as HTMLTextAreaElement,
    savePromptButton: document.getElementById('savePromptButton')!
  };
}

async function updateToggleButton(enabled: boolean): Promise<void> {
  elements.toggleButton.classList.toggle('enabled', enabled);
  elements.statusText.textContent = enabled ? 'Enabled' : 'Disabled';
  
  try {
    await setStorageValue(STORAGE_KEYS.SLOP_BLOCK_ENABLED, enabled);
    
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'stateChanged',
          enabled: enabled
        }).catch(() => {});
      }
    });
  } catch (error) {
    console.error('Error updating toggle state:', error);
  }
}

function showMainView(): void {
  elements.mainView.style.display = 'block';
  elements.settingsView.style.display = 'none';
}

function showSettingsView(): void {
  elements.mainView.style.display = 'none';
  elements.settingsView.style.display = 'block';
}

async function saveApiKey(): Promise<void> {
  const apiKey = elements.apiKeyInput.value.trim();
  if (apiKey) {
    await setStorageValue(STORAGE_KEYS.OPENROUTER_API_KEY, apiKey);
    elements.saveApiKeyButton.textContent = 'Saved!';
    setTimeout(() => {
      elements.saveApiKeyButton.textContent = 'Save';
    }, 2000);
  }
}

async function saveCustomPrompt(): Promise<void> {
  const customPrompt = elements.customPromptInput.value.trim();
  if (customPrompt) {
    await setStorageValue(STORAGE_KEYS.CUSTOM_PROMPT, customPrompt);
    elements.savePromptButton.textContent = 'Saved!';
    setTimeout(() => {
      elements.savePromptButton.textContent = 'Save';
    }, 2000);
  }
}

async function loadSettings(): Promise<void> {
  const apiKey = await getStorageValue(STORAGE_KEYS.OPENROUTER_API_KEY, '');
  const customPrompt = await getStorageValue(STORAGE_KEYS.CUSTOM_PROMPT, '');
  
  elements.apiKeyInput.value = apiKey;
  elements.customPromptInput.value = customPrompt;
}

async function initializePopup(): Promise<void> {
  elements = getUIElements();
  
  const enabled = await getStorageValue(STORAGE_KEYS.SLOP_BLOCK_ENABLED, DEFAULT_VALUES[STORAGE_KEYS.SLOP_BLOCK_ENABLED]);
  
  await loadSettings();
  
  elements.toggleButton.classList.toggle('enabled', enabled);
  elements.statusText.textContent = enabled ? 'Enabled' : 'Disabled';

  elements.toggleButton.addEventListener('click', async () => {
    const currentEnabled = elements.toggleButton.classList.contains('enabled');
    const newEnabled = !currentEnabled;
    await updateToggleButton(newEnabled);
  });

  elements.settingsButton.addEventListener('click', () => {
    showSettingsView();
  });

  elements.backButton.addEventListener('click', () => {
    showMainView();
  });

  elements.saveApiKeyButton.addEventListener('click', saveApiKey);
  elements.savePromptButton.addEventListener('click', saveCustomPrompt);
}

document.addEventListener('DOMContentLoaded', initializePopup); 