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

export async function getLocalStorageValue<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const result = await chrome.storage.local.get({ [key]: defaultValue });
    return result[key];
  } catch (error) {
    console.error(`Failed to get local storage value for key ${key}:`, error);
    return defaultValue;
  }
}

export async function setLocalStorageValue<T>(key: string, value: T): Promise<void> {
  try {
    await chrome.storage.local.set({ [key]: value });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Extension context invalidated')) {
      console.warn(`Extension context invalidated - skipping storage save for ${key}`);
      return;
    }
    console.error(`Failed to set local storage value for key ${key}:`, error);
  }
}

export const STORAGE_KEYS = {
  SLOP_BLOCK_ENABLED: 'slopBlockEnabled',
  DETECTION_COUNT: 'detectionCount',
  USER_WHITELIST: 'userWhitelist',
  BLUR_MODE: 'blurMode',
  OPENROUTER_API_KEY: 'openRouterApiKey',
  AI_DETECTION_ENABLED: 'aiDetectionEnabled',
  USE_GROQ: 'useGroq',
  SYSTEM_PROMPT: 'systemPrompt',
  BATCH_SIZE: 'batchSize',
  CUSTOM_PROMPT: 'customPrompt',
  PROCESSED_TWEET_IDS: 'processedTweetIds',
  LLM_ANALYZED_IDS: 'llmAnalyzedIds',
} as const;

export const DEFAULT_VALUES = {
  [STORAGE_KEYS.SLOP_BLOCK_ENABLED]: false,
  [STORAGE_KEYS.DETECTION_COUNT]: 0,
  [STORAGE_KEYS.USER_WHITELIST]: [] as string[],
  [STORAGE_KEYS.BLUR_MODE]: true,
  [STORAGE_KEYS.OPENROUTER_API_KEY]: '',
  [STORAGE_KEYS.AI_DETECTION_ENABLED]: false,
  [STORAGE_KEYS.USE_GROQ]: true,
  [STORAGE_KEYS.SYSTEM_PROMPT]: 'You are an expert at detecting AI-generated motivational slop, engagement bait, and generic inspirational content on social media. Analyze each tweet and classify it as slop or genuine content.\n\nSLOP INDICATORS:\n• Motivational clichés: "mindset is everything", "follow your dreams", "hustle harder", "grind never stops"\n• Business/money schemes: "$10k/month", "passive income", "quit my job", "financial freedom"\n• Generic advice patterns: "here\'s what I learned", "X things nobody tells you", "stop doing this, start doing this"\n• Engagement bait: "unpopular opinion", "let that sink in", "read that again", "thread 🧵"\n• AI-like structure: numbered lists, formulaic advice, excessive emojis\n• Buzzwords: entrepreneur, transformation, breakthrough, optimize, unlock potential\n• Sales pitches: "DM me", "link in bio", "limited time", "exclusive access"\n\nReturn JSON format: {"results": [{"id": 0, "isSlop": true/false, "confidence": 0.0-1.0}]} where id matches tweet position (0-14).',
  [STORAGE_KEYS.BATCH_SIZE]: 10,
  [STORAGE_KEYS.CUSTOM_PROMPT]: '',
  [STORAGE_KEYS.PROCESSED_TWEET_IDS]: [] as string[],
  [STORAGE_KEYS.LLM_ANALYZED_IDS]: [] as string[],
} as const;


export interface TweetMetadata {
  id: string;
  text: string;
  username: string;
  engagement: {
    likes: number;
    retweets: number;
    replies: number;
  };
  element: HTMLElement;
  timestamp: number;
} 
