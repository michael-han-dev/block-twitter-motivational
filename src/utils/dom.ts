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

/**
 * Find tweet elements in the given DOM node
 */
export function findTweetElements(node: Element): TweetElement[] {
  const tweets: TweetElement[] = [];
  
  // Twitter/X uses data-testid="tweet" for individual tweets
  const tweetElements = node.querySelectorAll('[data-testid="tweet"]');
  
  tweetElements.forEach(element => {
    const tweetData = extractTweetData(element);
    if (tweetData) {
      tweets.push(tweetData);
    }
  });
  
  return tweets;
}

/**
 * Extract tweet data from a tweet element
 */
function extractTweetData(element: Element): TweetElement | null {
  try {
    // Extract text content
    const textElement = element.querySelector('[data-testid="tweetText"]');
    const textContent = textElement?.textContent?.trim() || '';
    
    // Extract engagement metrics
    const likes = extractEngagementCount(element, 'like');
    const retweets = extractEngagementCount(element, 'retweet');
    const replies = extractEngagementCount(element, 'reply');
    
    // Check if account is verified
    const isVerified = !!element.querySelector('[data-testid="icon-verified"]');
    
    // Extract username
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

/**
 * Apply visual effects to a tweet element
 */
export function applyTweetEffect(element: Element, effect: 'blur' | 'hide'): void {
  element.classList.remove('slop-blurred', 'slop-hidden');
  
  if (effect === 'blur') {
    element.classList.add('slop-blurred');
  } else if (effect === 'hide') {
    element.classList.add('slop-hidden');
  }
}

/**
 * Remove all visual effects from a tweet element
 */
export function removeTweetEffect(element: Element): void {
  element.classList.remove('slop-blurred', 'slop-hidden');
}

/**
 * Throttle function to limit how often a function can be called
 */
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