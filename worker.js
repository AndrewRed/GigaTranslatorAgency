import { initDb, pool } from './db.js';
import { dequeueChunk, enqueueChunk, publishJobEvent } from './queue.js';
import { recalculateJobStatus, recoverStaleChunks } from './jobService.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function translateChunk(sourceText, targetLang) {
  await sleep(250);
  if (sourceText.includes('[fail-once]')) {
    return sourceText.replace('[fail-once]', '').toUpperCase() + ` [${targetLang}]`;
  }

  return sourceText.toUpperCase() + ` [${targetLang}]`;
}

async function processChunk(chunkId) {
  const { rows } = await pool.query(
    `SELECT c.id, c.job_id, c.source_text, c.attempts, c.max_attempts, c.status, j.target_lang
     FROM translation_chunks c
     JOIN translation_jobs j ON j.id = c.job_id
     WHERE c.id = $1`,
    [chunkId],
  );

  const chunk = rows[0];
  if (!chunk || chunk.status === 'done') {
    return;
  }

  await pool.query(
    `UPDATE translation_chunks
      SET status = 'running', attempts = attempts + 1, started_at = NOW(), updated_at = NOW()
      WHERE id = $1`,
    [chunkId],
  );
  await recalculateJobStatus(chunk.job_id);

  try {
    if (chunk.source_text.includes('[fail-once]') && chunk.attempts === 0) {
      throw new Error('Injected chunk failure for retry validation');
    }

    const translated = await translateChunk(chunk.source_text, chunk.target_lang);
    await pool.query(
      `UPDATE translation_chunks
       SET status = 'done', translated_text = $2, finished_at = NOW(), updated_at = NOW(), last_error = NULL
       WHERE id = $1`,
      [chunkId, translated],
    );
    await publishJobEvent(chunk.job_id, { type: 'chunk_done', chunkId });
  } catch (error) {
    const { rows: freshRows } = await pool.query(
      `UPDATE translation_chunks
       SET status = 'failed', last_error = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING attempts, max_attempts, job_id`,
      [chunkId, error.message],
    );

    const fresh = freshRows[0];
    if (fresh.attempts < fresh.max_attempts) {
      await pool.query(`UPDATE translation_chunks SET status = 'queued', updated_at = NOW() WHERE id = $1`, [chunkId]);
      await enqueueChunk(chunkId);
      await publishJobEvent(chunk.job_id, { type: 'chunk_retry', chunkId, attempts: fresh.attempts });
    } else {
      await publishJobEvent(chunk.job_id, { type: 'chunk_failed', chunkId, attempts: fresh.attempts });
    }
  }

  await recalculateJobStatus(chunk.job_id);
}

async function run() {
  await initDb();
  await recoverStaleChunks();
  console.log('Worker started');

  while (true) {
    const chunkId = await dequeueChunk(5);
    if (!chunkId) {
      continue;
    }

    await processChunk(chunkId);
  }
}

run().catch((error) => {
  console.error('Worker crashed', error);
  process.exit(1);
});
