import { apiHandler, jsonBody, json, forbidden, badRequest, serialize } from "@/lib/server/api";
import bcrypt from "bcryptjs";

const VALID_ROLES = ["admin", "developer"];

export const POST = apiHandler(async ({ db, request, user }) => {
  if (user.role !== "admin") throw forbidden();
  const body = await jsonBody(request);
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const role = String(body.role ?? "developer");
  if (!name || !email || !email.includes("@")) throw badRequest("Name and valid email are required");
  if (!VALID_ROLES.includes(role)) throw badRequest("Role must be admin or developer");

  const existing = await db.collection("users").findOne({ email });
  if (existing) return json({ success: false, error: "An account with this email already exists", message: "An account with this email already exists" }, { status: 409 });

  const tempPassword = `Tmp@${Math.random().toString(36).slice(2, 8)}!${Math.floor(Math.random() * 1000)}`;
  const hashedPassword = await bcrypt.hash(tempPassword, 10);

  const prefix = role === "admin" ? "ADM" : "DEV";
  const last = await db.collection("users")
    .find({ customId: { $regex: new RegExp(`^${prefix}-\\d+$`) } })
    .sort({ customId: -1 })
    .limit(1)
    .toArray();
  const lastNumber = last.length > 0 ? parseInt(last[0].customId.replace(`${prefix}-`, ""), 10) : 0;
  const customId = `${prefix}-${String(lastNumber + 1).padStart(4, "0")}`;

  const now = new Date();
  const doc = {
    name,
    email,
    password: hashedPassword,
    role,
    adminLevel: role === "admin" ? "sub" : null,
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
    published: false,
    headline: "",
    bio: "",
    skills: [],
    status: "active",
    experienceYears: 0,
    joinedAt: now.toISOString(),
    createdAt: now,
    updatedAt: now,
    __v: 0,
  };
  const result = await db.collection("users").insertOne(doc);
  return json({ data: { ...doc, _id: result.insertedId.toString(), temporaryPassword: tempPassword, createdAt: now } }, { status: 201 });
}, { auth: "required" });
