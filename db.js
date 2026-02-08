import pg from 'pg';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/giga_translator';

export const pool = new Pool({ connectionString });

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS translation_jobs (
      id UUID PRIMARY KEY,
      status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'failed', 'done')),
      source_text TEXT NOT NULL,
      target_lang TEXT NOT NULL,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS translation_chunks (
      id UUID PRIMARY KEY,
      job_id UUID NOT NULL REFERENCES translation_jobs(id) ON DELETE CASCADE,
      chunk_index INT NOT NULL,
      source_text TEXT NOT NULL,
      translated_text TEXT,
      status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'failed', 'done')),
      attempts INT NOT NULL DEFAULT 0,
      max_attempts INT NOT NULL DEFAULT 3,
      last_error TEXT,
      started_at TIMESTAMPTZ,
      finished_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (job_id, chunk_index)
    )
  `);
}

export async function withTx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
