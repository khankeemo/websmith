import pg from 'pg';
import fs from 'fs';

const { Pool } = pg;
const envContent = fs.readFileSync('.env', 'utf-8');
const match = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)/);
const pool = new Pool({ connectionString: match[1], ssl: { rejectUnauthorized: false } });

const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%conversation%'");
for (const t of tables.rows) {
  const cols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = '${t.table_name}'`);
  console.log(t.table_name, cols.rows.map(r => r.column_name));
}
await pool.end();
