import { apiHandler, json, badRequest, serialize } from "@/lib/server/api";

const VALID_ROLES = ["admin", "client", "developer"];

export const GET = apiHandler(async ({ db, params }) => {
  const role = params.role;
  if (!VALID_ROLES.includes(role)) throw badRequest("Invalid role");
  const users = await db
    .collection("users")
    .find({ role })
    .sort({ name: 1 })
    .toArray();
  const data = users.map((u) => ({
    _id: u._id.toString(),
    name: u.name,
    email: u.email,
    role: u.role,
    adminLevel: u.adminLevel ?? null,
    phone: u.phone ?? "",
    company: u.company ?? "",
    customId: u.customId,
    published: u.published ?? false,
    headline: u.headline ?? "",
    bio: u.bio ?? "",
    skills: u.skills ?? [],
    status: u.status ?? "active",
    experienceYears: u.experienceYears ?? 0,
    joinedAt: u.joinedAt ?? null,
    avatar: u.avatar ?? "",
  }));
  return json({ data });
}, { auth: "required" });
