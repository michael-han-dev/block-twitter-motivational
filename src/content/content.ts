console.log('SlopBlock: Content script loaded');

import { getLocalStorageValue, setLocalStorageValue, getStorageValue, STORAGE_KEYS } from '../utils/storage';
import { getTweetElements, extractTweetData, collapseAITweet } from '../utils/dom';
import { analyzeTweetsWithLLM } from '../utils/groq';

type TweetInfo = { id: string; text: string; element: HTMLElement };

const MAX_TWEETS = 200;
const DROP_COUNT = 10;
const BATCH_SIZE = 10;

let processed: string[] = [];
let collapsedTweetIds: string[] = [];
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

async function loadCollapsedTweets() {
  collapsedTweetIds = await getLocalStorageValue<string[]>(STORAGE_KEYS.COLLAPSED_TWEET_IDS, []);
  console.log('SlopBlock: Loaded', collapsedTweetIds.length, 'collapsed tweets');
}

async function saveCollapsedTweets() {
  await setLocalStorageValue(STORAGE_KEYS.COLLAPSED_TWEET_IDS, collapsedTweetIds);
}

function addCollapsedTweet(id: string) {
  if (!collapsedTweetIds.includes(id)) {
    collapsedTweetIds.push(id);
    if (collapsedTweetIds.length > MAX_TWEETS) {
      collapsedTweetIds.splice(0, DROP_COUNT);
    }
    
    if (chrome?.runtime?.id) {
      saveCollapsedTweets();
    }
  }
}

function addProcessed(id: string) {
  processed.push(id);
  if (processed.length > MAX_TWEETS) processed.splice(0, DROP_COUNT);
  
  if (chrome?.runtime?.id) {
    saveProcessed();
  }
}

async function analyzeBatch(batch: TweetInfo[]): Promise<Set<string>> {
  if (batch.length === 0) return new Set();
  
  const texts = batch.map(tweet => tweet.text);
  console.log('SlopBlock: Analyzing', batch.length, 'tweets');
  
  try {
    const results = await analyzeTweetsWithLLM(texts);
    console.log('SlopBlock: Analysis results:', results);
    
    if (!results) {
      console.log('SlopBlock: No API results');
      return new Set<string>();
    }

    const flaggedIds = new Set<string>();
    results.forEach((result, index) => {
      if (result.isSlop && index < batch.length) {
        const tweetId = batch[index].id;
        flaggedIds.add(tweetId);
        console.log('SlopBlock: Flagged tweet', tweetId);
      }
    });
    
    return flaggedIds;
    
  } catch (error) {
    console.error('SlopBlock: Analysis error:', error);
    return new Set<string>();
  }
}

function handleFlags(flags: Set<string>) {
  flags.forEach(id => {
    const el = elementMap.get(id);
    if (el) {
      collapseAITweet(el);
      addCollapsedTweet(id);
      console.log('SlopBlock: Collapsed tweet', id);
    }
  });
}

async function flushQueue() {
  if (queue.length < BATCH_SIZE) return;
  const batch = queue.splice(0, BATCH_SIZE);
  const flagged = await analyzeBatch(batch);
  handleFlags(flagged);
}

async function processTweet(el: HTMLElement) {
  if (!isEnabled) return;
  
  const data = await extractTweetData(el);
  if (!data) return;
  const { id, text } = data;
  if (!id) return;
  
  elementMap.set(id, el);
  
  if (collapsedTweetIds.includes(id)) {
    if (!el.hasAttribute('data-ai-collapsed')) {
      collapseAITweet(el);
      console.log('SlopBlock: Re-collapsed tweet', id);
    }
    return;
  }
  
  if (processed.includes(id)) return;

  console.log('SlopBlock: Processing tweet', id, text.substring(0, 50) + '...');
  addProcessed(id);
  queue.push({ id, text, element: el });
  flushQueue();
}

function initialScan() {
  if (!isEnabled) return;
  const tweets = getTweetElements();
  console.log('SlopBlock: Initial scan found', tweets.length, 'tweets');
  tweets.forEach(el => processTweet(el as HTMLElement));
}

function startObserver() {
  if (observer) return;
  console.log('SlopBlock: Starting mutation observer');

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
    console.log('SlopBlock: Stopping mutation observer');
    observer.disconnect();
    observer = null;
  }
}

function removeFromCollapsed(tweetId: string) {
  const index = collapsedTweetIds.indexOf(tweetId);
  if (index !== -1) {
    collapsedTweetIds.splice(index, 1);
    if (chrome?.runtime?.id) {
      saveCollapsedTweets();
    }
  }
}

async function updateExtensionState() {
  const enabled = await getStorageValue(STORAGE_KEYS.SLOP_BLOCK_ENABLED, false);
  console.log('SlopBlock: Extension state changed to:', enabled ? 'ENABLED' : 'DISABLED');
  
  if (enabled && !isEnabled) {
    isEnabled = true;
    window.slopBlockRemoveFromCollapsed = removeFromCollapsed;
    startObserver();
    initialScan();
  } else if (!enabled && isEnabled) {
    isEnabled = false;
    window.slopBlockRemoveFromCollapsed = undefined;
    stopObserver();
    queue.length = 0;
  }
}

chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'stateChanged') {
    console.log('SlopBlock: Received state change message');
    updateExtensionState();
  }
});

(async () => {
  console.log('SlopBlock: Initializing extension');
  await loadProcessed();
  await loadCollapsedTweets();
  await updateExtensionState();
  console.log('SlopBlock: Initialization complete');
})();