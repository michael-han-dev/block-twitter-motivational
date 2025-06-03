import { TweetMetadata } from '../utils/dom';

export interface SlopDetectionResult {
  isSlop: boolean;
  confidence: number;
  reasons: string[];
}

export const regexRules: RegExp[] = [
  /at first.*then.*but eventually/i,
  /first.*then.*finally/i,
  /started.*then.*now/i,
  /people buy from people who:/i,
  /want to \w+\? here's how/i,
  /you don't need:.*you need:/i,
  /here's what \w+ taught me:/i,
  /\d{3,}.*here's how/i,
  /\d{3,}.*here's the/i,
  /\$\d{1,3}k.*in \d+ days/i,
  /\d+\s*million.*here's/i,
  /volume wins on \w+/i,
  /the answer is more/i,
  /consistency beats perfection/i,
  /growth is simply.*\d+%.*\d+%/i,
  /success is \d+%.*\d+%/i,
  /went from \$?\d+.*to \$?\d+/i,
  /\d+\s*(downloads|users|followers)/i,
  /made \$\d+.*in \d+ months/i,
  /from zero to \$\d+/i,
  /stop \w+ing everything/i,
  /stop making excuses/i,
  /you're overthinking/i,
  /quit complaining/i,
  /you can be a \w+ & still:/i,
  /successful people don't:/i,
  /millionaires do this:/i,
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
  
  regexRules.forEach((pattern, index) => {
    if (pattern.test(tweetText)) {
      reasons.push(`Matched slop pattern ${index + 1}`);
      confidence += 0.4;
    }
  });
  
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