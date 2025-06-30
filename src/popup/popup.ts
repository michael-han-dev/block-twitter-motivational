import { getStorageValue, setStorageValue, getLocalStorageValue, setLocalStorageValue, STORAGE_KEYS, DEFAULT_VALUES } from '../utils/storage';

interface UIElements {
  statusText: HTMLElement;
  toggleButton: HTMLElement;
  settingsButton: HTMLElement;
  mainView: HTMLElement;
  settingsView: HTMLElement;
  backButton: HTMLElement;
  apiKeyInput: HTMLInputElement;
  saveApiKeyButton: HTMLElement;
  llmCountBadge: HTMLElement;
  keywordsList: HTMLElement;
  addKeywordButton: HTMLElement;
  saveKeywordsButton: HTMLElement;
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
    llmCountBadge: document.getElementById('llmCountBadge')!,
    keywordsList: document.getElementById('keywordsList')!,
    addKeywordButton: document.getElementById('addKeyword')!,
    saveKeywordsButton: document.getElementById('saveKeywords')!
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
  
  if (enabled) {
    const count = await getStorageValue(STORAGE_KEYS.DETECTION_COUNT, DEFAULT_VALUES[STORAGE_KEYS.DETECTION_COUNT]);
    updateBadge(count);
  } else {
    elements.llmCountBadge.style.display = 'none';
  }
  
  try {
    await setStorageValue(STORAGE_KEYS.SLOP_BLOCK_ENABLED, enabled);

    chrome.runtime.sendMessage({
      action: 'stateChanged',
      enabled: enabled
    }).catch(() => {});
    
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
    await setLocalStorageValue(STORAGE_KEYS.GROQ_API_KEY, apiKey);
    savedApiKey = apiKey;
    elements.apiKeyInput.value = maskKey(apiKey);
    elements.saveApiKeyButton.textContent = 'Saved!';
    setTimeout(() => {
      elements.saveApiKeyButton.textContent = 'Submit API Key';
    }, 2000);
  }
}

async function loadSettings(): Promise<void> {
  const apiKey = await getLocalStorageValue(STORAGE_KEYS.GROQ_API_KEY, '');
  savedApiKey = apiKey;
  
  elements.apiKeyInput.value = maskKey(apiKey);

  const count = await getStorageValue(
    STORAGE_KEYS.DETECTION_COUNT,
    DEFAULT_VALUES[STORAGE_KEYS.DETECTION_COUNT]
  );
  updateBadge(count);
}

function updateBadge(count: number): void {
  const enabled = (elements.toggleButton as HTMLInputElement).checked;
  if (count > 0) {
    elements.llmCountBadge.textContent = String(count);
    elements.llmCountBadge.style.display = 'inline-block';
  } else if (enabled) {
    elements.llmCountBadge.textContent = 'ON';
    elements.llmCountBadge.style.display = 'inline-block';
  } else {
    elements.llmCountBadge.style.display = 'none';
  }
}

function updateToggleButtonState(): void {
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

  elements.apiKeyInput.addEventListener('input', updateToggleButtonState);

  elements.addKeywordButton.addEventListener('click', () => addKeywordField());
  elements.saveKeywordsButton.addEventListener('click', saveKeywords);

  loadKeywords();

  chrome.storage.onChanged.addListener((changes) => {
    if (changes[STORAGE_KEYS.DETECTION_COUNT]) {
      updateBadge(changes[STORAGE_KEYS.DETECTION_COUNT].newValue);
    }
  });
}

function addKeywordField(value: string = ''): void {
  const keywordItem = document.createElement('div');
  keywordItem.className = 'keyword-item';
  
  keywordItem.innerHTML = `
    <input type="text" class="keyword-input" placeholder="Enter keyword to block" value="${value}" />
    <span class="remove-keyword">−</span>
  `;
  
  const removeButton = keywordItem.querySelector('.remove-keyword') as HTMLElement;
  removeButton.addEventListener('click', () => {
    keywordItem.remove();
  });
  
  elements.keywordsList.appendChild(keywordItem);
}

function getKeywordValues(): string[] {
  const inputs = elements.keywordsList.querySelectorAll('.keyword-input') as NodeListOf<HTMLInputElement>;
  return Array.from(inputs)
    .map(input => input.value.trim())
    .filter(value => value.length > 0);
}

async function saveKeywords(): Promise<void> {
  const keywords = getKeywordValues();
  await setStorageValue(STORAGE_KEYS.BLOCKED_KEYWORDS, keywords);
  
  elements.saveKeywordsButton.textContent = 'Saved!';
  setTimeout(() => {
    elements.saveKeywordsButton.textContent = 'Save Keywords';
  }, 2000);
}

async function loadKeywords(): Promise<void> {
  const keywords = await getStorageValue(STORAGE_KEYS.BLOCKED_KEYWORDS, DEFAULT_VALUES[STORAGE_KEYS.BLOCKED_KEYWORDS]);
  
  elements.keywordsList.innerHTML = '';
  
  if (keywords.length === 0) {
    addKeywordField();
  } else {
    keywords.forEach(keyword => addKeywordField(keyword));
  }
  
  setupRemoveButtons();
}

function setupRemoveButtons(): void {
  const removeButtons = elements.keywordsList.querySelectorAll('.remove-keyword');
  removeButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      const keywordItem = (e.target as HTMLElement).closest('.keyword-item');
      if (keywordItem && elements.keywordsList.children.length > 1) {
        keywordItem.remove();
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', initializePopup); 