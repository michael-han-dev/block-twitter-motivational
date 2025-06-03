/**
 * Heuristics engine for detecting AI-generated "slop" content
 * This is a placeholder implementation - actual rules will be provided later
 */

import { TweetMetadata } from '../utils/dom';

export interface SlopDetectionResult {
  isSlop: boolean;
  confidence: number;
  reasons: string[];
}

/**
 * Main slop detection function
 * @param tweetText The text content of the tweet
 * @param metadata Tweet engagement and account metadata
 * @returns Boolean indicating if tweet is likely slop
 */
export function isSlop(tweetText: string, metadata: TweetMetadata): boolean {
  const result = detectSlopAdvanced(tweetText, metadata);
  return result.isSlop;
}

/**
 * Advanced slop detection with confidence scoring and reasons
 * @param tweetText The text content of the tweet
 * @param metadata Tweet engagement and account metadata
 * @returns Detailed detection result
 */
export function detectSlopAdvanced(tweetText: string, metadata: TweetMetadata): SlopDetectionResult {
  // TODO: Insert actual heuristics patterns here
  // This is a placeholder implementation
  
  const reasons: string[] = [];
  let confidence = 0;
  
  // Placeholder heuristics for testing
  if (tweetText.toLowerCase().includes('ai generated')) {
    reasons.push('Contains "AI generated" phrase');
    confidence += 0.8;
  }
  
  if (tweetText.toLowerCase().includes('as an ai')) {
    reasons.push('Contains AI self-identification');
    confidence += 0.9;
  }
  
  // Very basic engagement ratio check (placeholder)
  const totalEngagement = metadata.likes + metadata.retweets + metadata.replies;
  if (totalEngagement === 0 && tweetText.length > 200) {
    reasons.push('Long tweet with no engagement');
    confidence += 0.3;
  }
  
  // Normalize confidence to 0-1 range
  confidence = Math.min(confidence, 1.0);
  
  return {
    isSlop: confidence > 0.5, // Threshold for classification
    confidence,
    reasons
  };
}

/**
 * Check if a user should be whitelisted (never marked as slop)
 * @param username The username to check
 * @param userWhitelist Array of whitelisted usernames
 * @returns True if user is whitelisted
 */
export function isWhitelisted(username: string, userWhitelist: string[]): boolean {
  if (!username || !userWhitelist.length) return false;
  
  const normalizedUsername = username.toLowerCase().replace('@', '');
  return userWhitelist.some(whitelisted => 
    whitelisted.toLowerCase() === normalizedUsername
  );
}

/**
 * Future: This is where actual regex patterns and ML models will be integrated
 * The API surface will remain the same to ensure compatibility
 */

// Placeholder patterns - these will be replaced with real detection rules
const PLACEHOLDER_PATTERNS = {
  // AI self-identification patterns
  AI_INDICATORS: [
    /as an ai/i,
    /i am an ai/i,
    /ai generated/i,
    /artificial intelligence/i
  ],
  
  // Generic motivational patterns (very basic examples)
  GENERIC_MOTIVATION: [
    /believe in yourself/i,
    /you can do it/i,
    /never give up/i
  ],
  
  // Engagement farming patterns
  ENGAGEMENT_BAIT: [
    /like if you agree/i,
    /retweet if/i,
    /comment below/i
  ]
};

/**
 * Apply regex patterns to detect slop (placeholder implementation)
 */
function applyPatterns(text: string): { matches: string[], score: number } {
  const matches: string[] = [];
  let score = 0;
  
  // Check each pattern category
  Object.entries(PLACEHOLDER_PATTERNS).forEach(([category, patterns]) => {
    patterns.forEach(pattern => {
      if (pattern.test(text)) {
        matches.push(category);
        score += 0.3; // Each match adds to the score
      }
    });
  });
  
  return { matches, score: Math.min(score, 1.0) };
}

// Export for testing and debugging
export { PLACEHOLDER_PATTERNS, applyPatterns }; 