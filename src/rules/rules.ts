import { TweetMetadata } from '../utils/dom';

export interface SlopDetectionResult {
  isSlop: boolean;
  confidence: number;
  reasons: string[];
}

export const regexRules: RegExp[] = [
  // Timeline/progression patterns
  /at first.*then.*but eventually/i,
  /first.*then.*finally/i,
  /started.*then.*now/i,
  /went from.*to.*in \d+/i,
  /from \$?0 to \$?\d+/i,
  /\d+ years ago.*today/i,
  
  // Sales/marketing patterns
  /people buy from people who:/i,
  /want to \w+\? here's how/i,
  /\d{3,}.*here's how/i,
  /\d{3,}.*here's the/i,
  /here's what \w+ taught me:/i,
  /this changed everything:/i,
  /game changer:/i,
  /secret to \w+:/i,
  /unlock the secret/i,
  /proven strategies/i,
  /tried and tested/i,
  
  // Money/success patterns
  /\$\d{1,3}k.*in \d+ days/i,
  /\d+\s*million.*here's/i,
  /made \$\d+.*in \d+ months/i,
  /from zero to \$\d+/i,
  /passive income/i,
  /financial freedom/i,
  /multiple income streams/i,
  /6\-?figure/i,
  /7\-?figure/i,
  /millionaire mindset/i,
  /wealth building/i,
  /money making/i,
  
  // Hustle culture patterns
  /grind never stops/i,
  /hustle harder/i,
  /rise and grind/i,
  /no days off/i,
  /success has no shortcuts/i,
  /work while they sleep/i,
  /sacrifice today/i,
  /entrepreneur life/i,
  /ceo mindset/i,
  /boss up/i,
  /level up/i,
  
  // Motivational clichés
  /you don't need:.*you need:/i,
  /volume wins on \w+/i,
  /the answer is more/i,
  /consistency beats perfection/i,
  /growth is simply.*\d+%.*\d+%/i,
  /success is \d+%.*\d+%/i,
  /stop \w+ing everything/i,
  /stop making excuses/i,
  /you're overthinking/i,
  /quit complaining/i,
  /your future self will thank you/i,
  /isn't coming to save you/i,
  /bet on yourself/i,
  /believe in yourself/i,
  /trust the process/i,
  /stay focused/i,
  /never give up/i,
  /dream big/i,
  /anything is possible/i,
  /make it happen/i,
  /you got this/i,
  /stay hungry/i,
  /push through/i,
  /overcome obstacles/i,
  
  // Success formulas
  /successful people don't:/i,
  /millionaires do this:/i,
  /you can be a \w+ & still:/i,
  /here's the formula/i,
  /simple formula/i,
  /success formula/i,
  /\d+ rules? for/i,
  /\d+ ways to/i,
  /\d+ steps to/i,
  /\d+ habits of/i,
  /\d+ things \w+ people/i,
  /highly successful people/i,
  
  // Engagement bait
  /agree or disagree/i,
  /thoughts\?$/i,
  /what do you think\?/i,
  /am i wrong\?/i,
  /change my mind/i,
  /hot take:/i,
  /unpopular opinion:/i,
  /controversial take:/i,
  /real talk:/i,
  /let's be honest/i,
  /nobody talks about/i,
  /the truth is/i,
  /here's the reality/i,
  
  // Generic advice patterns
  /pro tip:/i,
  /life hack:/i,
  /golden rule:/i,
  /remember this:/i,
  /write this down:/i,
  /take notes:/i,
  /screenshot this/i,
  /save this post/i,
  /bookmark this/i,
  /daily reminder/i,
  /friendly reminder/i,
  /psa:/i,
  
  // Transformation claims
  /\d+\s*(downloads|users|followers|subscribers)/i,
  /transformed my life/i,
  /life\-?changing/i,
  /game changer/i,
  /total transformation/i,
  /completely changed/i,
  /turned my life around/i,
  
  // Generic success metrics
  /10x your/i,
  /double your/i,
  /triple your/i,
  /scale your/i,
  /grow your/i,
  /boost your/i,
  /increase your.*by \d+%/i,
  /optimize your/i,
  /maximize your/i,
  
  // Thread starters
  /thread \d+\/\d+/i,
  /1\/\d+/i,
  /🧵/,
  /thread below/i,
  /here's a thread/i,
  
  // Generic LinkedIn-style posts
  /lessons learned/i,
  /key takeaways/i,
  /what i learned/i,
  /mistakes i made/i,
  /if i could go back/i,
  /advice to my younger self/i,
  /what i wish i knew/i,
  
  // Productivity porn
  /morning routine/i,
  /5am club/i,
  /wake up at \d+/i,
  /productivity hack/i,
  /time management/i,
  /work\-life balance/i,
  /deep work/i,
  /flow state/i
];

export const numericRules = {
  maxEmojis: 3,
  maxLineBreaks: 6,
  maxHashtags: 5,
  maxMentions: 3
};

// Words that frequently appear in slop content
export const slopKeywords = [
  'mindset', 'entrepreneur', 'grind', 'hustle', 'success', 'millionaire',
  'billionaire', 'wealth', 'rich', 'money', 'income', 'passive', 'freedom',
  'motivation', 'inspiration', 'goals', 'dreams', 'vision', 'manifest',
  'abundance', 'prosperity', 'blessed', 'grateful', 'journey', 'path',
  'transformation', 'growth', 'level', 'upgrade', 'optimize', 'scale',
  'leverage', 'disrupt', 'innovate', 'game-changer', 'breakthrough',
  'formula', 'strategy', 'tactic', 'hack', 'secret', 'tip', 'trick'
];

export function isSlop(tweetText: string, metadata: TweetMetadata): boolean {
  const result = detectSlopAdvanced(tweetText, metadata);
  return result.isSlop;
}

export function detectSlopAdvanced(tweetText: string, metadata: TweetMetadata): SlopDetectionResult {
  const reasons: string[] = [];
  let confidence = 0;
  
  // Check regex patterns
  regexRules.forEach((pattern, index) => {
    if (pattern.test(tweetText)) {
      reasons.push(`Matched slop pattern ${index + 1}: ${pattern.source.slice(0, 50)}...`);
      confidence += 0.3;
    }
  });
  
  // Count slop keywords
  const lowerText = tweetText.toLowerCase();
  const keywordMatches = slopKeywords.filter(keyword => 
    lowerText.includes(keyword.toLowerCase())
  );
  
  if (keywordMatches.length > 2) {
    reasons.push(`Multiple slop keywords: ${keywordMatches.slice(0, 3).join(', ')}`);
    confidence += Math.min(keywordMatches.length * 0.15, 0.6);
  }
  
  // Emoji analysis
  const emojiCount = (tweetText.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu) || []).length;
  const lineBreakCount = (tweetText.match(/\n/g) || []).length;
  const hashtagCount = (tweetText.match(/#\w+/g) || []).length;
  const mentionCount = (tweetText.match(/@\w+/g) || []).length;
  
  if (emojiCount > numericRules.maxEmojis) {
    reasons.push(`Excessive emojis: ${emojiCount}`);
    confidence += 0.2;
  }
  
  if (lineBreakCount > numericRules.maxLineBreaks) {
    reasons.push(`Excessive line breaks: ${lineBreakCount}`);
    confidence += 0.2;
  }
  
  if (hashtagCount > numericRules.maxHashtags) {
    reasons.push(`Excessive hashtags: ${hashtagCount}`);
    confidence += 0.3;
  }
  
  // Check for AI-generated content indicators
  if (tweetText.toLowerCase().includes('ai generated')) {
    reasons.push('Contains "AI generated" phrase');
    confidence += 0.8;
  }
  
  if (tweetText.toLowerCase().includes('as an ai')) {
    reasons.push('Contains AI self-identification');
    confidence += 0.9;
  }
  
  // Check for generic motivational structure
  const sentences = tweetText.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length >= 3) {
    const hasNumbers = sentences.some(s => /\d+/.test(s));
    const hasQuestion = sentences.some(s => s.includes('?'));
    const hasExclamation = sentences.some(s => s.includes('!'));
    
    if (hasNumbers && hasQuestion && hasExclamation) {
      reasons.push('Generic motivational structure detected');
      confidence += 0.3;
    }
  }
  
  // Check engagement vs content quality ratio
  const totalEngagement = metadata.likes + metadata.retweets + metadata.replies;
  const wordCount = tweetText.split(/\s+/).length;
  
  if (totalEngagement === 0 && wordCount > 50) {
    reasons.push('Long tweet with no engagement');
    confidence += 0.2;
  }
  
  // Check for common slop formatting patterns
  if (tweetText.includes('↓') || tweetText.includes('👇') || tweetText.includes('⬇️')) {
    reasons.push('Contains engagement arrows');
    confidence += 0.2;
  }
  
  // Check for excessive capitalization
  const capsWords = tweetText.match(/\b[A-Z]{2,}\b/g) || [];
  if (capsWords.length > 3) {
    reasons.push(`Excessive capitalization: ${capsWords.length} words`);
    confidence += 0.2;
  }
  
  // Check for number-heavy content (common in slop)
  const numbers = tweetText.match(/\d+/g) || [];
  if (numbers.length > 4) {
    reasons.push(`Number-heavy content: ${numbers.length} numbers`);
    confidence += 0.2;
  }
  
  confidence = Math.min(confidence, 1.0);
  
  return {
    isSlop: confidence > 0.25, // Lowered threshold to catch more content
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