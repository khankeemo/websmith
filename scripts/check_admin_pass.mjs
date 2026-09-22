import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  try {
    const res = await pool.query("SELECT _id, data FROM portal_users WHERE data->>'email' = 'digitalwebsmith@gmail.com'");
    if (res.rows.length === 0) {
      console.log('No user found with email digitalwebsmith@gmail.com');
      return;
    }
    const user = res.rows[0].data;
    console.log('User found:', {
      _id: user._id,
      email: user.email,
      role: user.role,
      status: user.status,
      customId: user.customId,
      passwordHash: user.password
    });
    const matches = await bcrypt.compare('Khan@8383', user.password);
    console.log('Does Khan@8383 match password?:', matches);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}
check();
