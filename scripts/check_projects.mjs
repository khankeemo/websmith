import { getDb } from "./lib/server/db.js";

async function main() {
  const db = await getDb();
  const all = await db.collection("projects").find({}).toArray();
  console.log("Total projects in DB:", all.length);
  for (const p of all) {
    console.log("-", p.name, "published:", p.published);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
