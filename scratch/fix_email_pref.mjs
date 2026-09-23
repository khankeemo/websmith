import pg from 'pg';
import fs from 'fs';

const { Pool } = pg;
const envContent = fs.readFileSync('.env', 'utf-8');
const match = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)/);
const pool = new Pool({ connectionString: match[1], ssl: { rejectUnauthorized: false } });

await pool.query('DROP TABLE IF EXISTS email_preferences CASCADE');
await pool.query(`
  CREATE TABLE IF NOT EXISTS email_preferences (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    email_hash TEXT NOT NULL UNIQUE,
    token TEXT NOT NULL UNIQUE,
    is_unsubscribed BOOLEAN NOT NULL DEFAULT FALSE,
    unsubscribed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);
await pool.query('CREATE INDEX IF NOT EXISTS idx_email_preferences_email_hash ON email_preferences(email_hash)');
await pool.query('CREATE INDEX IF NOT EXISTS idx_email_preferences_token ON email_preferences(token)');
await pool.query('CREATE INDEX IF NOT EXISTS idx_email_preferences_is_unsubscribed ON email_preferences(is_unsubscribed) WHERE is_unsubscribed = TRUE');

console.log('✓ Successfully fixed email_preferences table and indexes!');
await pool.end();
