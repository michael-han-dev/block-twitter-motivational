import { getStorageValue, STORAGE_KEYS, DEFAULT_VALUES } from './storage';

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

export interface LLMAnalysisResult {
  id: number;
  isSlop: boolean;
  confidence: number;   
}

export async function analyzeTweetsWithLLM(
  tweets: string[]
): Promise<LLMAnalysisResult[] | null> {
  if (tweets.length === 0) return [];
  
  let apiKey: string;
  let prompt: string;
  
  try {
    apiKey = await getStorageValue(
      STORAGE_KEYS.GROQ_API_KEY,
      DEFAULT_VALUES[STORAGE_KEYS.GROQ_API_KEY]
    );
    
    console.log('SlopBlock: API key status:', apiKey ? `Found (${apiKey.length} chars, starts with: ${apiKey.substring(0, 10)}...)` : 'NOT FOUND');
    
    if (!apiKey) {
      console.warn('SlopBlock: No API key set – skipping remote analysis');
      return null;
    }

    if (!apiKey.startsWith('gsk_')) {
      console.error('SlopBlock: Invalid API key format - Groq keys should start with "gsk_"');
      return null;
    }

    prompt = await getStorageValue(
      STORAGE_KEYS.SYSTEM_PROMPT,
      DEFAULT_VALUES[STORAGE_KEYS.SYSTEM_PROMPT]
    );
  } catch (storageError) {
    console.warn('SlopBlock: Extension context invalidated, skipping analysis');
    return null;
  }

  const userContent = `Analyze these ${tweets.length} tweets and identify which are AI-generated motivational slop, engagement bait, or generic inspirational content. Return ONLY a JSON object with format: {"results": [{"id": 0, "isSlop": true/false, "confidence": 0.0-1.0}]}

Tweets:
${tweets.map((tweet, i) => `${i}: ${tweet}`).join('\n\n')}`;

  const messages = [
    {
      role: 'system',
      content: prompt + '\n\nIMPORTANT: You must respond with ONLY valid JSON in the exact format specified. No additional text, explanations, or formatting.'
    },
    {
      role: 'user',
      content: userContent
    }
  ];

  const body = {
    model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
    temperature: 0.1,
    max_tokens: 1000,
    messages,
    response_format: { type: 'json_object' }
  };

  try {
    console.log('SlopBlock: Making Groq API request...');
    const res = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('SlopBlock: HTTP error', res.status, errorText);
      
      if (res.status === 401) {
        console.error('SlopBlock: API key is invalid. Please check your Groq API key in extension settings.');
      }
      return null;
    }

    const responseText = await res.text();
    
    if (!responseText.trim()) {
      console.error('SlopBlock: Empty response from API');
      return null;
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('SlopBlock: Failed to parse response JSON:', parseError);
      console.error('SlopBlock: Response was:', responseText);
      return null;
    }

    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) {
      console.error('SlopBlock: No content in response data:', data);
      return null;
    }
    
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (contentParseError) {
      console.error('SlopBlock: Failed to parse AI response JSON:', contentParseError);
      console.error('SlopBlock: AI content was:', raw);
      
      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          console.log('SlopBlock: Attempting to extract JSON from text...');
          parsed = JSON.parse(jsonMatch[0]);
          console.log('SlopBlock: Successfully extracted JSON from text');
        } else {
          console.error('SlopBlock: No JSON found in response');
          return null;
        }
      } catch (extractError) {
        console.error('SlopBlock: Failed to extract JSON from text:', extractError);
        return null;
      }
    }
    
    if (!parsed.results || !Array.isArray(parsed.results)) {
      console.error('SlopBlock: Invalid response format - missing results array');
      return null;
    }
    
    console.log('SlopBlock: Successfully parsed Groq response');
    return parsed.results;
  } catch (err) {
    console.error('SlopBlock: Network/parse error', err);
    return null;
  }
} 