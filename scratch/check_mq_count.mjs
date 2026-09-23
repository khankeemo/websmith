import pg from 'pg';
import fs from 'fs';

const { Pool } = pg;
const envContent = fs.readFileSync('.env', 'utf-8');
const match = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)/);
const pool = new Pool({ connectionString: match[1], ssl: { rejectUnauthorized: false } });

const res = await pool.query('SELECT COUNT(*) FROM message_queue');
console.log('message_queue row count:', res.rows[0].count);
await pool.end();
