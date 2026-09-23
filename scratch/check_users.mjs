import pg from 'pg';
import fs from 'fs';

const { Pool } = pg;
const envContent = fs.readFileSync('.env', 'utf-8');
const match = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)/);
const pool = new Pool({ connectionString: match[1], ssl: { rejectUnauthorized: false } });

try {
  const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('users', 'portal_users')");
  console.log('User tables found:', res.rows.map(r => r.table_name));

  for (const row of res.rows) {
    const c = await pool.query(`SELECT COUNT(*) FROM ${row.table_name}`);
    console.log(`${row.table_name} count:`, c.rows[0].count);
    if (row.table_name === 'users') {
      const users = await pool.query('SELECT id, email, name, role FROM users LIMIT 10');
      console.log('users rows:', users.rows);
    }
    if (row.table_name === 'portal_users') {
      const pusers = await pool.query('SELECT _id, data->>\'email\' as email, data->>\'role\' as role, data->>\'name\' as name FROM portal_users LIMIT 10');
      console.log('portal_users rows:', pusers.rows);
    }
  }
} catch (e) {
  console.error('Error:', e);
} finally {
  await pool.end();
}
