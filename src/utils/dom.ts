/**
 * DOM manipulation utilities for Twitter/X content detection and modification
 */

import { TweetMetadata } from './storage';

declare global {
  interface Window {
    DEBUG_SLOP_DETECTION?: boolean;
  }
}

let processingQueue: Element[] = [];
let isProcessing = false;

const DEBUG = window.DEBUG_SLOP_DETECTION || false;

function debugLog(...args: any[]): void {
  if (DEBUG) {
    console.log('[SlopBlock DOM]', ...args);
  }
}

interface ProcessingStats {
  totalTweets: number;
  textExtracted: number;
  slopDetected: number;
}

const stats: ProcessingStats = {
  totalTweets: 0,
  textExtracted: 0,
  slopDetected: 0
};

function getTweetElements(): Element[] {
  return Array.from(document.querySelectorAll('[data-testid="tweet"]')).filter(tweet => {
    const parent = tweet.closest('article');
    return parent && !parent.hasAttribute('data-slop-processed');
  });
}

function extractTweetData(element: Element): TweetMetadata | null {
  try {
    const tweetText = extractTweetTextRobust(element);
    if (!tweetText) {
      debugLog('No text extracted for tweet:', element);
      return null;
    }

    stats.textExtracted++;

    const userElement = element.querySelector('[data-testid="User-Name"]');
    const username = userElement?.textContent?.trim() || 'unknown';

    const engagementElements = {
      replies: element.querySelector('[data-testid="reply"]'),
      retweets: element.querySelector('[data-testid="retweet"]'),
      likes: element.querySelector('[data-testid="like"]')
    };

    const engagement = {
      replies: parseEngagementCount(engagementElements.replies?.textContent || '0'),
      retweets: parseEngagementCount(engagementElements.retweets?.textContent || '0'),
      likes: parseEngagementCount(engagementElements.likes?.textContent || '0')
    };

    const metadata: TweetMetadata = {
      text: tweetText,
      username,
      engagement,
      element: element as HTMLElement,
      timestamp: Date.now()
    };

    debugLog('Extracted tweet data:', {
      username,
      textLength: tweetText.length,
      engagement,
      textPreview: tweetText.substring(0, 100) + '...'
    });

    return metadata;
  } catch (error) {
    console.error('Error extracting tweet data:', error);
    return null;
  }
}

function extractTweetTextRobust(element: Element): string {
  let extractedText = '';

  const primarySelector = '[data-testid="tweetText"]';
  const primaryElement = element.querySelector(primarySelector);
  
  if (primaryElement?.textContent?.trim()) {
    extractedText = primaryElement.textContent.trim();
    debugLog('Strategy 1 success:', extractedText.substring(0, 50));
    return extractedText;
  }

  const alternativeSelectors = [
    '[lang] span',
    '.css-901oao span',
    '[dir="auto"] span'
  ];

  for (const selector of alternativeSelectors) {
    const elements = element.querySelectorAll(selector);
    const texts = Array.from(elements)
      .map(el => el.textContent?.trim())
      .filter(text => text && text.length > 0);
    
    if (texts.length > 0) {
      extractedText = texts.join(' ').trim();
      if (extractedText.length > 10) {
        debugLog('Strategy 2 success:', extractedText.substring(0, 50));
        return extractedText;
      }
    }
  }

  const langElements = element.querySelectorAll('[lang]:not([lang=""])');
  for (const langEl of Array.from(langElements)) {
    const text = langEl.textContent?.trim();
    if (text && text.length > extractedText.length) {
      extractedText = text;
    }
  }
  
  if (extractedText.trim().length > 10) {
    debugLog('Strategy 3 success:', extractedText.substring(0, 50));
    return extractedText.trim();
  }

  const tweetContainer = element.querySelector('[data-testid="tweet"]') || element;
  const textNodes = getTextNodesFromElement(tweetContainer);
  const meaningfulTexts = textNodes
    .map(node => node.textContent?.trim())
    .filter(text => text && text.length > 3)
    .filter(text => !isNavigationText(text));

  if (meaningfulTexts.length > 0) {
    extractedText = meaningfulTexts.join(' ').trim();
    debugLog('Strategy 4 success:', extractedText.substring(0, 50));
    return extractedText;
  }

  debugLog('All strategies failed for element:', element);
  return '';
}

function getTextNodesFromElement(element: Element): Text[] {
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        
        const tagName = parent.tagName.toLowerCase();
        if (['script', 'style', 'svg'].includes(tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
        
        const text = node.textContent?.trim();
        if (!text || text.length < 3) {
          return NodeFilter.FILTER_REJECT;
        }
        
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  let node;
  while (node = walker.nextNode()) {
    textNodes.push(node as Text);
  }
  
  return textNodes;
}

function isNavigationText(text: string): boolean {
  const navPatterns = [
    /^\d+[hms]$/, /^·$/, /^@/, /^Show this thread$/,
    /^Replying to/, /^Quote Tweet$/, /^Retweet$/,
    /^\d+$/, /^Show replies$/, /^More$/
  ];
  
  return navPatterns.some(pattern => pattern.test(text.trim()));
}

function parseEngagementCount(text: string): number {
  if (!text) return 0;
  
  const cleanText = text.replace(/[^\d.KMkm]/g, '');
  const number = parseFloat(cleanText);
  
  if (isNaN(number)) return 0;
  
  if (cleanText.toLowerCase().includes('k')) {
    return Math.round(number * 1000);
  } else if (cleanText.toLowerCase().includes('m')) {
    return Math.round(number * 1000000);
  }
  
  return Math.round(number);
}

function collapseToStub(element: HTMLElement): void {
  if (element.hasAttribute('data-slop-collapsed')) {
    return;
  }

  const existingHeaders = element.querySelectorAll('.slop-collapse-header');
  existingHeaders.forEach(header => header.remove());

  const originalContent = element.innerHTML;
  element.setAttribute('data-original-content', originalContent);

  const stubContainer = document.createElement('div');
  stubContainer.className = 'slop-collapsed';
  stubContainer.innerHTML = `
    <div class="slop-collapsed-header">
      <span class="slop-collapsed-text">AI-generated content hidden</span>
      <span class="slop-expand-icon">▼</span>
    </div>
  `;

  stubContainer.addEventListener('mouseenter', () => {
    stubContainer.style.backgroundColor = 'rgb(239, 243, 244)';
  });

  stubContainer.addEventListener('mouseleave', () => {
    stubContainer.style.backgroundColor = 'rgb(247, 249, 250)';
  });

  stubContainer.addEventListener('click', () => {
    expandFromStub(element);
  });

  element.innerHTML = '';
  element.appendChild(stubContainer);
  element.setAttribute('data-slop-collapsed', 'true');
  element.style.display = 'block';
}

function expandFromStub(element: HTMLElement): void {
  if (!element.hasAttribute('data-slop-collapsed')) {
    return;
  }

  const originalContent = element.getAttribute('data-original-content');
  if (originalContent) {
    element.innerHTML = originalContent;
  }

  const existingHeaders = element.querySelectorAll('.slop-collapse-header');
  existingHeaders.forEach(header => header.remove());

  const collapseHeader = document.createElement('div');
  collapseHeader.className = 'slop-collapse-header';
  collapseHeader.innerHTML = `
    <div class="slop-collapse-button">
      <span class="slop-collapse-text">🤖 Hide AI content</span>
      <span class="slop-collapse-icon">▲</span>
    </div>
  `;

  collapseHeader.addEventListener('mouseenter', () => {
    collapseHeader.style.backgroundColor = 'rgb(239, 243, 244)';
  });

  collapseHeader.addEventListener('mouseleave', () => {
    collapseHeader.style.backgroundColor = 'rgb(247, 249, 250)';
  });

  collapseHeader.addEventListener('click', (e) => {
    e.stopPropagation();
    collapseToStub(element);
  });

  element.insertBefore(collapseHeader, element.firstChild);
  element.removeAttribute('data-slop-collapsed');
  element.removeAttribute('data-original-content');
}

function applyTweetEffect(element: HTMLElement, effectType: 'blur' | 'hide' | 'collapse'): void {
  hideAllExceptUsername(element);
}

function removeTweetEffect(element: HTMLElement): void {
  restoreFromUsernameOnly(element);

  element.classList.remove('slop-blurred', 'slop-hidden', 'slop-collapsed');

  const collapseHeaders = element.querySelectorAll('.slop-collapse-header');
  collapseHeaders.forEach(header => header.remove());

  const hideAgainHeaders = element.querySelectorAll('.slop-hide-again-header');
  hideAgainHeaders.forEach(header => header.remove());

  element.classList.remove('slop-blurred', 'slop-hidden', 'slop-collapsed', 'slop-debug', 'slop-debug-detected', 'slop-debug-processed');

  element.style.filter = '';
  element.style.opacity = '';
  element.style.pointerEvents = '';
  element.style.userSelect = '';
  element.style.border = '';
  element.style.borderRadius = '';
  element.style.outline = '';
  element.style.backgroundColor = '';
  element.style.display = '';

  if (element.hasAttribute('data-slop-collapsed')) {
    const originalContent = element.getAttribute('data-original-content');
    if (originalContent) {
      element.innerHTML = originalContent;
      element.removeAttribute('data-original-content');
    }
    element.removeAttribute('data-slop-collapsed');
  }

  element.removeAttribute('data-slop-username-only');
  element.removeAttribute('data-slop-original-content');
}

function addDebugHighlight(element: HTMLElement, detected: boolean): void {
  if (!DEBUG) return;
  
  if (element.hasAttribute('data-slop-processed')) {
    return;
  }

  if (detected) {
    element.classList.add('slop-debug-detected');
    debugLog('🔴 SLOP DETECTED:', {
      element,
      text: element.textContent?.substring(0, 100)
    });
  } else {
    element.classList.add('slop-debug-processed');
    debugLog('🟢 Clean tweet processed:', {
      element,
      text: element.textContent?.substring(0, 50)
    });
  }

  element.setAttribute('data-slop-processed', 'true');
}

function hideAllExceptUsername(element: HTMLElement): void {
  if (element.hasAttribute('data-slop-username-only')) {
    return;
  }

  const usernameInfo = extractUsernameInfo(element);
  if (!usernameInfo.displayName && !usernameInfo.handle) {
    debugLog('Could not extract username, falling back to collapse');
    collapseToStub(element);
    return;
  }

  const existingHeaders = element.querySelectorAll('.slop-hide-again-header');
  existingHeaders.forEach(header => header.remove());

  const originalContent = element.innerHTML;
  element.setAttribute('data-slop-original-content', originalContent);

  const usernameContainer = document.createElement('div');
  usernameContainer.className = 'slop-username-display';
  usernameContainer.style.cssText = `
    background: rgb(247, 249, 250);
    border: 1px solid rgb(207, 217, 222);
    border-radius: 16px;
    padding: 16px;
    margin: 2px 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  `;

  usernameContainer.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 8px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-weight: 700; color: rgb(15, 20, 25); font-size: 15px;">${usernameInfo.displayName || 'User'}</span>
        ${usernameInfo.handle ? `<span style="color: rgb(83, 100, 113); font-size: 15px;">@${usernameInfo.handle}</span>` : ''}
      </div>
      <div style="color: rgb(83, 100, 113); font-size: 15px; margin: 4px 0;">
        Content hidden by Slop Block
      </div>
      <button class="slop-show-content" style="
        background: rgb(29, 161, 242);
        color: white;
        border: none;
        border-radius: 20px;
        padding: 8px 16px;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
        transition: background-color 0.2s ease;
        align-self: flex-start;
      ">Show</button>
    </div>
  `;

  usernameContainer.addEventListener('mouseenter', () => {
    usernameContainer.style.backgroundColor = 'rgb(239, 243, 244)';
  });

  usernameContainer.addEventListener('mouseleave', () => {
    usernameContainer.style.backgroundColor = 'rgb(247, 249, 250)';
  });

  const showButton = usernameContainer.querySelector('.slop-show-content') as HTMLButtonElement;
  showButton?.addEventListener('click', (e) => {
    e.stopPropagation();
    restoreFromUsernameOnly(element);
  });

  element.innerHTML = '';
  element.appendChild(usernameContainer);
  element.setAttribute('data-slop-username-only', 'true');
  element.style.display = 'block';
}

function extractUsernameInfo(element: HTMLElement): { displayName: string | null, handle: string | null } {
  const userNameElement = element.querySelector('[data-testid="User-Name"]');
  
  let displayName: string | null = null;
  let handle: string | null = null;

  if (userNameElement) {
    const nameSpans = userNameElement.querySelectorAll('span');
    for (const span of Array.from(nameSpans)) {
      const text = span.textContent?.trim();
      if (text) {
        if (text.startsWith('@')) {
          handle = text.substring(1);
        } else if (!displayName && !text.includes('@')) {
          displayName = text;
        }
      }
    }
  }

  return { displayName, handle };
}

function restoreFromUsernameOnly(element: HTMLElement): void {
  if (!element.hasAttribute('data-slop-username-only')) {
    return;
  }

  const originalContent = element.getAttribute('data-slop-original-content');
  if (originalContent) {
    element.innerHTML = originalContent;
  }

  const existingHeaders = element.querySelectorAll('.slop-hide-again-header');
  existingHeaders.forEach(header => header.remove());

  const hideAgainHeader = document.createElement('div');
  hideAgainHeader.className = 'slop-hide-again-header';
  hideAgainHeader.style.cssText = `
    background: rgb(247, 249, 250);
    border: 1px solid rgb(207, 217, 222);
    border-radius: 12px;
    padding: 8px 12px;
    margin-bottom: 8px;
    cursor: pointer;
    transition: background-color 0.2s ease;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  `;

  hideAgainHeader.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
      <span style="color: rgb(83, 100, 113); font-size: 13px; font-weight: 400;">🤖 Hide AI content again</span>
      <span style="color: rgb(83, 100, 113); font-size: 12px; margin-left: 8px; transition: transform 0.2s ease;">▲</span>
    </div>
  `;

  hideAgainHeader.addEventListener('mouseenter', () => {
    hideAgainHeader.style.backgroundColor = 'rgb(239, 243, 244)';
  });

  hideAgainHeader.addEventListener('mouseleave', () => {
    hideAgainHeader.style.backgroundColor = 'rgb(247, 249, 250)';
  });

  hideAgainHeader.addEventListener('click', (e) => {
    e.stopPropagation();
    hideAllExceptUsername(element);
  });

  element.insertBefore(hideAgainHeader, element.firstChild);
  element.removeAttribute('data-slop-username-only');
  element.removeAttribute('data-slop-original-content');
}

export { 
  getTweetElements, 
  extractTweetData, 
  applyTweetEffect, 
  removeTweetEffect, 
  addDebugHighlight,
  hideAllExceptUsername,
  restoreFromUsernameOnly,
  type TweetMetadata 
}; 