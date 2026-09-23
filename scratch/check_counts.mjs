import pg from 'pg';
import fs from 'fs';

const { Pool } = pg;
const envContent = fs.readFileSync('.env', 'utf-8');
const match = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)/);

const pool = new Pool({
  connectionString: match[1],
  ssl: { rejectUnauthorized: false }
});

const client = await pool.connect();
for (const table of ['products', 'plans', 'licenses', '_migrations', 'portal_users', 'system_settings']) {
  try {
    const res = await client.query(`SELECT COUNT(*) FROM ${table}`);
    console.log(`${table}: ${res.rows[0].count} rows`);
  } catch (e) {
    console.log(`${table}: ERROR - ${e.message}`);
  }
}
client.release();
await pool.end();
