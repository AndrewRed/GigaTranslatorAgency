import { v4 as uuidv4 } from 'uuid';
import { pool, withTx } from './db.js';
import { enqueueChunk, publishJobEvent } from './queue.js';

const WORKER_STALE_SECONDS = Number(process.env.WORKER_STALE_SECONDS || 30);

function splitIntoChunks(text, chunkSize = 240) {
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }

  return chunks.length ? chunks : [''];
}

export async function createJob({ text, targetLang, chunkSize }) {
  const id = uuidv4();
  const chunks = splitIntoChunks(text, chunkSize);

  await withTx(async (client) => {
    await client.query(
      `INSERT INTO translation_jobs(id, status, source_text, target_lang) VALUES ($1, 'queued', $2, $3)`,
      [id, text, targetLang],
    );

    for (const [index, chunkText] of chunks.entries()) {
      await client.query(
        `INSERT INTO translation_chunks(id, job_id, chunk_index, source_text, status)
         VALUES ($1, $2, $3, $4, 'queued')`,
        [uuidv4(), id, index, chunkText],
      );
    }
  });

  const { rows } = await pool.query(`SELECT id FROM translation_chunks WHERE job_id = $1 ORDER BY chunk_index`, [id]);
  await Promise.all(rows.map((row) => enqueueChunk(row.id)));
  await publishJobEvent(id, { type: 'job_created', status: 'queued' });

  return id;
}

export async function getJob(jobId) {
  const { rows } = await pool.query(
    `SELECT
      j.id,
      j.status,
      j.error,
      j.created_at,
      j.updated_at,
      COUNT(c.id)::INT AS total_chunks,
      COUNT(*) FILTER (WHERE c.status = 'done')::INT AS completed_chunks,
      COUNT(*) FILTER (WHERE c.status = 'failed')::INT AS failed_chunks
    FROM translation_jobs j
    LEFT JOIN translation_chunks c ON c.job_id = j.id
    WHERE j.id = $1
    GROUP BY j.id`,
    [jobId],
  );

  if (!rows[0]) {
    return null;
  }

  return rows[0];
}

export async function getJobResult(jobId) {
  const { rows: jobRows } = await pool.query(`SELECT id, status, error FROM translation_jobs WHERE id = $1`, [jobId]);
  if (!jobRows[0]) {
    return null;
  }

  if (jobRows[0].status !== 'done') {
    return { job: jobRows[0], text: null };
  }

  const { rows: chunks } = await pool.query(
    `SELECT translated_text FROM translation_chunks WHERE job_id = $1 ORDER BY chunk_index`,
    [jobId],
  );

  return {
    job: jobRows[0],
    text: chunks.map((chunk) => chunk.translated_text || '').join(''),
  };
}

export async function recalculateJobStatus(jobId) {
  const { rows } = await pool.query(
    `SELECT
      COUNT(*)::INT AS total,
      COUNT(*) FILTER (WHERE status = 'done')::INT AS done,
      COUNT(*) FILTER (WHERE status = 'failed' AND attempts >= max_attempts)::INT AS permanently_failed,
      COUNT(*) FILTER (WHERE status IN ('queued', 'running'))::INT AS active
    FROM translation_chunks
    WHERE job_id = $1`,
    [jobId],
  );

  const stats = rows[0];
  let status = 'queued';
  let error = null;

  if (stats.permanently_failed > 0) {
    status = 'failed';
    error = 'One or more chunks exceeded retry limit';
  } else if (stats.done === stats.total) {
    status = 'done';
  } else if (stats.active > 0) {
    status = 'running';
  }

  await pool.query(
    `UPDATE translation_jobs
     SET status = $2, error = $3, updated_at = NOW()
     WHERE id = $1`,
    [jobId, status, error],
  );

  await publishJobEvent(jobId, { type: 'job_status', status, error, ...stats });
}

export async function recoverStaleChunks() {
  const { rows } = await pool.query(
    `UPDATE translation_chunks
     SET status = 'queued', started_at = NULL, updated_at = NOW(), last_error = 'Recovered after worker interruption'
     WHERE status = 'running'
       AND started_at < NOW() - ($1::TEXT || ' seconds')::INTERVAL
     RETURNING id, job_id`,
    [WORKER_STALE_SECONDS],
  );

  for (const row of rows) {
    await enqueueChunk(row.id);
    await recalculateJobStatus(row.job_id);
  }

  return rows.length;
}
