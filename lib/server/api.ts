import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import {
  MongoClient,
  ObjectId,
  Db,
  parseObjectId,
  getPortalDb,
} from "./db";

export { MongoClient, ObjectId, Db, parseObjectId, getPortalDb };

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const badRequest = (msg: string) => new HttpError(400, msg);
export const unauthorized = (msg = "Authentication required") => new HttpError(401, msg);
export const forbidden = (msg = "Insufficient permissions") => new HttpError(403, msg);
export const notFound = (msg = "Not found") => new HttpError(404, msg);

export function getMongoUri(): string {
  return process.env.DATABASE_URL || "";
}

export function serialize(value: any): any {
  if (value == null) return value;
  if (value instanceof ObjectId) return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === "object") {
    const out: any = {};
    for (const key of Object.keys(value)) out[key] = serialize(value[key]);
    return out;
  }
  return value;
}

export async function jsonBody(request: Request): Promise<any> {
  try {
    return await request.json();
  } catch {
    throw badRequest("Invalid JSON body");
  }
}

export async function authUser(db: Db, request: Request, roles?: string[]) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!token) throw unauthorized();
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new HttpError(500, "Authentication configuration missing");
  let payload: any;
  try {
    payload = jwt.verify(token, secret);
  } catch {
    throw unauthorized("Session invalid. Please log in again.");
  }
  const user = await db.collection("users").findOne({ _id: new ObjectId(payload.sub) });
  if (!user) throw new HttpError(404, "Account not found in authentication system");
  if (roles && !roles.includes(user.role)) throw forbidden();
  return user;
}

export function json(data: any, init?: { status?: number }) {
  return NextResponse.json({ success: true, ...data }, init ?? {});
}

export type ApiRouteContext = {
  request: Request;
  db: Db;
  client: MongoClient;
  user: any;
  params: Record<string, string>;
};

export type ApiHandlerOpts = {
  auth?: "required";
  roles?: string[];
};

export function apiHandler(
  handler: (ctx: ApiRouteContext) => Promise<Response>,
  opts?: ApiHandlerOpts
) {
  return async (request: Request, routeCtx?: { params: any }) => {
    let client: MongoClient | null = null;
    try {
      const db = getPortalDb();
      client = new MongoClient();
      const params = routeCtx?.params ? await routeCtx.params : {};
      let user: any = null;
      if (opts?.auth) {
        user = await authUser(db, request, opts.roles);
      }
      return await handler({ request, db, client, user, params });
    } catch (error) {
      if (client) {
        try { await client.close(); } catch {}
      }
      if (error instanceof HttpError) {
        return NextResponse.json(
          { success: false, error: error.message, message: error.message },
          { status: error.status }
        );
      }
      console.error("API error (internal):", error instanceof Error ? error.stack || error.message : error);
      return NextResponse.json(
        { success: false, error: "An unexpected error occurred. Please try again later.", message: "An unexpected error occurred. Please try again later." },
        { status: 500 }
      );
    }
  };
}
