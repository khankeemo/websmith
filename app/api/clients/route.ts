import { apiHandler, jsonBody, json, forbidden, badRequest } from "@/lib/server/api";
import bcrypt from "bcryptjs";

const toClient = (u: any) => ({
  _id: u._id.toString(),
  name: u.name,
  email: u.email,
  phone: u.phone ?? "",
  company: u.company ?? "",
  address: u.address ?? "",
  status: u.status ?? "active",
  customId: u.customId,
  published: u.published ?? false,
  createdAt: u.createdAt ?? null,
});

const SEED_CLIENTS = [
  { name: "Logix Global Supply Chain", company: "Enterprise Logistics", address: "Global freight tracking and inventory architecture across 8 international fulfillment hubs.", email: "contact@logixglobal.com" },
  { name: "Aura Capital Partners", company: "FinTech & Wealth Management", address: "Real-time algorithmic trading and risk analytics interface with sub-50ms market execution.", email: "info@auracapital.com" },
  { name: "MedCare Health Network", company: "Healthcare & Telemedicine", address: "HIPAA-compliant encrypted telemedicine portals and real-time doctor consult scheduling.", email: "contact@medcarenetwork.com" },
  { name: "TransLogix Express", company: "Transportation & Fleet", address: "Automated telemetry dispatch, driver routing, and live geospatial vehicle tracking.", email: "dispatch@translogix.com" },
  { name: "Nordic Retail Labs", company: "eCommerce Solutions", address: "Modern B2B marketplace infrastructure with automated invoicing and multi-currency tax reporting.", email: "partner@nordicretail.com" },
  { name: "Vanguard Cloud Systems", company: "Cloud Infrastructure", address: "Distributed license key authentication gate serving multi-region SaaS vendors.", email: "support@vanguardcloud.com" },
  { name: "Apex Mobility", company: "Urban Transit & IoT", address: "Connected IoT asset tracking platform with sub-second device status synchronization.", email: "ops@apexmobility.io" },
  { name: "Solaris Energy Tech", company: "Renewable Energy Analytics", address: "High-resolution telemetry dashboard for smart solar grid performance monitoring.", email: "grid@solarisenergy.com" },
  { name: "Quantum Digital Assets", company: "Institutional Digital Custody", address: "Hardware-security-backed key management and cryptographic authorization gateways.", email: "custody@quantumdigital.io" },
  { name: "Horizon EdTech", company: "Adaptive Learning Systems", address: "Interactive classroom streaming platform with automated grading and student analytics.", email: "hello@horizonedtech.org" },
];

export const GET = apiHandler(async ({ db, user }) => {
  if (user.role !== "admin") throw forbidden();
  const collection = db.collection("users");
  let clients = await collection.find({ role: "client" }).sort({ name: 1 }).toArray();

  if (clients.length === 0) {
    for (let i = 0; i < SEED_CLIENTS.length; i++) {
      const item = SEED_CLIENTS[i];
      const customId = `CL-${String(i + 101).padStart(4, "0")}`;
      await collection.insertOne({
        ...item,
        role: "client",
        status: "active",
        published: true,
        customId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    clients = await collection.find({ role: "client" }).sort({ name: 1 }).toArray();
  }

  return json({ data: clients.map(toClient) });
}, { auth: "required" });


export const POST = apiHandler(async ({ db, request, user }) => {
  if (user.role !== "admin") throw forbidden();
  const body = await jsonBody(request);
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!name || !email || !email.includes("@")) throw badRequest("Name and valid email are required");
  const existing = await db.collection("users").findOne({ email });
  if (existing) return json({ success: false, error: "An account with this email already exists", message: "An account with this email already exists" }, { status: 409 });

  const tempPassword = `Tmp@${Math.random().toString(36).slice(2, 8)}!${Math.floor(Math.random() * 1000)}`;
  const hashedPassword = await bcrypt.hash(tempPassword, 10);
  const last = await db.collection("users").find({ customId: { $regex: /^CL-\d+$/ } }).sort({ customId: -1 }).limit(1).toArray();
  const lastNumber = last.length > 0 ? parseInt(last[0].customId.replace("CL-", ""), 10) : 0;
  const customId = `CL-${String(lastNumber + 1).padStart(4, "0")}`;
  const now = new Date();
  const doc = {
    name,
    email,
    password: hashedPassword,
    role: "client",
    adminLevel: null,
    avatar: "",
    phone: String(body.phone ?? "").trim(),
    company: String(body.company ?? "").trim(),
    address: String(body.address ?? "").trim(),
    preferences: { theme: "light", notifications: { email: true, push: true, projectUpdates: true, queryResponses: true } },
    provider: null,
    providerId: "",
    isOAuthUser: false,
    customId,
    isTemporaryPassword: true,
    isApproved: true,
    setupCompleted: true,
    published: body.published === true,
    status: body.status ?? "active",
    createdAt: now,
    updatedAt: now,
    __v: 0,
  };
  const result = await db.collection("users").insertOne(doc);
  return json({ data: { ...toClient({ ...doc, _id: result.insertedId }), temporaryPassword: tempPassword } }, { status: 201 });
}, { auth: "required" });
