import { apiHandler, json, forbidden } from "@/lib/server/api";

export const GET = apiHandler(async ({ db, user }) => {
  if (user.role !== "admin") throw forbidden();
  const services = await db.collection("services").find().sort({ createdAt: -1 }).toArray();
  return json({ data: services });
}, { auth: "required" });
