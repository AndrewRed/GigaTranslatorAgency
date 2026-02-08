const storageKey = 'gta-draft-v1';

const sourceTextEl = document.getElementById('sourceText');
const translatedTextEl = document.getElementById('translatedText');
const sourceLangEl = document.getElementById('sourceLang');
const targetLangEl = document.getElementById('targetLang');
const paragraphPairsEl = document.getElementById('paragraphPairs');
const copyChipEl = document.getElementById('copyChip');

const translateBtn = document.getElementById('translateBtn');
const copyBtn = document.getElementById('copyBtn');
const downloadTxtBtn = document.getElementById('downloadTxtBtn');
const downloadDocxBtn = document.getElementById('downloadDocxBtn');
const retryBtn = document.getElementById('retryBtn');
const clearBtn = document.getElementById('clearBtn');

let lastRequest = null;

function saveDraft() {
  const draft = {
    sourceText: sourceTextEl.value,
    translatedText: translatedTextEl.value,
    sourceLang: sourceLangEl.value,
    targetLang: targetLangEl.value,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(storageKey, JSON.stringify(draft));
}

function loadDraft() {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return;

  try {
    const draft = JSON.parse(raw);
    sourceTextEl.value = draft.sourceText || '';
    translatedTextEl.value = draft.translatedText || '';
    sourceLangEl.value = draft.sourceLang || 'auto';
    targetLangEl.value = draft.targetLang || 'en';
    renderParagraphPairs();
  } catch {
    localStorage.removeItem(storageKey);
  }
}

function splitParagraphs(text) {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function renderParagraphPairs() {
  const left = splitParagraphs(sourceTextEl.value);
  const right = splitParagraphs(translatedTextEl.value);
  const max = Math.max(left.length, right.length);

  paragraphPairsEl.innerHTML = '';

  if (!max) {
    paragraphPairsEl.innerHTML = '<p>Пусто. Добавьте текст и выполните перевод.</p>';
    return;
  }

  for (let i = 0; i < max; i += 1) {
    const row = document.createElement('div');
    row.className = 'row';

    const originalCell = document.createElement('div');
    originalCell.textContent = left[i] || '—';

    const translatedCell = document.createElement('div');
    translatedCell.textContent = right[i] || '—';

    row.append(originalCell, translatedCell);
    paragraphPairsEl.append(row);
  }
}

async function requestTranslation(payload) {
  const response = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('API translation failed');
  }

  const data = await response.json();
  return data.translation || '';
}

function fallbackTranslate(text) {
  return text
    .split('\n')
    .map((line) => line.split('').reverse().join(''))
    .join('\n');
}

async function translateText() {
  const text = sourceTextEl.value.trim();
  if (!text) {
    translatedTextEl.value = '';
    renderParagraphPairs();
    saveDraft();
    return;
  }

  const payload = {
    text,
    sourceLang: sourceLangEl.value,
    targetLang: targetLangEl.value,
  };

  lastRequest = payload;
  translateBtn.disabled = true;
  translateBtn.textContent = 'Переводим...';

  try {
    const translation = await requestTranslation(payload);
    translatedTextEl.value = translation;
  } catch {
    translatedTextEl.value = fallbackTranslate(text);
  } finally {
    translateBtn.disabled = false;
    translateBtn.textContent = 'Перевести';
    renderParagraphPairs();
    saveDraft();
  }
}

async function copyTranslation() {
  const result = translatedTextEl.value.trim();
  if (!result) return;

  await navigator.clipboard.writeText(result);
  copyChipEl.classList.add('visible');
  setTimeout(() => copyChipEl.classList.remove('visible'), 1600);
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportTxt() {
  const body = translatedTextEl.value;
  if (!body) return;
  downloadFile('translation.txt', body, 'text/plain;charset=utf-8');
}

function exportDocx() {
  const body = translatedTextEl.value;
  if (!body) return;

  const pseudoDocx = `<!doctype html><html><head><meta charset="utf-8"></head><body>${body
    .split('\n')
    .map((line) => `<p>${line}</p>`)
    .join('')}</body></html>`;

  downloadFile(
    'translation.docx',
    pseudoDocx,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
}

function clearAll() {
  sourceTextEl.value = '';
  translatedTextEl.value = '';
  lastRequest = null;
  renderParagraphPairs();
  saveDraft();
}

function retryLast() {
  if (!lastRequest) {
    lastRequest = {
      text: sourceTextEl.value.trim(),
      sourceLang: sourceLangEl.value,
      targetLang: targetLangEl.value,
    };
  }

  if (!lastRequest.text) return;

  sourceTextEl.value = lastRequest.text;
  sourceLangEl.value = lastRequest.sourceLang;
  targetLangEl.value = lastRequest.targetLang;
  translateText();
}

[sourceTextEl, translatedTextEl, sourceLangEl, targetLangEl].forEach((el) => {
  el.addEventListener('input', () => {
    renderParagraphPairs();
    saveDraft();
  });
  el.addEventListener('change', saveDraft);
});

translateBtn.addEventListener('click', translateText);
copyBtn.addEventListener('click', copyTranslation);
downloadTxtBtn.addEventListener('click', exportTxt);
downloadDocxBtn.addEventListener('click', exportDocx);
retryBtn.addEventListener('click', retryLast);
clearBtn.addEventListener('click', clearAll);

loadDraft();
renderParagraphPairs();
