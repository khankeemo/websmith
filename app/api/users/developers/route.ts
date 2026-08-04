import { apiHandler, jsonBody, json, forbidden, badRequest } from "@/lib/server/api";
import bcrypt from "bcryptjs";

export const GET = apiHandler(async ({ db }) => {
  const developers = await db.collection("users").find({ role: "developer" }).sort({ name: 1 }).toArray();
  const data = developers.map((u) => ({
    _id: u._id.toString(),
    name: u.name,
    email: u.email,
    phone: u.phone ?? "",
    company: u.company ?? "",
    customId: u.customId,
    headline: u.headline ?? "",
    bio: u.bio ?? "",
    skills: u.skills ?? [],
    status: u.status ?? "active",
    experienceYears: u.experienceYears ?? 0,
    joinedAt: u.joinedAt ?? null,
    avatar: u.avatar ?? "",
    published: u.published ?? false,
  }));
  return json({ data });
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

  const last = await db.collection("users")
    .find({ customId: { $regex: /^DEV-\d+$/ } })
    .sort({ customId: -1 })
    .limit(1)
    .toArray();
  const lastNumber = last.length > 0 ? parseInt(last[0].customId.replace("DEV-", ""), 10) : 0;
  const customId = `DEV-${String(lastNumber + 1).padStart(4, "0")}`;

  const now = new Date();
  const doc = {
    name,
    email,
    password: hashedPassword,
    role: "developer",
    adminLevel: null,
    avatar: "",
    phone: String(body.phone ?? "").trim(),
    company: String(body.company ?? "").trim(),
    preferences: { theme: "light", notifications: { email: true, push: true, projectUpdates: true, queryResponses: true } },
    provider: null,
    providerId: "",
    isOAuthUser: false,
    customId,
    isTemporaryPassword: true,
    isApproved: true,
    setupCompleted: true,
    published: body.published === true,
    headline: String(body.headline ?? "").trim(),
    bio: String(body.bio ?? "").trim(),
    skills: Array.isArray(body.skills) ? body.skills.map(String) : [],
    status: body.status ?? "active",
    experienceYears: body.experienceYears == null ? 0 : Number(body.experienceYears),
    joinedAt: body.joinedAt || now.toISOString(),
    createdAt: now,
    updatedAt: now,
    __v: 0,
  };
  const result = await db.collection("users").insertOne(doc);
  return json({ data: { ...doc, _id: result.insertedId.toString(), temporaryPassword: tempPassword, createdAt: now } }, { status: 201 });
}, { auth: "required" });
