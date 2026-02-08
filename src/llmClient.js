const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_BASE_BACKOFF_MS = 500;
const DEFAULT_MAX_BACKOFF_MS = 10_000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(retryAfterHeader) {
  if (!retryAfterHeader) {
    return null;
  }

  const seconds = Number(retryAfterHeader);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }

  const parsedDate = Date.parse(retryAfterHeader);
  if (!Number.isNaN(parsedDate)) {
    const delta = parsedDate - Date.now();
    return delta > 0 ? delta : 0;
  }

  return null;
}

function computeBackoffWithJitter(attempt, baseBackoffMs, maxBackoffMs) {
  const exponential = Math.min(maxBackoffMs, baseBackoffMs * 2 ** (attempt - 1));
  const jitter = Math.floor(Math.random() * Math.min(1_000, exponential * 0.3));
  return exponential + jitter;
}

function isRetriableResponse(status) {
  return status === 429 || status >= 500;
}

function isRetriableError(error) {
  if (!error) {
    return false;
  }

  if (error.name === 'AbortError') {
    return true;
  }

  // Typical fetch/network errors.
  return error instanceof TypeError;
}

function safeLog(logger, level, payload) {
  const fn = logger?.[level];
  if (typeof fn === 'function') {
    fn(payload);
  }
}

function getRequestId(response) {
  return (
    response.headers.get('x-request-id') ||
    response.headers.get('request-id') ||
    response.headers.get('x-amzn-requestid') ||
    (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `req_${Date.now()}_${Math.random().toString(16).slice(2)}`)
  );
}

/**
 * Performs a POST request to the LLM provider with timeout, retries and safe operational logging.
 */
export async function requestLlm({
  url,
  apiKey,
  payload,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxRetries = DEFAULT_MAX_RETRIES,
  baseBackoffMs = DEFAULT_BASE_BACKOFF_MS,
  maxBackoffMs = DEFAULT_MAX_BACKOFF_MS,
  fetchImpl = fetch,
  logger = console,
}) {
  if (!url) {
    throw new Error('requestLlm: url is required');
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error('requestLlm: payload must be an object');
  }

  const requestBody = JSON.stringify(payload);
  const inputBytes = Buffer.byteLength(requestBody, 'utf8');

  let lastError;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
        },
        body: requestBody,
        signal: controller.signal,
      });

      const requestId = getRequestId(response);
      const responseText = await response.text();
      const outputBytes = Buffer.byteLength(responseText, 'utf8');
      const durationMs = Date.now() - startedAt;

      safeLog(logger, response.ok ? 'info' : 'warn', {
        event: 'llm_request',
        attempt,
        request_id: requestId,
        status: response.status,
        duration_ms: durationMs,
        input_bytes: inputBytes,
        output_bytes: outputBytes,
      });

      if (response.ok) {
        return {
          requestId,
          status: response.status,
          durationMs,
          bodyText: responseText,
        };
      }

      if (!isRetriableResponse(response.status) || attempt > maxRetries) {
        const error = new Error(`LLM request failed with status ${response.status}`);
        error.status = response.status;
        error.requestId = requestId;
        error.responseBody = responseText;
        throw error;
      }

      const retryAfterHeader = response.headers.get('retry-after');
      const retryAfterMs = parseRetryAfterMs(retryAfterHeader);
      const delayMs = retryAfterMs ?? computeBackoffWithJitter(attempt, baseBackoffMs, maxBackoffMs);

      safeLog(logger, 'warn', {
        event: 'llm_retry_scheduled',
        attempt,
        request_id: requestId,
        status: response.status,
        retry_in_ms: delayMs,
      });

      await sleep(delayMs);
    } catch (error) {
      const durationMs = Date.now() - startedAt;

      safeLog(logger, 'warn', {
        event: 'llm_request_error',
        attempt,
        request_id: error?.requestId,
        status: error?.status,
        duration_ms: durationMs,
        input_bytes: inputBytes,
        output_bytes: 0,
        error_name: error?.name,
        error_message: error?.message,
      });

      if (!isRetriableError(error) || attempt > maxRetries) {
        throw error;
      }

      lastError = error;
      const delayMs = computeBackoffWithJitter(attempt, baseBackoffMs, maxBackoffMs);
      await sleep(delayMs);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError ?? new Error('LLM request failed after retries');
}

export const llmClient = {
  requestLlm,
};
