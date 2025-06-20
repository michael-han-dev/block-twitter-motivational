console.log('🔍 SlopBlock: Script loaded at', new Date().toISOString());
console.log('🔍 SlopBlock: URL:', window.location.href);
console.log('🔍 SlopBlock: Document ready state:', document.readyState);

import { getLocalStorageValue, setLocalStorageValue, getStorageValue, STORAGE_KEYS } from '../utils/storage';
import { getTweetElements, extractTweetData, collapseAITweet } from '../utils/dom';
import { analyzeTweetsWithLLM } from '../utils/openrouter';

type TweetInfo = { id: string; text: string; element: HTMLElement };

const MAX_TWEETS = 200;
const DROP_COUNT = 10;
const BATCH_SIZE = 15;

let processed: string[] = [];
let queue: TweetInfo[] = [];
const elementMap = new Map<string, HTMLElement>();
let isEnabled = false;
let observer: MutationObserver | null = null;

async function loadProcessed() {
  processed = await getLocalStorageValue<string[]>(STORAGE_KEYS.PROCESSED_TWEET_IDS, []);
}

async function saveProcessed() {
  await setLocalStorageValue(STORAGE_KEYS.PROCESSED_TWEET_IDS, processed);
}

function addProcessed(id: string) {
  processed.push(id);
  if (processed.length > MAX_TWEETS) processed.splice(0, DROP_COUNT);
  
  if (chrome?.runtime?.id) {
    saveProcessed();
  }
}

async function analyseBatch(batch: TweetInfo[]): Promise<Set<string>> {
  const texts = batch.map(t => t.text);
  console.log('[Batch] Analyzing', batch.length, 'tweets with OpenRouter...');
  console.log('[Batch] Tweet texts being sent:', texts);
  
  try {
    const useGroq = await getStorageValue(STORAGE_KEYS.USE_GROQ, true);
    console.log('[Batch] Using Groq:', useGroq);

    const results = await analyzeTweetsWithLLM(texts, useGroq);
    console.log('[Batch] OpenRouter returned:', results);
    
    if (!results) {
      console.log('[Batch] No API key or analysis failed');
      return new Set<string>();
  }

    const flaggedIds = new Set<string>();
    results.forEach((result, index) => {
      console.log('[Batch] Processing result', index, ':', result);
      if (result.isSlop && index < batch.length) {
        const tweetId = batch[index].id;
        flaggedIds.add(tweetId);
        console.log('[Flagged]', tweetId, 'confidence:', result.confidence, 'text:', batch[index].text.substring(0, 100));
      } else {
        console.log('[Clean]', batch[index]?.id, 'text:', batch[index]?.text.substring(0, 100));
}
    });
    
    console.log('[Batch] Final result: Flagged', flaggedIds.size, 'out of', batch.length, 'tweets');
    console.log('[Batch] Flagged IDs:', Array.from(flaggedIds));
    return flaggedIds;
    
  } catch (error) {
    console.error('[Batch] Analysis error:', error);
    return new Set<string>();
  }
}

function handleFlags(flags: Set<string>) {
  flags.forEach(id => {
    const el = elementMap.get(id);
    if (el) {
      collapseAITweet(el);
      console.log('[Collapsed AI Tweet]', id);
    }
  });
}

async function flushQueue() {
  if (queue.length < BATCH_SIZE) return;
  const batch = queue.splice(0, BATCH_SIZE);
  const flagged = await analyseBatch(batch);
  handleFlags(flagged);
}

function processTweet(el: HTMLElement) {
  if (!isEnabled) return;
  
  const data = extractTweetData(el);
  if (!data) return;
  const { id, text } = data;
  if (!id || processed.includes(id)) return;

  console.log('[Tweet]', id, text.substring(0, 120));

  addProcessed(id);
  queue.push({ id, text, element: el });
  elementMap.set(id, el);
  flushQueue();
    }

function initialScan() {
  if (!isEnabled) return;
  getTweetElements().forEach(el => processTweet(el as HTMLElement));
}

function startObserver() {
  if (observer) return;

  observer = new MutationObserver(muts => {
    if (!isEnabled) return;
    
    muts.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          if (el.matches('[data-testid="tweet"]')) {
            processTweet(el);
          } else {
            el.querySelectorAll?.('[data-testid="tweet"]').forEach(t => processTweet(t as HTMLElement));
          }
        }
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

function stopObserver() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

async function updateExtensionState() {
  const enabled = await getStorageValue(STORAGE_KEYS.SLOP_BLOCK_ENABLED, false);
  console.log('[Extension] State changed to:', enabled ? 'ENABLED' : 'DISABLED');
  
  if (enabled && !isEnabled) {
    isEnabled = true;
    startObserver();
    initialScan();
  } else if (!enabled && isEnabled) {
    isEnabled = false;
    stopObserver();
    queue.length = 0;
  }
}

chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'stateChanged') {
    updateExtensionState();
  }
});

(async () => {
  await loadProcessed();
  await updateExtensionState();
})();