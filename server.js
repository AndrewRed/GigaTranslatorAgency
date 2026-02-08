import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Redis from 'ioredis';
import { initDb } from './db.js';
import { createJob, getJob, getJobResult, recoverStaleChunks } from './jobService.js';
import { jobEventChannel } from './queue.js';

const app = express();
const port = Number(process.env.PORT || 3000);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/jobs', async (req, res) => {
  try {
    const { text, targetLang, chunkSize } = req.body;
    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: '`text` is required' });
    }
    if (typeof targetLang !== 'string' || !targetLang.trim()) {
      return res.status(400).json({ error: '`targetLang` is required' });
    }

    const id = await createJob({ text, targetLang, chunkSize });
    return res.status(202).json({ id, status: 'queued' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to create job' });
  }
});

app.get('/api/jobs/:id', async (req, res) => {
  const job = await getJob(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  return res.json(job);
});

app.get('/api/jobs/:id/result', async (req, res) => {
  const result = await getJobResult(req.params.id);
  if (!result) {
    return res.status(404).json({ error: 'Job not found' });
  }

  if (result.job.status !== 'done') {
    return res.status(409).json({ error: 'Result is not ready', status: result.job.status });
  }

  return res.json({ id: req.params.id, status: 'done', result: result.text });
});

app.get('/api/jobs/:id/events', async (req, res) => {
  const subscriber = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
  const channel = jobEventChannel(req.params.id);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const onMessage = (incomingChannel, message) => {
    if (incomingChannel === channel) {
      res.write(`data: ${message}\n\n`);
    }
  };

  subscriber.on('message', onMessage);
  await subscriber.subscribe(channel);

  req.on('close', async () => {
    subscriber.off('message', onMessage);
    await subscriber.unsubscribe(channel);
    subscriber.disconnect();
    res.end();
  });
});

initDb()
  .then(async () => {
    await recoverStaleChunks();
    app.listen(port, () => {
      console.log(`API listening on :${port}`);
    });
  })
  .catch((error) => {
    console.error('Unable to start API', error);
    process.exit(1);
  });
