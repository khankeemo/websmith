import pg from 'pg';
import fs from 'fs';

const { Pool } = pg;
const envContent = fs.readFileSync('.env', 'utf-8');
const match = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)/);
if (!match) {
  console.error('No DATABASE_URL found in .env');
  process.exit(1);
}

const pool = new Pool({
  connectionString: match[1],
  ssl: { rejectUnauthorized: false }
});

try {
  const client = await pool.connect();
  console.log('Successfully connected to Neon PostgreSQL!');
  const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
  console.log(`Found ${res.rows.length} tables:`);
  console.log(res.rows.map(r => r.table_name));
  client.release();
} catch (err) {
  console.error('Connection/Query error:', err);
} finally {
  await pool.end();
}
