const inputEl = document.getElementById('input');
const outputEl = document.getElementById('output');
const statusEl = document.getElementById('status');
const translateBtn = document.getElementById('translateBtn');
const troubleshootingEl = document.getElementById('troubleshooting');
const retryBtn = document.getElementById('retryBtn');
const checkKeyBtn = document.getElementById('checkKeyBtn');
const reduceTextBtn = document.getElementById('reduceTextBtn');

const ERROR_META = {
  NETWORK: {
    message: 'Похоже, нет соединения с сервером. Проверьте интернет и попробуйте снова.',
    ctas: ['retry'],
  },
  TIMEOUT: {
    message: 'Сервис отвечает слишком долго. Обычно помогает повторить запрос.',
    ctas: ['retry', 'reduceText'],
  },
  RATE_LIMIT: {
    message: 'Достигнут лимит запросов. Подождите немного или уменьшите объём текста.',
    ctas: ['retry', 'reduceText'],
  },
  INVALID_KEY: {
    message: 'API key не принят. Проверьте ключ и права доступа.',
    ctas: ['checkKey'],
  },
  PROVIDER_ERROR: {
    message: 'Провайдер перевода временно недоступен. Повторите попытку через минуту.',
    ctas: ['retry'],
  },
  UNKNOWN: {
    message: 'Произошла непредвиденная ошибка. Попробуйте повторить запрос.',
    ctas: ['retry'],
  },
};

let lastPayload = null;

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle('status-error', isError);
}

function setOutput(text = '') {
  outputEl.textContent = text;
}

function toggleTroubleshooting(show, ctaKeys = []) {
  troubleshootingEl.classList.toggle('show', show);
  retryBtn.hidden = !ctaKeys.includes('retry');
  checkKeyBtn.hidden = !ctaKeys.includes('checkKey');
  reduceTextBtn.hidden = !ctaKeys.includes('reduceText');
}

function classifyError(payload) {
  if (!payload) {
    return ERROR_META.UNKNOWN;
  }

  const normalizedCode = (payload.errorCode || payload.type || '').toUpperCase();

  if (normalizedCode in ERROR_META) {
    return ERROR_META[normalizedCode];
  }

  return ERROR_META.UNKNOWN;
}

async function performTranslate(payload) {
  setStatus('Переводим...');
  toggleTroubleshooting(false);

  try {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const meta = classifyError(data);
      const hintSuffix = data.hint ? ` ${data.hint}` : '';
      setStatus(`${meta.message}${hintSuffix}`, true);
      toggleTroubleshooting(true, meta.ctas);
      return;
    }

    setStatus('Готово.');
    setOutput(data.translation || '');
  } catch (_err) {
    const meta = ERROR_META.NETWORK;
    setStatus(meta.message, true);
    toggleTroubleshooting(true, meta.ctas);
  }
}

translateBtn.addEventListener('click', async () => {
  const text = inputEl.value.trim();

  if (!text) {
    setStatus('Введите текст для перевода.', true);
    toggleTroubleshooting(false);
    return;
  }

  lastPayload = { text };
  await performTranslate(lastPayload);
});

retryBtn.addEventListener('click', async () => {
  if (lastPayload) {
    await performTranslate(lastPayload);
  }
});

checkKeyBtn.addEventListener('click', () => {
  setStatus('Проверьте API key в настройках сервера: значение, срок действия и права доступа.', false);
});

reduceTextBtn.addEventListener('click', () => {
  const current = inputEl.value.trim();
  if (current.length <= 500) {
    setStatus('Текст уже достаточно короткий. Можно попробовать повторить перевод.', false);
    return;
  }

  inputEl.value = `${current.slice(0, 500)}...`;
  setStatus('Сократили текст до 500 символов. Попробуйте отправить снова.', false);
});
