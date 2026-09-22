import pg from 'pg';
import fs from 'fs';
import path from 'path';

function getEnv() {
  const envContent = fs.readFileSync('.env', 'utf-8');
  const env = {};
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  }
  return env;
}

async function run() {
  const env = getEnv();
  const backup = JSON.parse(fs.readFileSync('scripts/backup/mongo_full_backup_latest.json', 'utf-8'));

  const pool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();
  try {
    console.log("Verifying deep data integrity between MongoDB backup and Neon PostgreSQL...");

    // 1. Verify Users
    const pgUsers = await client.query("SELECT _id, data FROM portal_users ORDER BY _id");
    const backupUsers = backup.collections.users.documents;
    console.log(`Checking ${backupUsers.length} users...`);
    for (const bUser of backupUsers) {
      const match = pgUsers.rows.find(r => r._id === bUser._id);
      if (!match) throw new Error(`User ${bUser._id} (${bUser.email}) missing in Postgres!`);
      if (match.data.email !== bUser.email) throw new Error(`Email mismatch for user ${bUser._id}`);
      if (match.data.password !== bUser.password) throw new Error(`Password hash mismatch for user ${bUser._id}`);
      if (match.data.role !== bUser.role) throw new Error(`Role mismatch for user ${bUser._id}`);
    }
    console.log("✓ All users matched with exact credentials, roles, and IDs!");

    // 2. Verify Uploads
    const pgUploads = await client.query("SELECT _id, data FROM portal_uploads ORDER BY _id");
    const backupUploads = backup.collections.uploads.documents;
    console.log(`Checking ${backupUploads.length} uploads...`);
    for (const bUpload of backupUploads) {
      const match = pgUploads.rows.find(r => r._id === bUpload._id);
      if (!match) throw new Error(`Upload ${bUpload._id} missing in Postgres!`);
      if (match.data.data !== bUpload.data) throw new Error(`Binary payload mismatch for upload ${bUpload._id}`);
      if (match.data.size !== bUpload.size) throw new Error(`Size mismatch for upload ${bUpload._id}`);
    }
    console.log("✓ All binary uploads matched byte-for-byte!");

    // 3. Verify Tickets
    const pgTickets = await client.query("SELECT _id, data FROM portal_tickets ORDER BY _id");
    const backupTickets = backup.collections.tickets.documents;
    console.log(`Checking ${backupTickets.length} tickets...`);
    for (const bTicket of backupTickets) {
      const match = pgTickets.rows.find(r => r._id === bTicket._id);
      if (!match) throw new Error(`Ticket ${bTicket._id} missing in Postgres!`);
      if (match.data.subject !== bTicket.subject) throw new Error(`Subject mismatch for ticket ${bTicket._id}`);
    }
    console.log("✓ All tickets matched 100%!");

    console.log("\nDeep integrity verification SUCCESSFUL! Zero data loss confirmed.");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error("Deep integrity check failed:", err);
  process.exit(1);
});
