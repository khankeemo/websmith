import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  try {
    const res = await pool.query('SELECT id, email_address, display_name, smtp_host, smtp_port, smtp_username, is_enabled, is_default_sender FROM mailboxes');
    console.log('Mailboxes in DB:', JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error('Error querying mailboxes:', err);
  } finally {
    await pool.end();
  }
}
check();
