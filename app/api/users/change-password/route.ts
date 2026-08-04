import { apiHandler, jsonBody, json, badRequest } from "@/lib/server/api";
import bcrypt from "bcryptjs";

export const POST = apiHandler(async ({ db, request, user }) => {
  const body = await jsonBody(request);
  const currentPassword = String(body.currentPassword ?? "");
  const newPassword = String(body.newPassword ?? "");
  if (!currentPassword || !newPassword) throw badRequest("Current and new password are required");
  if (newPassword.length < 8) throw badRequest("New password must be at least 8 characters");

  const stored = await db.collection("users").findOne({ _id: user._id });
  if (!stored) return json({ success: false, error: "Account not found", message: "Account not found" }, { status: 404 });
  if (stored.password) {
    const valid = await bcrypt.compare(currentPassword, stored.password);
    if (!valid) return json({ success: false, error: "Current password is incorrect", message: "Current password is incorrect" }, { status: 400 });
  }
  const hashed = await bcrypt.hash(newPassword, 10);
  const now = new Date();
  await db.collection("users").updateOne(
    { _id: user._id },
    { $set: { password: hashed, isTemporaryPassword: false, updatedAt: now } }
  );
  return json({ message: "Password changed successfully" });
}, { auth: "required" });
