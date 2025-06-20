import { getStorageValue, STORAGE_KEYS, DEFAULT_VALUES } from './storage';


const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

export interface LLMAnalysisResult {
  id: number;
  isSlop: boolean;
  confidence: number;   
}

export async function analyzeTweetsWithLLM(
  tweets: string[]
): Promise<LLMAnalysisResult[] | null> {
  if (tweets.length === 0) return [];
  
  const apiKey = await getStorageValue(
    STORAGE_KEYS.OPENROUTER_API_KEY,
    DEFAULT_VALUES[STORAGE_KEYS.OPENROUTER_API_KEY]
  );
  
  if (!apiKey) {
    console.warn('[OpenRouter] No API key set – skipping remote analysis');
    return null;
  }

  const prompt = await getStorageValue(
    STORAGE_KEYS.SYSTEM_PROMPT,
    DEFAULT_VALUES[STORAGE_KEYS.SYSTEM_PROMPT]
  );

  const userContent = `Analyze these ${tweets.length} tweets and identify which are AI-generated motivational slop, engagement bait, or generic inspirational content. Return JSON with format: {"results": [{"id": 0, "isSlop": true/false, "confidence": 0.0-1.0}]}

Tweets:
${tweets.map((tweet, i) => `${i}: ${tweet}`).join('\n\n')}`;

  const messages = [
    {
      role: 'system',
      content: prompt
    },
    {
      role: 'user',
      content: userContent
    }
  ];

  const body: Record<string, unknown> = {
    model: 'meta-llama/llama-4-maverick',
    temperature: 0.1,
    max_tokens: 1000,
    messages,
    response_format: { type: 'json_object' }
  };

  try {
    console.log('[OpenRouter] Sending request with', tweets.length, 'tweets');
    
    const res = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'SlopBlock Extension'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('[OpenRouter] HTTP error', res.status, errorText);
      return null;
    }

    const responseText = await res.text();
    console.log('[OpenRouter] Full response text:', responseText);
    
    if (!responseText.trim()) {
      console.error('[OpenRouter] Empty response from API');
      return null;
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[OpenRouter] Failed to parse response JSON:', parseError);
      console.error('[OpenRouter] Response was:', responseText);
      return null;
    }

    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) {
      console.error('[OpenRouter] No content in response data:', data);
      return null;
    }

    console.log('[OpenRouter] AI response content:', raw);
    
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (contentParseError) {
      console.error('[OpenRouter] Failed to parse AI response JSON:', contentParseError);
      console.error('[OpenRouter] AI content was:', raw);
      return null;
    }
    
    console.log('[OpenRouter] Parsed results:', parsed);
    return parsed.results || parsed;
  } catch (err) {
    console.error('[OpenRouter] Network/parse error', err);
    return null;
  }
} 