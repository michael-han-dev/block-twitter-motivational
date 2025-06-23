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
  
  let apiKey: string;
  let prompt: string;
  
  try {
    apiKey = await getStorageValue(
      STORAGE_KEYS.OPENROUTER_API_KEY,
      DEFAULT_VALUES[STORAGE_KEYS.OPENROUTER_API_KEY]
    );
    
    if (!apiKey) {
      console.warn('[OpenRouter] No API key set – skipping remote analysis');
      return null;
    }

    prompt = await getStorageValue(
      STORAGE_KEYS.SYSTEM_PROMPT,
      DEFAULT_VALUES[STORAGE_KEYS.SYSTEM_PROMPT]
    );
  } catch (storageError) {
    console.warn('[OpenRouter] Extension context invalidated, skipping analysis');
    return null;
  }

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

  // Try with Groq provider first
  const groqBody: Record<string, unknown> = {
    model: 'meta-llama/llama-4-maverick',
    temperature: 0.1,
    max_tokens: 1000,
    messages,
    response_format: { type: 'json_object' },
    provider: 'groq'
  };

  const startTime = performance.now();

  try {
    console.log('[OpenRouter] Sending request with', tweets.length, 'tweets via Groq provider');
    
    const res = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'SlopBlock Extension'
      },
      body: JSON.stringify(groqBody)
    });

    const responseTime = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const errorText = await res.text();
      console.warn('[OpenRouter] Groq provider failed (HTTP', res.status, '), attempting fallback:', errorText);
      
      // Fallback: Retry without provider constraint
      return await analyzeTweetsWithFallback(tweets, messages, apiKey, responseTime);
    }

    const responseText = await res.text();
    
    // Log successful Groq routing with performance metrics
    console.log(`[OpenRouter] ✅ Groq provider success (${responseTime}ms) - Response length:`, responseText.length);
    
    if (!responseText.trim()) {
      console.error('[OpenRouter] Empty response from Groq provider');
      return await analyzeTweetsWithFallback(tweets, messages, apiKey, responseTime);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[OpenRouter] Failed to parse Groq response JSON:', parseError);
      return await analyzeTweetsWithFallback(tweets, messages, apiKey, responseTime);
    }

    // Log provider information from response headers
    const provider = res.headers.get('x-or-provider') || 'unknown';
    const model = res.headers.get('x-or-model') || 'unknown';
    console.log(`[OpenRouter] Provider confirmed: ${provider}, Model: ${model}, Response time: ${responseTime}ms`);

    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) {
      console.error('[OpenRouter] No content in Groq response data:', data);
      return await analyzeTweetsWithFallback(tweets, messages, apiKey, responseTime);
    }

    console.log('[OpenRouter] Groq AI response content:', raw);
    
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (contentParseError) {
      console.error('[OpenRouter] Failed to parse Groq AI response JSON:', contentParseError);
      return await analyzeTweetsWithFallback(tweets, messages, apiKey, responseTime);
    }
    
    console.log(`[OpenRouter] ✅ Groq analysis complete (${responseTime}ms):`, parsed);
    return parsed.results || parsed;
  } catch (err) {
    const responseTime = Math.round(performance.now() - startTime);
    console.warn('[OpenRouter] Groq provider network error, attempting fallback:', err);
    return await analyzeTweetsWithFallback(tweets, messages, apiKey, responseTime);
  }
}

// Fallback function for when Groq provider fails
async function analyzeTweetsWithFallback(
  tweets: string[],
  messages: any[],
  apiKey: string,
  groqAttemptTime: number
): Promise<LLMAnalysisResult[] | null> {
  console.log('[OpenRouter] 🔄 Falling back to standard provider routing');
  
  const fallbackBody: Record<string, unknown> = {
    model: 'meta-llama/llama-4-maverick',
    temperature: 0.1,
    max_tokens: 1000,
    messages,
    response_format: { type: 'json_object' }
    // No provider specified - let OpenRouter choose
  };

  const fallbackStartTime = performance.now();

  try {
    const res = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'SlopBlock Extension'
      },
      body: JSON.stringify(fallbackBody)
    });

    const fallbackResponseTime = Math.round(performance.now() - fallbackStartTime);

    if (!res.ok) {
      const errorText = await res.text();
      console.error('[OpenRouter] Fallback also failed (HTTP', res.status, '):', errorText);
      return null;
    }

    const responseText = await res.text();
    
    // Log successful fallback with performance comparison
    console.log(`[OpenRouter] ✅ Fallback provider success (${fallbackResponseTime}ms vs ${groqAttemptTime}ms Groq attempt)`);
    
    if (!responseText.trim()) {
      console.error('[OpenRouter] Empty response from fallback provider');
      return null;
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[OpenRouter] Failed to parse fallback response JSON:', parseError);
      return null;
    }

    // Log fallback provider information
    const provider = res.headers.get('x-or-provider') || 'unknown';
    const model = res.headers.get('x-or-model') || 'unknown';
    console.log(`[OpenRouter] Fallback provider: ${provider}, Model: ${model}, Response time: ${fallbackResponseTime}ms`);

    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) {
      console.error('[OpenRouter] No content in fallback response data:', data);
      return null;
    }

    console.log('[OpenRouter] Fallback AI response content:', raw);
    
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (contentParseError) {
      console.error('[OpenRouter] Failed to parse fallback AI response JSON:', contentParseError);
      return null;
    }
    
    console.log(`[OpenRouter] ✅ Fallback analysis complete (${fallbackResponseTime}ms):`, parsed);
    return parsed.results || parsed;
  } catch (err) {
    const fallbackResponseTime = Math.round(performance.now() - fallbackStartTime);
    console.error(`[OpenRouter] Fallback network error after ${fallbackResponseTime}ms:`, err);
    return null;
  }
} 