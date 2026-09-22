import { MongoClient } from 'mongodb';
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
  if (!env.MONGODB_URI) {
    throw new Error("MONGODB_URI not found in .env");
  }

  const backupDir = path.resolve('scripts/backup');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `mongo_full_backup_${timestamp}.json`);
  const latestBackupFile = path.join(backupDir, 'mongo_full_backup_latest.json');

  console.log("Connecting to MongoDB Atlas...");
  const client = new MongoClient(env.MONGODB_URI);
  try {
    await client.connect();
    console.log("Connected to MongoDB!");
    const db = client.db("WSD");
    const collections = await db.listCollections().toArray();
    console.log(`Found ${collections.length} collections.`);

    const backupData = {
      exportedAt: new Date().toISOString(),
      database: "WSD",
      totalCollections: collections.length,
      collections: {}
    };

    let totalDocs = 0;

    for (const col of collections) {
      const name = col.name;
      const docs = await db.collection(name).find().toArray();
      // Serialize ObjectIds and dates to strings
      const serializedDocs = docs.map(doc => {
        const d = { ...doc };
        if (d._id) d._id = d._id.toString();
        return d;
      });
      backupData.collections[name] = {
        count: serializedDocs.length,
        documents: serializedDocs
      };
      totalDocs += serializedDocs.length;
      console.log(` - Backed up ${name}: ${serializedDocs.length} documents`);
    }

    backupData.totalDocuments = totalDocs;

    const jsonStr = JSON.stringify(backupData, null, 2);
    fs.writeFileSync(backupFile, jsonStr, 'utf-8');
    fs.writeFileSync(latestBackupFile, jsonStr, 'utf-8');

    console.log(`\nBackup successfully written to:\n${backupFile}\n${latestBackupFile}`);
    console.log(`Total documents backed up: ${totalDocs}`);
  } finally {
    await client.close();
    console.log("MongoDB connection closed.");
  }
}

run().catch(err => {
  console.error("Backup failed:", err);
  process.exit(1);
});
