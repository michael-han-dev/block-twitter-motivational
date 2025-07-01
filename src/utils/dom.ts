import { TweetMetadata, getStorageValue, STORAGE_KEYS, DEFAULT_VALUES } from './storage';
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

async function extractTweetData(element: Element): Promise<TweetMetadata | null> {
  let blockedKeywords: string[];
  try {
    blockedKeywords = await getStorageValue(
      STORAGE_KEYS.BLOCKED_KEYWORDS,
      DEFAULT_VALUES[STORAGE_KEYS.BLOCKED_KEYWORDS]
    );

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

const sharedBarStyles = `
  background: white;
  border: 1px solid #e1e8ed;
  border-radius: 8px;
  padding: 8px 12px;
  margin: 4px 0;
  cursor: pointer;
  transition: background-color 0.2s ease;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  display: block;
  width: 100%;
  box-sizing: border-box;
  min-height: 20px;
`;

function createBar(content: string, className: string): HTMLDivElement {
  const bar = document.createElement('div');
  bar.className = className;
  bar.style.cssText = sharedBarStyles;

  const barContent = document.createElement('div');
  barContent.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;
  barContent.innerHTML = content;

  bar.appendChild(barContent);
  bar.addEventListener('mouseenter', () => bar.style.backgroundColor = '#f7f9fa');
  bar.addEventListener('mouseleave', () => bar.style.backgroundColor = 'white');
  
  return bar;
}

function collapseAITweet(element: HTMLElement): void {
  if (element.hasAttribute('data-ai-collapsed')) return;

  const existingBars = element.querySelectorAll('.ai-tweet-bar');
  existingBars.forEach(bar => bar.remove());

  const userElement = element.querySelector('[data-testid="User-Name"]')?.textContent?.trim() || 'unknown';
  const handle = userElement.match(/@\w+/)?.[0] || 'unknown';

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position: relative; width: 100%; display: block;';

  const aiBar = createBar(
    `<span style="color: #657786; font-size: 13px; font-weight: 400;">${handle}: ai tweet hidden</span>
     <span style="color: #657786; font-size: 12px;">▼</span>`,
    'ai-tweet-bar'
  );
  
  aiBar.addEventListener('click', (e) => {
    e.stopPropagation();
    expandAITweet(element);
  });

  wrapper.appendChild(aiBar);
  element.style.cssText = 'position: relative; display: block;';
  element.insertBefore(wrapper, element.firstChild);
  
  Array.from(element.children).forEach(child => {
    if (child !== wrapper) (child as HTMLElement).style.display = 'none';
  });
  
  element.setAttribute('data-ai-collapsed', 'true');
}

function expandAITweet(element: HTMLElement): void {
  if (!element.hasAttribute('data-ai-collapsed')) return;

  const tweetId = extractTweetId(element);
  if (tweetId && window.slopBlockRemoveFromCollapsed) {
    window.slopBlockRemoveFromCollapsed(tweetId);
  }

  const existingBars = element.querySelectorAll('.ai-tweet-bar, .ai-hide-header');
  existingBars.forEach(bar => bar.parentElement?.remove());

  Array.from(element.children).forEach(child => {
    (child as HTMLElement).style.display = '';
  });

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position: relative; width: 100%; display: block;';
  
  const userElement = element.querySelector('[data-testid="User-Name"]')?.textContent?.trim() || 'unknown';
  const handle = userElement.match(/@\w+/)?.[0] || 'unknown';

  const hideHeader = createBar(
    `<span style="color: #657786; font-size: 13px; font-weight: 400;">${handle}: hide again</span>
     <span style="color: #657786; font-size: 12px;">▲</span>`,
    'ai-hide-header'
  );

  hideHeader.addEventListener('click', (e) => {
    e.stopPropagation();
    collapseAITweet(element);
  });

  wrapper.appendChild(hideHeader);
  element.style.display = 'block';
  element.insertBefore(wrapper, element.firstChild);
  element.removeAttribute('data-ai-collapsed');
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

export { 
  getTweetElements, 
  extractTweetData, 
  collapseAITweet,
  expandAITweet,
  type TweetMetadata 
}; 