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
  llmCountBadge: HTMLElement;
}

let elements: UIElements;
let savedApiKey = '';

function getUIElements(): UIElements {
  return {
    statusText: document.getElementById('statusText')!,
    toggleButton: document.getElementById('toggleSwitch')!,
    settingsButton: document.getElementById('settingsButton')!,
    mainView: document.getElementById('mainView')!,
    settingsView: document.getElementById('settingsView')!,
    backButton: document.getElementById('backButton')!,
    apiKeyInput: document.getElementById('apiKeyInput') as HTMLInputElement,
    saveApiKeyButton: document.getElementById('submitApiKey')!,
    customPromptInput: document.getElementById('customPromptInput') as HTMLTextAreaElement,
    savePromptButton: document.getElementById('savePrompt')!,
    llmCountBadge: document.getElementById('llmCountBadge')!
  };
}

function maskKey(key: string): string {
  if (!key) return '';
  const visible = key.slice(0, 6);
  const hidden = '*'.repeat(Math.max(0, key.length - visible.length));
  return visible + hidden;
}

async function updateToggleButton(enabled: boolean): Promise<void> {
  const toggleInput = elements.toggleButton as HTMLInputElement;
  toggleInput.checked = enabled;
  elements.statusText.textContent = enabled ? 'Enabled' : 'Disabled';
  
  if (!enabled) {
    elements.llmCountBadge.style.display = 'none';
  }
  
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
  elements.mainView.style.display = 'flex';
  elements.settingsView.style.display = 'none';
  elements.mainView.style.removeProperty('width');
}

function showSettingsView(): void {
  elements.mainView.style.display = 'none';
  elements.settingsView.style.display = 'block';
  elements.settingsView.style.removeProperty('width');
}

async function saveApiKey(): Promise<void> {
  const apiKey = elements.apiKeyInput.value.trim();
  if (apiKey) {
    await setStorageValue(STORAGE_KEYS.OPENROUTER_API_KEY, apiKey);
    savedApiKey = apiKey;
    elements.apiKeyInput.value = maskKey(apiKey);
    elements.saveApiKeyButton.textContent = 'Saved!';
    setTimeout(() => {
      elements.saveApiKeyButton.textContent = 'Submit API Key';
    }, 2000);
    updateApiKeyButtonState();
  }
}

async function saveCustomPrompt(): Promise<void> {
  const customPrompt = elements.customPromptInput.value.trim();
  if (customPrompt) {
    await setStorageValue(STORAGE_KEYS.SYSTEM_PROMPT, customPrompt);
    elements.savePromptButton.textContent = 'Saved!';
    setTimeout(() => {
      elements.savePromptButton.textContent = 'Save Prompt';
    }, 2000);
  }
}

async function loadSettings(): Promise<void> {
  const apiKey = await getStorageValue(STORAGE_KEYS.OPENROUTER_API_KEY, '');
  savedApiKey = apiKey;
  
  elements.apiKeyInput.value = maskKey(apiKey);
  elements.customPromptInput.value = await getStorageValue(STORAGE_KEYS.SYSTEM_PROMPT, '');



  const count = await getStorageValue(
    STORAGE_KEYS.DETECTION_COUNT,
    DEFAULT_VALUES[STORAGE_KEYS.DETECTION_COUNT]
  );
  updateBadge(count);
  updateApiKeyButtonState();
}

function updateBadge(count: number): void {
  if (count > 0) {
    elements.llmCountBadge.textContent = String(count);
    elements.llmCountBadge.style.display = 'inline-block';
  } else {
    elements.llmCountBadge.style.display = 'none';
  }
}

function updateApiKeyButtonState(): void {
  const current = elements.apiKeyInput.value.trim();
  const isUnchanged = current === maskKey(savedApiKey) || current === savedApiKey;
  elements.saveApiKeyButton.toggleAttribute('disabled', isUnchanged);
}

async function initializePopup(): Promise<void> {
  elements = getUIElements();
  
  const enabled = await getStorageValue(STORAGE_KEYS.SLOP_BLOCK_ENABLED, DEFAULT_VALUES[STORAGE_KEYS.SLOP_BLOCK_ENABLED]);
  
  await loadSettings();
  
  const toggleInput = elements.toggleButton as HTMLInputElement;
  toggleInput.checked = enabled;
  elements.statusText.textContent = enabled ? 'Enabled' : 'Disabled';

  elements.toggleButton.addEventListener('change', async () => {
    const toggleInput = elements.toggleButton as HTMLInputElement;
    const newEnabled = toggleInput.checked;
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

  elements.apiKeyInput.addEventListener('input', updateApiKeyButtonState);




  chrome.storage.onChanged.addListener((changes) => {
    if (changes[STORAGE_KEYS.DETECTION_COUNT]) {
      updateBadge(changes[STORAGE_KEYS.DETECTION_COUNT].newValue);
    }
  });
}

document.addEventListener('DOMContentLoaded', initializePopup); 