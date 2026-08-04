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

export const GET = apiHandler(async ({ db, user }) => {
  if (user.role !== "admin") throw forbidden();
  const clients = await db.collection("users").find({ role: "client" }).sort({ name: 1 }).toArray();
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
