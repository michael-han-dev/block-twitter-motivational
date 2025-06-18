import { TweetMetadata } from '../utils/dom';

interface SlopAnalysis {
  isSlop: boolean;
  confidence: number;
  reasons: string[];
}

const SLOP_PATTERNS: RegExp[] = [
  /if you're not (growing|building|scaling|optimizing)/i,
  /here's what I learned/i,
  /\d+ things? (that|I wish|nobody tells you)/i,
  /stop doing this.*start doing this/i,
  /the \d+ (secrets?|steps?|ways?)/i,
  /why \d+% of people fail/i,
  /most people don't (know|realize|understand)/i,
  /I turned \$\d+ into \$\d+/i,

  /buy my course/i,
  /link in bio/i,
  /dm me for/i,
  /limited time offer/i,
  /exclusive access/i,
  /join my/i,
  /free training/i,
  /webinar/i,
  /masterclass/i,
  /coaching/i,
  /mentorship/i,
  /blueprint/i,
  /system that made me/i,
  /secrets? they don't want you to know/i,

  /\$\d+k?\/month/i,
  /six[\s-]?figure/i,
  /seven[\s-]?figure/i,
  /passive income/i,
  /financial freedom/i,
  /quit my job/i,
  /fire your boss/i,
  /work from home/i,
  /laptop lifestyle/i,
  /location independent/i,
  /digital nomad/i,
  /escape the 9[\s-]?to[\s-]?5/i,

  /hustle harder/i,
  /grind never stops/i,
  /sleep is for the weak/i,
  /no days off/i,
  /rise and grind/i,
  /beast mode/i,
  /millionaire mindset/i,
  /entrepreneur life/i,
  /CEO mindset/i,
  /winner mentality/i,
  /alpha (male|mindset)/i,
  /sigma (male|grindset)/i,
  /that grindset/i,

  /believe in yourself/i,
  /follow your dreams/i,
  /you miss 100% of the shots/i,
  /success is a choice/i,
  /mindset is everything/i,
  /you are your only limit/i,
  /dream big/i,
  /stay positive/i,
  /good vibes only/i,
  /manifest your destiny/i,
  /law of attraction/i,
  /positive energy/i,
  /trust the process/i,
  /everything happens for a reason/i,
  /be grateful/i,
  /blessed and grateful/i,
  /counting my blessings/i,
  /gratitude changes everything/i,
  /attitude of gratitude/i,
  /focus on solutions not problems/i,
  /problems are opportunities/i,
  /failure is just feedback/i,
  /there's no such thing as failure/i,
  /every setback is a setup for a comeback/i,

  /if you do (this|these) \d+ things/i,
  /simple formula/i,
  /proven system/i,
  /step[\s-]?by[\s-]?step (guide|process)/i,
  /foolproof method/i,
  /ultimate guide/i,
  /complete blueprint/i,
  /secret formula/i,
  /exact strategy/i,
  /winning formula/i,
  /game[\s-]?changing/i,

  /you won't believe what happened next/i,
  /this will blow your mind/i,
  /most people don't know this/i,
  /here's the thing/i,
  /let that sink in/i,
  /read that again/i,
  /this is important/i,
  /pay attention/i,

  /actionable (tips|advice|strategies)/i,
  /practical advice/i,
  /real[\s-]?world application/i,
  /implement (this|these) today/i,
  /start doing this now/i,
  /game[\s-]?changer/i,
  /life[\s-]?changing/i,

  /overnight success/i,
  /transformed my life in \d+ days/i,
  /went from zero to/i,
  /\d+ to \d+ in \d+ months/i,
  /before and after/i,
  /complete transformation/i,

  /made \$\d+k? (today|this month|last month)/i,
  /revenue/i,
  /profit margin/i,
  /roi of \d+%/i,
  /\d+x return/i,

  /thread/i,
  /🧵/i,
  /here's what you need to know/i,

  /unpopular opinion/i,
  /controversial take/i,
  /hot take/i,
  /let's normalize/i,
  /normalize this/i,
  /this is your reminder/i,
  /friendly reminder/i,
  /daily reminder/i,
  /motivation monday/i,
  /wisdom wednesday/i,
  /thoughtful thursday/i,
  /feel[\s-]?good friday/i
];

const SLOP_KEYWORDS: string[] = [
  'mindset', 'hustle', 'grind', 'manifest', 'abundance', 'entrepreneur', 'success',
  'motivation', 'inspiration', 'goals', 'dreams', 'vision', 'purpose', 'passion',
  'breakthrough', 'transformation', 'journey', 'growth', 'evolve', 'elevate',
  'optimize', 'maximize', 'unlock', 'unleash', 'potential', 'power', 'energy',
  'vibration', 'frequency', 'alignment', 'authentic', 'genuine', 'real', 'truth',
  'wisdom', 'knowledge', 'insight', 'awareness', 'consciousness', 'awakening'
];

export function analyzeTweet(tweet: TweetMetadata): SlopAnalysis {
  const text = tweet.text.toLowerCase();
  const reasons: string[] = [];
  let confidence = 0;

  for (const pattern of SLOP_PATTERNS) {
    if (pattern.test(text)) {
      confidence += 0.3;
      reasons.push(`Matches pattern: ${pattern.source}`);
    }
  }

  let keywordCount = 0;
  for (const keyword of SLOP_KEYWORDS) {
    if (text.includes(keyword.toLowerCase())) {
      keywordCount++;
    }
  }
  
  if (keywordCount >= 3) {
    confidence += 0.2;
    reasons.push(`High slop keyword density: ${keywordCount} keywords`);
  }

  const emojiCount = (text.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu) || []).length;
  const textLength = text.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').length;
  
  if (textLength > 0) {
    const emojiRatio = emojiCount / textLength;
    if (emojiRatio > 0.1) {
      confidence += 0.15;
      reasons.push(`High emoji to text ratio: ${(emojiRatio * 100).toFixed(1)}%`);
    }
  }

  if (emojiCount > 5) {
    confidence += 0.1;
    reasons.push(`Excessive emojis: ${emojiCount}`);
  }

  if (text.includes('ai') || text.includes('artificial intelligence') || text.includes('chatgpt') || text.includes('openai')) {
    if (!/human|person|people|individual|someone|anyone/.test(text)) {
      confidence += 0.2;
      reasons.push('Mentions AI without human context');
    }
  }

  if (text.match(/^(here's|this is|today|remember)/i) && text.match(/(success|mindset|growth)$/i)) {
    confidence += 0.15;
    reasons.push('Generic motivational structure');
  }

  const engagementRatio = (tweet.engagement.likes + tweet.engagement.retweets) / Math.max(1, tweet.text.length);
  if (engagementRatio > 10 && tweet.text.length < 50) {
    confidence += 0.1;
    reasons.push('High engagement with low content quality');
  }

  if (/\d+\.\s|\d+\)\s/.test(text) && text.split(/\d+[.\)]\s/).length > 3) {
    confidence += 0.1;
    reasons.push('List format (common in slop)');
  }

  const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
  if (capsRatio > 0.3) {
    confidence += 0.1;
    reasons.push('Excessive capitalization');
  }

  const numberMatches = text.match(/\d+/g) || [];
  if (numberMatches.length > 3) {
    confidence += 0.05;
    reasons.push('Number-heavy content');
  }

  return {
    isSlop: confidence > 0.25,
    confidence: Math.min(confidence, 1),
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