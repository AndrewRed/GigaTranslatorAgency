import { requestLlm } from './llmClient.js';

/**
 * Translates a single chunk using an LLM endpoint.
 */
export async function translateChunk({
  chunk,
  sourceLang,
  targetLang,
  endpoint,
  apiKey,
  model,
  timeoutMs,
  maxRetries,
  logger,
}) {
  if (!chunk || typeof chunk !== 'string') {
    throw new Error('translateChunk: chunk must be a non-empty string');
  }

  const payload = {
    model,
    messages: [
      {
        role: 'system',
        content: 'You are a professional translator. Keep meaning and style accurate.',
      },
      {
        role: 'user',
        content: `Translate from ${sourceLang} to ${targetLang}:\n\n${chunk}`,
      },
    ],
    temperature: 0.2,
  };

  const response = await requestLlm({
    url: endpoint,
    apiKey,
    payload,
    timeoutMs,
    maxRetries,
    logger,
  });

  let parsed;
  try {
    parsed = JSON.parse(response.bodyText);
  } catch {
    throw new Error('translateChunk: LLM returned invalid JSON');
  }

  const translatedText = parsed?.choices?.[0]?.message?.content?.trim();
  if (!translatedText) {
    throw new Error('translateChunk: LLM response does not contain translated text');
  }

  return {
    requestId: response.requestId,
    text: translatedText,
  };
}
