import pg from 'pg';
import fs from 'fs';

const { Pool } = pg;
const envContent = fs.readFileSync('.env', 'utf-8');
const match = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)/);
const pool = new Pool({ connectionString: match[1], ssl: { rejectUnauthorized: false } });

await pool.query('DROP TABLE IF EXISTS message_queue CASCADE');
await pool.query(`
  CREATE TABLE IF NOT EXISTS message_queue (
    id SERIAL PRIMARY KEY,
    conversation_id TEXT REFERENCES communication_conversations(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_name TEXT DEFAULT '',
    subject TEXT DEFAULT '',
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 5,
    last_error TEXT,
    next_retry_at TIMESTAMP,
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);
await pool.query('CREATE INDEX IF NOT EXISTS idx_message_queue_conversation_id ON message_queue(conversation_id)');
await pool.query('CREATE INDEX IF NOT EXISTS idx_message_queue_status ON message_queue(status)');
await pool.query('CREATE INDEX IF NOT EXISTS idx_message_queue_next_retry_at ON message_queue(next_retry_at)');

console.log('✓ Successfully recreated message_queue with authoritative schema and indexes!');
await pool.end();
