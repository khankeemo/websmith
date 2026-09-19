import bcrypt from "bcryptjs";
import { apiHandler, jsonBody, json, forbidden, notFound, parseObjectId } from "@/lib/server/api";
import { resolveStoredTemporaryPassword } from "@/lib/tickets/email";

// Phase 3 — Client Onboarding: the temporary password of a client account is
// ENCRYPTED AT REST (AES-256-GCM, key derived from JWT_SECRET). It is only
// revealed to the logged-in admin AFTER their own password is verified, so a
// Get in Touch submission can create the account immediately (Client
// Onboarding record) without ever auto-showing or leaking the credentials.
//
// Hard rules:
//   - the temporary password is NEVER returned to the public / unauthenticated;
//   - it is NEVER written to logs, URLs, consoles or unnecessary responses;
//   - the plaintext is only decryptable by an admin who re-enters their password.

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000;

// In-memory per-admin brute-force guard (mirrors the public route's Map pattern).
const attempts = new Map<string, { count: number; resetAt: number }>();

export const POST = apiHandler(async ({ db, request, user, params }) => {
  if (user.role !== "admin") throw forbidden();

  const key = String(user._id ?? "");
  const now = Date.now();
  const entry = attempts.get(key);
  if (entry && entry.resetAt > now && entry.count >= MAX_ATTEMPTS) {
    return json(
      { success: false, error: "Too many attempts. Please try again later.", message: "Too many attempts. Please try again later." },
      { status: 429 }
    );
  }
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
  }

  const body = await jsonBody(request);
  const adminPassword = String(body?.adminPassword ?? "");
  if (!adminPassword) {
    return json(
      { success: false, error: "Your password is required to reveal this client's temporary password", message: "Your password is required to reveal this client's temporary password" },
      { status: 400 }
    );
  }

  // Verify the CURRENT admin password against the live bcrypt hash. Admins
  // without a stored password hash (e.g. OAuth-only) can never reveal.
  const adminValid = user.password ? await bcrypt.compare(adminPassword, user.password) : false;
  if (!adminValid) {
    return json(
      { success: false, error: "Password incorrect. The temporary password stays hidden.", message: "Password incorrect. The temporary password stays hidden." },
      { status: 403 }
    );
  }

  const id = parseObjectId(params.id);
  const ticket = await db.collection("tickets").findOne({ _id: id });
  if (!ticket) throw notFound("Ticket not found");

  const email = String(ticket.contactEmail || ticket.clientEmail || "").trim().toLowerCase();
  const account = email ? await db.collection("users").findOne({ email, role: "client" }) : null;
  if (!account) {
    return json(
      { success: false, error: "No client account is linked to this ticket", message: "No client account is linked to this ticket" },
      { status: 404 }
    );
  }
  if (!account.isTemporaryPassword) {
    return json(
      { success: false, error: "This client already set their own password (no temporary password to reveal)", message: "This client already set their own password (no temporary password to reveal)" },
      { status: 400 }
    );
  }

  const temporaryPassword = resolveStoredTemporaryPassword(account);
  if (!temporaryPassword) {
    return json(
      { success: false, error: "The temporary password is not available", message: "The temporary password is not available" },
      { status: 500 }
    );
  }

  // Revealed ONLY here — never logged, never in history, never in URLs.
  return json({ temporaryPassword });
}, { auth: "required" });