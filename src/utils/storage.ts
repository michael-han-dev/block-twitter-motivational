export async function getStorageValue<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const result = await chrome.storage.sync.get({ [key]: defaultValue });
    return result[key];
  } catch (error) {
    console.error(`Failed to get storage value for key ${key}:`, error);
    return defaultValue;
  }
}

export async function setStorageValue<T>(key: string, value: T): Promise<void> {
  try {
    await chrome.storage.sync.set({ [key]: value });
  } catch (error) {
    console.error(`Failed to set storage value for key ${key}:`, error);
  }
}

export async function removeStorageValue(key: string): Promise<void> {
  try {
    await chrome.storage.sync.remove(key);
  } catch (error) {
    console.error(`Failed to remove storage value for key ${key}:`, error);
  }
}

export const STORAGE_KEYS = {
  SLOP_BLOCK_ENABLED: 'slopBlockEnabled',
  DETECTION_COUNT: 'detectionCount',
  USER_WHITELIST: 'userWhitelist',
  BLUR_MODE: 'blurMode'
} as const;

export const DEFAULT_VALUES = {
  [STORAGE_KEYS.SLOP_BLOCK_ENABLED]: false,
  [STORAGE_KEYS.DETECTION_COUNT]: 0,
  [STORAGE_KEYS.USER_WHITELIST]: [] as string[],
  [STORAGE_KEYS.BLUR_MODE]: true
} as const; 
