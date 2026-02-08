const form = document.getElementById('translate-form');
const textArea = document.getElementById('input-text');
const submitButton = document.getElementById('submit-button');

const progressPanel = document.getElementById('progress-panel');
const stageLabel = document.getElementById('stage-label');
const progressPercent = document.getElementById('progress-percent');
const progressFill = document.getElementById('progress-fill');
const chunkCounter = document.getElementById('chunk-counter');
const etaLabel = document.getElementById('eta-label');

const statusMessage = document.getElementById('status-message');
const resultOutput = document.getElementById('result-output');

const STAGE_LABELS = {
  splitting: 'разбивка текста',
  translating: 'перевод',
  editing: 'литредактура',
  assembling: 'сборка результата',
  completed: 'готово'
};

let pollingTimer;

function setBusy(isBusy) {
  submitButton.disabled = isBusy;
}

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.style.color = isError ? '#b91c1c' : '#1f2937';
}

function formatEta(etaSeconds) {
  if (!Number.isFinite(etaSeconds) || etaSeconds < 0) {
    return '—';
  }

  if (etaSeconds < 60) {
    return `~${Math.ceil(etaSeconds)} сек`;
  }

  const minutes = Math.floor(etaSeconds / 60);
  const seconds = Math.ceil(etaSeconds % 60);
  return `~${minutes} мин ${seconds} сек`;
}

function renderProgress(progress) {
  progressPanel.hidden = false;

  const stage = STAGE_LABELS[progress.currentStage] || progress.currentStage || '—';
  stageLabel.textContent = stage;

  const percent = Math.max(0, Math.min(100, progress.percent || 0));
  progressPercent.textContent = `${Math.round(percent)}%`;
  progressFill.style.width = `${percent}%`;

  const currentChunk = progress.currentChunk || 0;
  const totalChunks = progress.totalChunks || 0;
  chunkCounter.textContent = `${currentChunk}/${totalChunks}`;
  etaLabel.textContent = formatEta(progress.etaSeconds);
}

function stopPolling() {
  if (pollingTimer) {
    clearTimeout(pollingTimer);
    pollingTimer = undefined;
  }
}

async function pollJob(jobId) {
  try {
    const response = await fetch(`/api/jobs/${jobId}`);
    if (!response.ok) {
      throw new Error(`Не удалось получить статус: ${response.status}`);
    }

    const payload = await response.json();
    renderProgress(payload.progress);

    if (payload.status === 'completed') {
      setBusy(false);
      setStatus('Обработка завершена.');
      resultOutput.hidden = false;
      resultOutput.textContent = payload.result;
      stopPolling();
      return;
    }

    if (payload.status === 'failed') {
      setBusy(false);
      setStatus(payload.error || 'Обработка завершилась с ошибкой.', true);
      stopPolling();
      return;
    }

    const stage = STAGE_LABELS[payload.progress.currentStage] || payload.progress.currentStage;
    setStatus(`Выполняется этап: ${stage}`);
    pollingTimer = setTimeout(() => pollJob(jobId), 1000);
  } catch (error) {
    setBusy(false);
    setStatus(error.message, true);
    stopPolling();
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const text = textArea.value.trim();
  if (!text) {
    setStatus('Введите текст перед запуском.', true);
    return;
  }

  stopPolling();
  setBusy(true);
  resultOutput.hidden = true;
  resultOutput.textContent = '';
  progressPanel.hidden = false;
  renderProgress({ currentStage: 'splitting', percent: 0, currentChunk: 0, totalChunks: 0, etaSeconds: null });
  setStatus('Запускаем задачу...');

  try {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      throw new Error(`Не удалось запустить задачу: ${response.status}`);
    }

    const payload = await response.json();
    renderProgress(payload.progress);
    setStatus('Задача запущена, получаем обновления...');
    pollJob(payload.jobId);
  } catch (error) {
    setBusy(false);
    setStatus(error.message, true);
  }
});
