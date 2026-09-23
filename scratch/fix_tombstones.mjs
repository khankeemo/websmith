import pg from 'pg';
import fs from 'fs';

const { Pool } = pg;
const envContent = fs.readFileSync('.env', 'utf-8');
const match = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)/);
const pool = new Pool({ connectionString: match[1], ssl: { rejectUnauthorized: false } });

await pool.query('DROP TABLE IF EXISTS conversation_delete_tombstones CASCADE');
await pool.query(`
  CREATE TABLE IF NOT EXISTS conversation_delete_tombstones (
    provider_message_id TEXT NOT NULL,
    sender_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    mailbox_id TEXT,
    deleted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (provider_message_id, sender_email, subject)
  )
`);
await pool.query('CREATE INDEX IF NOT EXISTS idx_tombstones_provider_message_id ON conversation_delete_tombstones(provider_message_id)');
await pool.query('CREATE INDEX IF NOT EXISTS idx_tombstones_mailbox_id ON conversation_delete_tombstones(mailbox_id)');
console.log('✓ Successfully recreated conversation_delete_tombstones with correct schema and indexes!');
await pool.end();
