/**
 * DOM manipulation utilities for Twitter/X content detection and modification
 */

export interface TweetElement {
  element: Element;
  textContent: string;
  metadata: TweetMetadata;
}

export interface TweetMetadata {
  likes: number;
  retweets: number;
  replies: number;
  accountAge?: Date;
  isVerified: boolean;
  username?: string;
}

// Debug mode flag for detailed logging
let debugMode = false;

export function setDebugMode(enabled: boolean): void {
  debugMode = enabled;
}

/**
 * Find tweet elements in the given DOM node
 */
export function findTweetElements(node: Element): TweetElement[] {
  const tweets: TweetElement[] = [];
  
  // Modern Twitter/X uses data-testid="tweet" for individual tweets - this is still current
  const tweetElements = node.querySelectorAll('[data-testid="tweet"]');
  
  if (debugMode) {
    console.log(`🔍 findTweetElements: Found ${tweetElements.length} tweet containers in node`);
  }
  
  tweetElements.forEach((element, index) => {
    const tweetData = extractTweetData(element);
    if (tweetData) {
      tweets.push(tweetData);
      if (debugMode) {
        console.log(`✅ Tweet ${index + 1} extracted successfully`);
      }
    } else if (debugMode) {
      console.log(`❌ Tweet ${index + 1} failed extraction`);
    }
  });
  
  return tweets;
}

/**
 * Comprehensive DOM analysis for debugging
 */
function analyzeTweetDOM(element: Element): void {
  if (!debugMode) return;
  
  console.log('=== TWEET DOM ANALYSIS ===');
  console.log('Main element:', element);
  console.log('innerHTML preview:', element.innerHTML.substring(0, 300));
  
  // Check multiple potential text selectors
  const selectors = [
    '[data-testid="tweetText"]',
    '.css-1jxf684',
    '.css-1qaijid',
    '[lang]',
    'span[dir="auto"]',
    'div[lang]',
    'span:not([class*="icon"]):not([aria-hidden="true"])',
  ];
  
  selectors.forEach(selector => {
    const found = element.querySelector(selector);
    if (found?.textContent?.trim()) {
      console.log(`✓ Selector "${selector}":`, found.textContent.substring(0, 100));
    } else {
      console.log(`✗ Selector "${selector}": no content`);
    }
  });
  
  // Analyze text nodes
  const textNodes = getAllTextNodes(element);
  console.log(`Found ${textNodes.length} text nodes`);
  textNodes.slice(0, 3).forEach((node, i) => {
    console.log(`Text node ${i}:`, node.textContent?.substring(0, 100));
  });
}

/**
 * Enhanced text extraction with multiple fallback selectors
 */
function extractTweetData(element: Element): TweetElement | null {
  try {
    analyzeTweetDOM(element);
    
    const textContent = extractTweetTextRobust(element);
    
    if (debugMode) {
      console.log('Extracted text length:', textContent.length);
      console.log('Extracted text preview:', textContent.substring(0, 150));
    }

    const likes = extractEngagementCount(element, 'like');
    const retweets = extractEngagementCount(element, 'retweet');
    const replies = extractEngagementCount(element, 'reply');

    const isVerified = !!element.querySelector('[data-testid="icon-verified"]');

    const usernameElement = element.querySelector('[data-testid="User-Name"] a');
    const username = usernameElement?.textContent?.replace('@', '') || '';
    
    const metadata: TweetMetadata = {
      likes,
      retweets,
      replies,
      isVerified,
      username
    };
    
    return {
      element,
      textContent,
      metadata
    };
  } catch (error) {
    console.warn('Failed to extract tweet data:', error);
    return null;
  }
}

/**
 * Robust text extraction with multiple strategies
 */
function extractTweetTextRobust(element: Element): string {
  // Strategy 1: Primary selector - this is still the main selector for tweet text
  let textElement = element.querySelector('[data-testid="tweetText"]');
  if (textElement?.textContent?.trim()) {
    if (debugMode) {
      console.log('📝 Text extracted via primary selector [data-testid="tweetText"]');
    }
    return textElement.textContent.trim();
  }
  
  // Strategy 2: Alternative direct text selectors
  const directSelectors = [
    '[data-testid="tweetText"] span',
    'div[data-testid="tweetText"]',
    '[lang] span[dir="ltr"]',
    '[lang] span[dir="auto"]'
  ];
  
  for (const selector of directSelectors) {
    const found = element.querySelector(selector);
    const text = found?.textContent?.trim();
    if (text && text.length > 10) {
      if (debugMode) {
        console.log(`📝 Text extracted via selector: ${selector}`);
      }
      return text;
    }
  }
  
  // Strategy 3: Language-tagged elements (Twitter uses lang attributes)
  const langElements = element.querySelectorAll('[lang]');
  for (const langEl of Array.from(langElements)) {
    const text = langEl.textContent?.trim();
    if (text && text.length > 20 && 
        !text.includes('http') && 
        !text.includes('@') &&
        !text.includes('·') &&
        !text.match(/^\d+[mhsd]$/)) {
      if (debugMode) {
        console.log('📝 Text extracted via language-tagged element');
      }
      return text;
    }
  }
  
  // Strategy 4: Traverse text nodes and combine meaningful content
  const textNodes = getAllTextNodes(element);
  let combinedText = '';
  
  for (const node of textNodes) {
    const text = node.textContent?.trim();
    if (text && text.length > 5 && 
        !text.includes('·') && 
        !text.match(/^\d+[mhs]$/) && 
        !text.includes('Show this thread') &&
        !text.includes('Replying to') &&
        !text.includes('Translate') &&
        !text.includes('View post analytics')) {
      combinedText += text + ' ';
    }
  }
  
  const result = combinedText.trim();
  if (debugMode) {
    console.log(`📝 Text extraction result: "${result.substring(0, 100)}..." (length: ${result.length})`);
  }
  
  return result;
}

/**
 * Get all text nodes within an element
 */
function getAllTextNodes(element: Element): Text[] {
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null
  );
  
  const textNodes: Text[] = [];
  let node;
  while (node = walker.nextNode()) {
    const parent = (node as Text).parentElement;
    if (!parent) continue;
    
    // Skip script, style, and hidden elements
    if (parent.tagName === 'SCRIPT' || 
        parent.tagName === 'STYLE' ||
        parent.hasAttribute('aria-hidden') ||
        parent.style.display === 'none') {
      continue;
    }
    
    textNodes.push(node as Text);
  }
  
  return textNodes;
}

/**
 * Extract engagement count for a specific type (like, retweet, reply)
 */
function extractEngagementCount(element: Element, type: 'like' | 'retweet' | 'reply'): number {
  try {
    let selector = '';
    switch (type) {
      case 'like':
        selector = '[data-testid="like"]';
        break;
      case 'retweet':
        selector = '[data-testid="retweet"]';
        break;
      case 'reply':
        selector = '[data-testid="reply"]';
        break;
    }
    
    const button = element.querySelector(selector);
    const countElement = button?.querySelector('[data-testid$="count"]');
    const countText = countElement?.textContent?.trim() || '0';
    
    // Handle abbreviated numbers (1.2K, 5.5M, etc.)
    return parseEngagementNumber(countText);
  } catch (error) {
    return 0;
  }
}

/**
 * Parse engagement numbers that may be abbreviated (1K, 1.2M, etc.)
 */
function parseEngagementNumber(text: string): number {
  if (!text || text === '0') return 0;
  
  const normalized = text.toLowerCase();
  const number = parseFloat(normalized);
  
  if (normalized.includes('k')) {
    return Math.floor(number * 1000);
  } else if (normalized.includes('m')) {
    return Math.floor(number * 1000000);
  } else {
    return Math.floor(number) || 0;
  }
}

export function collapseToStub(element: Element): void {
  if (element.hasAttribute('data-slop-collapsed')) {
    return; // Already collapsed
  }

  if (debugMode) {
    console.log('🎯 Collapsing tweet element:', element);
  }
  
  // Remove any existing collapse headers before storing content
  const existingHeaders = element.querySelectorAll('.slop-collapse-header');
  existingHeaders.forEach(header => header.remove());
  
  // Store original content (now clean of collapse headers)
  element.setAttribute('data-original-content', element.innerHTML);
  element.setAttribute('data-slop-collapsed', 'true');
  
  // Create collapsible stub
  const stub = document.createElement('div');
  stub.className = 'slop-collapsed';
  stub.style.cssText = `
    background: rgb(247, 249, 250) !important;
    border: 1px solid rgb(207, 217, 222) !important;
    border-radius: 16px !important;
    padding: 12px 16px !important;
    margin: 2px 0 !important;
    cursor: pointer !important;
    transition: background-color 0.2s ease !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
    display: block !important;
    width: 100% !important;
    box-sizing: border-box !important;
  `;
  
  stub.innerHTML = `
    <div class="slop-collapsed-header" style="display: flex !important; align-items: center !important; justify-content: space-between !important; width: 100% !important;">
      <span class="slop-collapsed-text" style="color: rgb(83, 100, 113) !important; font-size: 15px !important; font-weight: 400 !important; line-height: 20px !important;">AI generated content detected</span>
      <span class="slop-expand-icon" style="color: rgb(83, 100, 113) !important; font-size: 14px !important; margin-left: 8px !important;">▼</span>
    </div>
  `;
  
  // Add hover effect
  stub.addEventListener('mouseenter', () => {
    stub.style.background = 'rgb(239, 243, 244) !important';
  });
  
  stub.addEventListener('mouseleave', () => {
    stub.style.background = 'rgb(247, 249, 250) !important';
  });
  
  // Add click handler for expansion
  stub.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (debugMode) {
      console.log('🔄 Expanding collapsed tweet');
    }
    expandFromStub(element);
  });
  
  // Replace content while preserving tweet container structure
  const htmlElement = element as HTMLElement;
  htmlElement.innerHTML = '';
  htmlElement.appendChild(stub);
  htmlElement.classList.add('slop-tweet-collapsed');
  
  // Force display to ensure visibility
  htmlElement.style.display = 'block';
  htmlElement.style.visibility = 'visible';
  
  console.log('✅ Tweet collapsed successfully, stub element:', stub);
}

export function expandFromStub(element: Element): void {
  if (!element.hasAttribute('data-slop-collapsed')) {
    return; // Not collapsed
  }
  
  console.log('🔄 Expanding tweet element:', element);
  
  // Restore original content
  const originalContent = element.getAttribute('data-original-content');
  if (originalContent) {
    element.innerHTML = originalContent;
  }
  
  // Remove any existing collapse headers before adding new one
  const existingHeaders = element.querySelectorAll('.slop-collapse-header');
  existingHeaders.forEach(header => header.remove());
  
  // Add collapse header to expanded tweet
  const collapseHeader = document.createElement('div');
  collapseHeader.className = 'slop-collapse-header';
  collapseHeader.style.cssText = `
    background: rgb(247, 249, 250) !important;
    border: 1px solid rgb(207, 217, 222) !important;
    border-radius: 12px !important;
    padding: 8px 12px !important;
    margin-bottom: 8px !important;
    cursor: pointer !important;
    transition: background-color 0.2s ease !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
    display: block !important;
  `;
  
  collapseHeader.innerHTML = `
    <div class="slop-collapse-button" style="display: flex !important; align-items: center !important; justify-content: space-between !important; width: 100% !important;">
      <span class="slop-collapse-text" style="color: rgb(83, 100, 113) !important; font-size: 13px !important; font-weight: 400 !important;">Hide AI content</span>
      <span class="slop-collapse-icon" style="color: rgb(83, 100, 113) !important; font-size: 12px !important; margin-left: 8px !important;">▲</span>
    </div>
  `;
  
  // Add hover effect
  collapseHeader.addEventListener('mouseenter', () => {
    collapseHeader.style.background = 'rgb(239, 243, 244) !important';
  });
  
  collapseHeader.addEventListener('mouseleave', () => {
    collapseHeader.style.background = 'rgb(247, 249, 250) !important';
  });
  
  // Add click handler for collapsing
  collapseHeader.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    console.log('🎯 Collapsing expanded tweet');
    collapseToStub(element);
  });
  
  // Insert collapse header at the top
  element.insertBefore(collapseHeader, element.firstChild);
  element.classList.remove('slop-tweet-collapsed');
  element.classList.add('slop-tweet-expanded');
  element.removeAttribute('data-slop-collapsed');
  
  console.log('✅ Tweet expanded successfully with collapse header');
}

export function applyTweetEffect(element: Element, effect: 'blur' | 'hide'): void {
  // Replace blur/hide with collapse effect
  collapseToStub(element);
}

/**
 * Replace tweet content with "AI tweet hidden" message
 */
export function replaceWithHiddenMessage(element: Element): void {
  // Check if already replaced
  if (element.querySelector('.slop-replacement')) {
    return;
  }
  
  // Find the main tweet content area
  const tweetTextElement = element.querySelector('[data-testid="tweetText"]');
  let contentContainer = tweetTextElement?.parentElement as HTMLElement;
  
  // Fallback: find a reasonable container
  if (!contentContainer) {
    contentContainer = element.querySelector('[lang]')?.parentElement as HTMLElement;
  }
  
  if (!contentContainer) {
    // Last resort: create container in the tweet element
    contentContainer = (element.querySelector('[data-testid="tweet"]') || element) as HTMLElement;
  }
  
  if (!contentContainer) {
    console.warn('Could not find content container for tweet replacement');
    return;
  }
  
  // Create replacement content
  const replacement = document.createElement('div');
  replacement.className = 'slop-replacement';
  replacement.style.cssText = `
    padding: 16px;
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    border: 1px solid #dee2e6;
    border-radius: 12px;
    text-align: center;
    margin: 8px 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;
  
  replacement.innerHTML = `
    <div style="color: #6c757d; font-size: 14px; font-weight: 500; margin-bottom: 8px;">
      🤖 AI-generated content hidden
    </div>
    <button class="slop-show-button" style="
      background: #007bff;
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
      transition: background-color 0.2s;
    " onmouseover="this.style.backgroundColor='#0056b3'" onmouseout="this.style.backgroundColor='#007bff'">
      Show anyway
    </button>
  `;
  
  // Store original content
  const originalContent = contentContainer.innerHTML;
  
  // Add click handler to show button
  const showButton = replacement.querySelector('.slop-show-button') as HTMLElement;
  showButton.addEventListener('click', () => {
    contentContainer.innerHTML = originalContent;
    contentContainer.style.filter = 'blur(3px)';
    contentContainer.style.opacity = '0.7';
    
    // Add a "hide again" button
    const hideButton = document.createElement('button');
    hideButton.textContent = 'Hide again';
    hideButton.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      background: rgba(0,0,0,0.7);
      color: white;
      border: none;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 10px;
      cursor: pointer;
      z-index: 1000;
    `;
    hideButton.addEventListener('click', () => {
      contentContainer.innerHTML = '';
      contentContainer.appendChild(replacement);
      contentContainer.style.filter = '';
      contentContainer.style.opacity = '';
    });
    
    contentContainer.style.position = 'relative';
    contentContainer.appendChild(hideButton);
  });
  
  // Replace content
  contentContainer.innerHTML = '';
  contentContainer.appendChild(replacement);
}

/**
 * Add visual debug highlighting to processed tweets
 */
export function addDebugHighlight(element: Element, detected: boolean): void {
  if (!debugMode) return;
  
  const htmlElement = element as HTMLElement;
  htmlElement.classList.remove('slop-debug-processed', 'slop-debug-detected');
  
  if (detected) {
    htmlElement.classList.add('slop-debug-detected');
    htmlElement.style.border = '2px solid red';
    htmlElement.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
  } else {
    htmlElement.classList.add('slop-debug-processed');
    htmlElement.style.border = '1px dashed green';
  }
}

export function removeTweetEffect(element: Element): void {
  const htmlElement = element as HTMLElement;
  
  // Remove collapse effects
  if (element.hasAttribute('data-slop-collapsed')) {
    const originalContent = element.getAttribute('data-original-content');
    if (originalContent) {
      element.innerHTML = originalContent;
    }
    element.removeAttribute('data-original-content');
    element.removeAttribute('data-slop-collapsed');
  }
  
  // Remove collapse header from expanded tweets
  const collapseHeaders = element.querySelectorAll('.slop-collapse-header');
  collapseHeaders.forEach(header => header.remove());
  
  // Remove all slop-related classes
  htmlElement.classList.remove('slop-tweet-collapsed', 'slop-tweet-expanded', 'slop-blurred', 'slop-hidden');
  
  // Reset any forced styles
  htmlElement.style.display = '';
  htmlElement.style.visibility = '';
  
  console.log('🧹 Removed all tweet effects from element');
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return function(this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: number;
  return function(this: any, ...args: Parameters<T>) {
    clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => func.apply(this, args), delay);
  };
} 