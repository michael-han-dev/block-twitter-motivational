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
  BLUR_MODE: 'blurMode',
  GROQ_API_KEY: 'groqApiKey',
  SYSTEM_PROMPT: 'systemPrompt',
  PROCESSED_TWEET_IDS: 'processedTweetIds',
  COLLAPSED_TWEET_IDS: 'collapsedTweetIds',
  BLOCKED_KEYWORDS: 'blockedKeywords',
} as const;

export const DEFAULT_VALUES = {
  [STORAGE_KEYS.SLOP_BLOCK_ENABLED]: false,
  [STORAGE_KEYS.DETECTION_COUNT]: 0,
  [STORAGE_KEYS.BLUR_MODE]: true,
  [STORAGE_KEYS.GROQ_API_KEY]: '',
  [STORAGE_KEYS.SYSTEM_PROMPT]: 'BE EXTREMELY CONCISE WITH YOUR THOUGHTS, NO NEED TO ELABORATE. You are an expert at detecting AI-generated tweets slop, engagement bait, and generic inspirational content on social media. Analyze each tweet and classify it as slop or genuine content. SLOP INDICATORS: motivational clichés such as “mindset is everything,” “follow your dreams,” or “hustle harder”; finishes with a call to action or promise of a link/course/email thread; generic advice patterns like “here’s what I learned,” “X things nobody tells you,” or “stop doing this, start doing this”; engagement bait phrases such as “unpopular opinion,” “let that sink in,” or “thread 🧵”; AI-like structures including numbered or bulleted list of advice, claims, or one-sentence paragraphs, formulaic advice, or excessive emojis; buzzwords like entrepreneur, transformation, breakthrough, optimize, or unlock potential; direct sales pitches such as “DM me,” “link in bio,” “limited time,” or “exclusive access.” Additional red flags: any presence of the Unicode em dash (U+2014) instantly marks the tweet as slop with confidence 1.0; dramatic one-line paragraphs split for emphasis; repetitive rhetorical questions; imperative mini-sentences (“Go gym.”, “Keep shipping.”). If two or more indicators appear, classify as slop with high confidence; otherwise judge contextually. \n\nImportant! You must return JSON format: {"results": [{"id": 0, "isSlop": true/false, "confidence": 0.0-1.0}]} where id matches tweet position (0-10).',
  [STORAGE_KEYS.PROCESSED_TWEET_IDS]: [] as string[],
  [STORAGE_KEYS.COLLAPSED_TWEET_IDS]: [] as string[],
  [STORAGE_KEYS.BLOCKED_KEYWORDS]: [] as string[],
} as const;


export interface TweetMetadata {
  id: string;
  text: string;
  username: string;
  element: HTMLElement;
  timestamp: number;
} 
