import { TweetMetadata } from './storage';

declare global {
  interface Window {
    slopBlockRemoveFromCollapsed?: (tweetId: string) => void;
  }
}

function getTweetElements(): Element[] {
  return Array.from(document.querySelectorAll('[data-testid="tweet"]')).filter(tweet => {
    const parent = tweet.closest('article');
    return parent && !parent.hasAttribute('data-slop-processed');
  });
}

function hasAttachment(element: Element): boolean {
  const attachmentSelectors = [
    '[data-testid="tweetPhoto"]',
    '[data-testid="videoPlayer"]',
    '[data-testid="tweetVideo"]', 
    '[data-testid="videoComponent"]',
    '[data-testid="card.wrapper"]',
    '[data-testid="tweetGif"]',
    '[data-testid="gif"]',
    '[data-testid="poll"]',
    '[data-testid="quoteTweet"]',
    'img[src*="pbs.twimg.com"]',
    'img[src*="media"]',
    '[data-testid="attachments"]'
  ];
  
  for (const selector of attachmentSelectors) {
    if (element.querySelector(selector)) {
      return true;
    }
  }
  return false;
}

function extractTweetId(element: HTMLElement): string | null {
  const links = element.querySelectorAll('a[href*="/status/"]');
  for (const link of Array.from(links)) {
    const href = (link as HTMLAnchorElement).href;
    const match = href.match(/\/status\/(\d+)/);
    if (match && match[1]) return match[1];
  }
  return null;
}

function fallbackHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) - hash) + content.charCodeAt(i);
    hash |= 0;
  }
  return 'h' + Math.abs(hash);
}

function extractTweetData(element: Element): TweetMetadata | null {
  try {
    if (hasAttachment(element)) {
      return null;
    }

    const id = extractTweetId(element as HTMLElement);

    const tweetText = extractTweetTextRobust(element);
    if (!tweetText) {
      return null;
    }

    const userElement = element.querySelector('[data-testid="User-Name"]');
    const username = userElement?.textContent?.trim() || 'unknown';


    const metadata: TweetMetadata = {
      id: id || fallbackHash(tweetText),
      text: tweetText,
      username,
      element: element as HTMLElement,
      timestamp: Date.now()
    };

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
    return extractedText.trim();
  }

  const tweetContainer = element.querySelector('[data-testid="tweet"]') || element;
  const textNodes = getTextNodesFromElement(tweetContainer);
  const meaningfulTexts = textNodes
    .map(node => node.textContent?.trim())
    .filter((text): text is string => text !== undefined && text.length > 3)
    .filter(text => !isNavigationText(text));

  if (meaningfulTexts.length > 0) {
    extractedText = meaningfulTexts.join(' ').trim();
    return extractedText;
  }

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

function collapseAITweet(element: HTMLElement): void {
  if (element.hasAttribute('data-ai-collapsed')) {
    return;
  }

  const existingBars = element.querySelectorAll('.ai-tweet-bar');
  existingBars.forEach(bar => bar.remove());

  const originalContent = element.innerHTML;
  element.setAttribute('data-ai-original-content', originalContent);

  const aiBar = document.createElement('div');
  aiBar.className = 'ai-tweet-bar';
  aiBar.style.cssText = `
    background: white;
    border: 1px solid #e1e8ed;
    border-radius: 8px;
    padding: 8px 12px;
    margin: 4px 0;
    cursor: pointer;
    transition: background-color 0.2s ease;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 20px;
  `;

  aiBar.innerHTML = `
    <span style="color: #657786; font-size: 13px; font-weight: 400;">ai tweet hidden</span>
    <span style="color: #657786; font-size: 12px;">▼</span>
  `;

  aiBar.addEventListener('mouseenter', () => {
    aiBar.style.backgroundColor = '#f7f9fa';
  });

  aiBar.addEventListener('mouseleave', () => {
    aiBar.style.backgroundColor = 'white';
  });

  aiBar.addEventListener('click', (e) => {
    e.stopPropagation();
    expandAITweet(element);
  });

  element.innerHTML = '';
  element.appendChild(aiBar);
  element.setAttribute('data-ai-collapsed', 'true');
  element.style.display = 'block';
}

function expandAITweet(element: HTMLElement): void {
  if (!element.hasAttribute('data-ai-collapsed')) {
    return;
  }

  const tweetId = extractTweetId(element);
  if (tweetId && window.slopBlockRemoveFromCollapsed) {
    window.slopBlockRemoveFromCollapsed(tweetId);
  }

  const originalContent = element.getAttribute('data-ai-original-content');
  if (originalContent) {
    element.innerHTML = originalContent;
  }

  const existingHeaders = element.querySelectorAll('.ai-hide-header');
  existingHeaders.forEach(header => header.remove());

  const hideHeader = document.createElement('div');
  hideHeader.className = 'ai-hide-header';
  hideHeader.style.cssText = `
    background: white;
    border: 1px solid #e1e8ed;
    border-radius: 8px;
    padding: 6px 10px;
    margin-bottom: 8px;
    cursor: pointer;
    transition: background-color 0.2s ease;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    display: flex;
    align-items: center;
    justify-content: space-between;
  `;

  hideHeader.innerHTML = `
    <span style="color: #657786; font-size: 13px; font-weight: 400;">🤖 hide ai tweet</span>
    <span style="color: #657786; font-size: 12px;">▲</span>
  `;

  hideHeader.addEventListener('mouseenter', () => {
    hideHeader.style.backgroundColor = '#f7f9fa';
  });

  hideHeader.addEventListener('mouseleave', () => {
    hideHeader.style.backgroundColor = 'white';
  });

  hideHeader.addEventListener('click', (e) => {
    e.stopPropagation();
    collapseAITweet(element);
  });

  element.insertBefore(hideHeader, element.firstChild);
  element.removeAttribute('data-ai-collapsed');
  element.removeAttribute('data-ai-original-content');
}

function expandFromStub(element: HTMLElement): void {
  if (!element.hasAttribute('data-slop-collapsed')) {
    return;
  }

  const tweetId = extractTweetId(element);
  if (tweetId && window.slopBlockRemoveFromCollapsed) {
    window.slopBlockRemoveFromCollapsed(tweetId);
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



export { 
  getTweetElements, 
  extractTweetData, 
  collapseAITweet,
  expandAITweet,
  hasAttachment,
  type TweetMetadata 
}; 