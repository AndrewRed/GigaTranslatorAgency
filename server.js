const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const jobs = new Map();

const STAGE_WEIGHTS = {
  splitting: 10,
  translating: 60,
  editing: 20,
  assembling: 10,
  completed: 100
};

function estimateEta(progress) {
  const chunkDurationSeconds = 1.2;
  const remainingChunks = Math.max(0, progress.totalChunks - progress.currentChunk);
  let remainingStageTime = 0;

  if (progress.currentStage === 'splitting') {
    remainingStageTime = 2;
  } else if (progress.currentStage === 'editing') {
    remainingStageTime = 2;
  } else if (progress.currentStage === 'assembling') {
    remainingStageTime = 1;
  }

  return Number((remainingChunks * chunkDurationSeconds + remainingStageTime).toFixed(1));
}

function buildProgress(job, stage) {
  const translatedRatio = job.totalChunks === 0 ? 0 : job.currentChunk / job.totalChunks;
  const translatedWeight = STAGE_WEIGHTS.translating;
  let percent;

  switch (stage) {
    case 'splitting':
      percent = 5;
      break;
    case 'translating':
      percent = STAGE_WEIGHTS.splitting + translatedRatio * translatedWeight;
      break;
    case 'editing':
      percent = STAGE_WEIGHTS.splitting + translatedWeight + 10;
      break;
    case 'assembling':
      percent = 95;
      break;
    case 'completed':
      percent = 100;
      break;
    default:
      percent = 0;
  }

  return {
    currentStage: stage,
    currentChunk: job.currentChunk,
    totalChunks: job.totalChunks,
    percent: Number(percent.toFixed(1)),
    etaSeconds: stage === 'completed' ? 0 : estimateEta({ ...job, currentStage: stage })
  };
}

function splitToChunks(text, maxLen = 250) {
  const words = text.split(/\s+/);
  const chunks = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxLen) {
      current = next;
      continue;
    }

    if (current) {
      chunks.push(current);
    }
    current = word;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function processJob(jobId) {
  const job = jobs.get(jobId);
  if (!job) {
    return;
  }

  try {
    job.status = 'processing';
    job.progress = buildProgress(job, 'splitting');
    await wait(700);

    const chunks = splitToChunks(job.inputText);
    job.totalChunks = chunks.length;
    job.progress = buildProgress(job, 'translating');

    const translatedChunks = [];
    for (let index = 0; index < chunks.length; index += 1) {
      await wait(900);
      const chunk = chunks[index];
      translatedChunks.push(`[Translated #${index + 1}] ${chunk}`);
      job.currentChunk = index + 1;
      job.progress = buildProgress(job, 'translating');
    }

    job.progress = buildProgress(job, 'editing');
    await wait(900);
    const edited = translatedChunks.map((chunk) => `${chunk} (edited)`);

    job.progress = buildProgress(job, 'assembling');
    await wait(500);

    job.result = edited.join('\n\n');
    job.status = 'completed';
    job.progress = buildProgress(job, 'completed');
  } catch (error) {
    job.status = 'failed';
    job.error = error.message || 'Неизвестная ошибка обработки.';
  }
}

app.post('/api/translate', (req, res) => {
  const text = req.body?.text;
  if (!text || typeof text !== 'string') {
    res.status(400).json({ error: 'Поле text обязательно.' });
    return;
  }

  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const job = {
    id: jobId,
    status: 'queued',
    inputText: text,
    result: null,
    error: null,
    currentChunk: 0,
    totalChunks: 0,
    progress: {
      currentStage: 'splitting',
      currentChunk: 0,
      totalChunks: 0,
      percent: 0,
      etaSeconds: null
    }
  };

  jobs.set(jobId, job);
  processJob(jobId);

  res.status(202).json({
    jobId,
    status: job.status,
    progress: job.progress
  });
});

app.get('/api/jobs/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: 'Задача не найдена.' });
    return;
  }

  res.json({
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    result: job.status === 'completed' ? job.result : null,
    error: job.error
  });
});

app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});
