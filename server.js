const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

class AppError extends Error {
  constructor(message, status, errorCode, hint) {
    super(message);
    this.status = status;
    this.errorCode = errorCode;
    this.hint = hint;
  }
}

function mapProviderError(error) {
  if (error.name === 'AbortError') {
    return new AppError('Provider timeout', 504, 'TIMEOUT', 'Попробуйте отправить запрос ещё раз или сократите текст.');
  }

  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return new AppError('Network issue', 503, 'NETWORK', 'Нет связи с провайдером перевода.');
  }

  if (error.status === 429) {
    return new AppError('Rate limit exceeded', 429, 'RATE_LIMIT', 'Подождите 30-60 секунд перед следующим запросом.');
  }

  if (error.status === 401 || error.status === 403) {
    return new AppError('Invalid API key', 401, 'INVALID_KEY', 'Проверьте API key и его права доступа.');
  }

  return new AppError('Provider error', 502, 'PROVIDER_ERROR', 'Временная ошибка на стороне провайдера.');
}

// Демонстрационный переводчик: замените интеграцией с реальным API.
async function translateWithProvider(text) {
  const simulated = process.env.SIMULATE_ERROR;
  if (simulated === 'timeout') {
    const err = new Error('Request timed out');
    err.name = 'AbortError';
    throw err;
  }
  if (simulated === 'network') {
    const err = new Error('No route to host');
    err.code = 'ENOTFOUND';
    throw err;
  }
  if (simulated === 'rate_limit') {
    const err = new Error('Too many requests');
    err.status = 429;
    throw err;
  }
  if (simulated === 'invalid_key') {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }
  if (simulated === 'provider') {
    throw new Error('Provider unavailable');
  }

  return text.split('').reverse().join('');
}

app.post('/api/translate', async (req, res) => {
  const { text } = req.body || {};

  if (!text || typeof text !== 'string') {
    return res.status(400).json({
      error: 'Invalid request payload',
      errorCode: 'BAD_REQUEST',
      hint: 'Поле text обязательно и должно быть строкой.',
    });
  }

  try {
    const translation = await translateWithProvider(text);
    return res.json({ translation });
  } catch (error) {
    const mapped = mapProviderError(error);
    return res.status(mapped.status).json({
      error: mapped.message,
      errorCode: mapped.errorCode,
      hint: mapped.hint,
    });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server started on http://localhost:${PORT}`);
});
