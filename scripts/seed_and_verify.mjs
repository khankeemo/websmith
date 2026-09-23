import pg from 'pg';
import fs from 'fs';
import path from 'path';

let envContent = '';
try {
  envContent = fs.readFileSync(path.resolve('.env.local'), 'utf-8');
} catch {
  try {
    envContent = fs.readFileSync(path.resolve('.env'), 'utf-8');
  } catch {}
}

let connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
if (!connectionString && envContent) {
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('DATABASE_URL=') || trimmed.startsWith('NEON_DATABASE_URL=')) {
      connectionString = trimmed.split('=')[1]?.replace(/^["']|["']$/g, '');
      break;
    }
  }
}

const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } });

async function run() {
  const client = await pool.connect();
  try {
    console.log("Connected to database.");

    // Check users
    const clientsInUsers = await client.query(`SELECT data FROM portal_users WHERE data->>'role' = 'client'`);
    console.log("Clients in portal_users:", clientsInUsers.rows.length);
    clientsInUsers.rows.forEach(r => console.log("  - Client:", r.data.name, "published:", r.data.published));

    const devsInUsers = await client.query(`SELECT data FROM portal_users WHERE data->>'role' = 'developer'`);
    console.log("Developers in portal_users:", devsInUsers.rows.length);
    devsInUsers.rows.forEach(r => console.log("  - Developer:", r.data.name, "published:", r.data.published));

    // Check portal_clients table if used
    try {
      const portalClients = await client.query(`SELECT data FROM portal_clients`);
      console.log("Clients in portal_clients table:", portalClients.rows.length);
      portalClients.rows.forEach(r => console.log("  - portal_client:", r.data.name, "published:", r.data.published));
    } catch (e) {
      console.log("Error querying portal_clients:", e.message);
    }

    // Check portal_projects
    const projRes = await client.query(`SELECT data FROM portal_projects`);
    console.log("Projects in portal_projects:", projRes.rows.length);
    let testimonialsCount = 0;
    for (const row of projRes.rows) {
      console.log("  - Project:", row.data.name, "published:", row.data.published);
      const feedback = row.data.feedback || [];
      for (const f of feedback) {
        if (f.publishedAsTestimonial) {
          testimonialsCount++;
          console.log("    * Testimonial from:", f.clientName || f.authorName, "quote:", f.comment);
        }
      }
    }
    console.log("Total published testimonials:", testimonialsCount);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
