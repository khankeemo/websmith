import pg from 'pg';
import fs from 'fs';

const { Pool } = pg;
const envContent = fs.readFileSync('.env', 'utf-8');
const match = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)/);
const pool = new Pool({ connectionString: match[1], ssl: { rejectUnauthorized: false } });

const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'message_queue'");
console.log('message_queue columns:', res.rows.map(r => r.column_name));
await pool.end();
