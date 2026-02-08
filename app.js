const form = document.getElementById('translatorForm');
const modeInputs = Array.from(document.querySelectorAll('input[name="mode"]'));
const advancedAccordion = document.getElementById('advancedAccordion');
const resultOutput = document.getElementById('resultOutput');

const sourceText = document.getElementById('sourceText');
const apiKey = document.getElementById('apiKey');
const baseUrl = document.getElementById('baseUrl');
const model = document.getElementById('model');

const sourceTextError = document.getElementById('sourceTextError');
const apiKeyError = document.getElementById('apiKeyError');
const baseUrlError = document.getElementById('baseUrlError');
const modelError = document.getElementById('modelError');

const DEFAULTS = {
  baseUrl: 'https://gigachat.devices.sberbank.ru/api/v1',
  model: 'GigaChat'
};

function getMode() {
  return modeInputs.find((input) => input.checked)?.value ?? 'quick';
}

function clearErrors() {
  sourceTextError.textContent = '';
  apiKeyError.textContent = '';
  baseUrlError.textContent = '';
  modelError.textContent = '';
}

function validateForm() {
  clearErrors();
  const mode = getMode();
  let isValid = true;

  const text = sourceText.value.trim();
  if (text.length < 2 || text.length > 5000) {
    sourceTextError.textContent = 'Введите от 2 до 5000 символов.';
    isValid = false;
  }

  if (mode === 'advanced') {
    if (!apiKey.value.trim()) {
      apiKeyError.textContent = 'Укажите API ключ для расширенного режима.';
      isValid = false;
    }

    try {
      const parsedUrl = new URL(baseUrl.value.trim() || DEFAULTS.baseUrl);
      if (!['https:', 'http:'].includes(parsedUrl.protocol)) {
        throw new Error('Unsupported protocol');
      }
    } catch {
      baseUrlError.textContent = 'Введите корректный URL, например https://example.com/api.';
      isValid = false;
    }

    const modelValue = model.value.trim() || DEFAULTS.model;
    if (!/^[a-zA-Z0-9_.:-]{2,50}$/.test(modelValue)) {
      modelError.textContent = 'Имя модели: 2-50 символов (буквы, цифры, _ . : -).';
      isValid = false;
    }
  }

  return isValid;
}

function syncUiByMode() {
  const mode = getMode();
  if (mode === 'advanced') {
    advancedAccordion.open = true;
  } else {
    advancedAccordion.open = false;
    apiKeyError.textContent = '';
    baseUrlError.textContent = '';
    modelError.textContent = '';
  }
}

modeInputs.forEach((input) => input.addEventListener('change', syncUiByMode));

form.addEventListener('submit', (event) => {
  event.preventDefault();

  if (!validateForm()) {
    return;
  }

  const mode = getMode();
  const payload = {
    mode,
    sourceText: sourceText.value.trim(),
    baseUrl: (baseUrl.value || DEFAULTS.baseUrl).trim(),
    model: (model.value || DEFAULTS.model).trim(),
    apiKey: mode === 'advanced' ? apiKey.value.trim() : '<not-required>'
  };

  resultOutput.textContent = `Форма валидна. Готово к отправке:\n\n${JSON.stringify(payload, null, 2)}`;
});

syncUiByMode();
