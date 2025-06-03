import { TweetMetadata } from '../utils/dom';

export interface SlopDetectionResult {
  isSlop: boolean;
  confidence: number;
  reasons: string[];
}

export const regexRules: RegExp[] = [
  // Three-step narrative hooks
  /at first.*then.*but eventually/i,
  /first.*then.*finally/i,
  /started.*then.*now/i,
  
  // List-based content patterns
  /people buy from people who:/i,
  /want to \w+\? here's how/i,
  /you don't need:.*you need:/i,
  /here's what \w+ taught me:/i,
  
  // Sensational hooks with numbers
  /\d{3,}.*here's how/i,
  /\d{3,}.*here's the/i,
  /\$\d{1,3}k.*in \d+ days/i,
  /\d+\s*million.*here's/i,
  
  // Common mantras and formulas
  /volume wins on \w+/i,
  /the answer is more/i,
  /consistency beats perfection/i,
  /growth is simply.*\d+%.*\d+%/i,
  /success is \d+%.*\d+%/i,
  
  // Failure-to-success metrics
  /went from \$?\d+.*to \$?\d+/i,
  /\d+\s*(downloads|users|followers)/i,
  /made \$\d+.*in \d+ months/i,
  /from zero to \$\d+/i,
  
  // Tough-love imperatives
  /stop \w+ing everything/i,
  /stop making excuses/i,
  /you're overthinking/i,
  /quit complaining/i,
  
  // Virtue signaling lists
  /you can be a \w+ & still:/i,
  /successful people don't:/i,
  /millionaires do this:/i,
  
  // Generic motivation
  /your future self will thank you/i,
  /isn't coming to save you/i,
  /bet on yourself/i
];

export const numericRules = {
  maxEmojis: 3,
  maxLineBreaks: 6
};

export function isSlop(tweetText: string, metadata: TweetMetadata): boolean {
  const result = detectSlopAdvanced(tweetText, metadata);
  return result.isSlop;
}

export function detectSlopAdvanced(tweetText: string, metadata: TweetMetadata): SlopDetectionResult {
  const reasons: string[] = [];
  let confidence = 0;
  
  // Apply regex pattern matching
  regexRules.forEach((pattern, index) => {
    if (pattern.test(tweetText)) {
      reasons.push(`Matched slop pattern ${index + 1}`);
      confidence += 0.4;
    }
  });
  
  // Apply numeric rules
  const emojiCount = (tweetText.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu) || []).length;
  const lineBreakCount = (tweetText.match(/\n/g) || []).length;
  
  if (emojiCount > numericRules.maxEmojis) {
    reasons.push(`Too many emojis: ${emojiCount}`);
    confidence += 0.3;
  }
  
  if (lineBreakCount > numericRules.maxLineBreaks) {
    reasons.push(`Too many line breaks: ${lineBreakCount}`);
    confidence += 0.3;
  }
  
  // Legacy checks
  if (tweetText.toLowerCase().includes('ai generated')) {
    reasons.push('Contains "AI generated" phrase');
    confidence += 0.8;
  }
  
  if (tweetText.toLowerCase().includes('as an ai')) {
    reasons.push('Contains AI self-identification');
    confidence += 0.9;
  }
  
  const totalEngagement = metadata.likes + metadata.retweets + metadata.replies;
  if (totalEngagement === 0 && tweetText.length > 200) {
    reasons.push('Long tweet with no engagement');
    confidence += 0.3;
  }
  
  confidence = Math.min(confidence, 1.0);
  
  return {
    isSlop: confidence > 0.3,
    confidence,
    reasons
  };
}

export function isWhitelisted(username: string, userWhitelist: string[]): boolean {
  if (!username || !userWhitelist.length) return false;
  
  const normalizedUsername = username.toLowerCase().replace('@', '');
  return userWhitelist.some(whitelisted => 
    whitelisted.toLowerCase() === normalizedUsername
  );
} 