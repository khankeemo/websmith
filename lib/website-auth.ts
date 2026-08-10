// FILE: lib/website-auth.ts
// PURPOSE: Shared helpers for the WEBSITE login OTP step (step 2: verify).
//          Builds the public user shape + signs the website JWT (JWT_SECRET).
//          Kept in one place so `/api/auth/login/otp/verify` (and any future
//          website auth route) reuses the same token/user contract.

import jwt from "jsonwebtoken";

export function toPublicUser(user: any) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone ?? undefined,
    company: user.company ?? undefined,
    avatar: user.avatar ?? undefined,
    adminLevel: user.adminLevel ?? undefined,
    isTemporaryPassword: user.isTemporaryPassword ?? false,
    isForcedPasswordReset: user.isForcedPasswordReset ?? false,
    setupCompleted: user.setupCompleted ?? true,
    preferences: user.preferences,
    customId: user.customId,
  };
}

export function signToken(user: any): string {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  return jwt.sign(
    { sub: user._id.toString(), email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}