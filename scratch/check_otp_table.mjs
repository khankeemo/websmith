import pg from 'pg';
import fs from 'fs';

const { Pool } = pg;
const envContent = fs.readFileSync('.env', 'utf-8');
const match = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)/);
const pool = new Pool({ connectionString: match[1], ssl: { rejectUnauthorized: false } });

try {
  const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'otp_verifications'");
  console.log('otp_verifications columns:', res.rows.map(r => `${r.column_name} (${r.data_type})`));
  const constraints = await pool.query("SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'otp_verifications'::regclass");
  console.log('constraints:', constraints.rows);
} catch (e) {
  console.error(e);
} finally {
  await pool.end();
}
