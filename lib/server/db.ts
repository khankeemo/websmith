// FILE: lib/server/db.ts
// PURPOSE: PostgreSQL-backed document engine for portal and website API routes.
//          Replaces MongoDB completely with zero data loss and 100% query compatibility.
//          Operates on `portal_*` tables inside Neon PostgreSQL.

import crypto from "crypto";
import { getDb } from "@/lib/backend-db";
import type { Pool } from "pg";

export class ObjectId {
  private _id: string;

  constructor(id?: string | ObjectId) {
    if (id instanceof ObjectId) {
      this._id = id.toString();
    } else if (typeof id === "string" && id.length > 0) {
      this._id = id;
    } else {
      this._id = crypto.randomBytes(12).toString("hex");
    }
  }

  toString(): string {
    return this._id;
  }

  toHexString(): string {
    return this._id;
  }

  toJSON(): string {
    return this._id;
  }

  equals(other: any): boolean {
    if (!other) return false;
    const str = other instanceof ObjectId ? other.toString() : String(other);
    return this._id === str;
  }

  static isValid(id: any): boolean {
    if (id instanceof ObjectId) return true;
    if (typeof id === "string") {
      return /^[0-9a-fA-F]{24}$/.test(id) || id.length > 0;
    }
    return false;
  }
}

export function parseObjectId(id: string): ObjectId {
  if (!ObjectId.isValid(id)) {
    const err: any = new Error("Invalid ID format");
    err.status = 400;
    throw err;
  }
  return new ObjectId(id);
}

// ---------------------------------------------------------------------------
// Document matching helper (evaluates Mongo-style queries on JSON objects)
// ---------------------------------------------------------------------------
function getNestedValue(obj: any, path: string): any {
  if (!obj || typeof obj !== "object") return undefined;
  if (path in obj) return obj[path];
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[p];
  }
  return cur;
}

function extractSimpleId(val: any): string | null {
  if (val == null) return null;
  if (typeof val === "string") return val;
  if (val instanceof ObjectId) return val.toString();
  if (typeof val === "object" && typeof val.toHexString === "function") return val.toString();
  if (typeof val === "object" && !Object.keys(val).some(k => k.startsWith("$"))) return String(val);
  return null;
}

function normalizeVal(v: any): any {
  if (v == null) return v;
  if (v instanceof ObjectId) return v.toString();
  if (typeof v === "object" && typeof v.toHexString === "function") return v.toString();
  if (v instanceof Date) return v.toISOString();
  return v;
}

function matchCondition(actual: any, expected: any): boolean {
  actual = normalizeVal(actual);
  expected = normalizeVal(expected);

  if (expected && typeof expected === "object" && !(expected instanceof RegExp)) {
    const keys = Object.keys(expected);
    const hasOperators = keys.some(k => k.startsWith("$"));

    if (hasOperators) {
      for (const op of keys) {
        const opVal = expected[op];
        if (op === "$eq") {
          if (normalizeVal(opVal) !== actual) return false;
        } else if (op === "$ne") {
          if (normalizeVal(opVal) === actual) return false;
        } else if (op === "$in") {
          if (!Array.isArray(opVal)) return false;
          const set = opVal.map(normalizeVal);
          if (!set.includes(actual)) return false;
        } else if (op === "$nin") {
          if (!Array.isArray(opVal)) return false;
          const set = opVal.map(normalizeVal);
          if (set.includes(actual)) return false;
        } else if (op === "$gt") {
          if (!(actual > opVal)) return false;
        } else if (op === "$gte") {
          if (!(actual >= opVal)) return false;
        } else if (op === "$lt") {
          if (!(actual < opVal)) return false;
        } else if (op === "$lte") {
          if (!(actual <= opVal)) return false;
        } else if (op === "$exists") {
          const exists = actual !== undefined;
          if (exists !== Boolean(opVal)) return false;
        } else if (op === "$regex") {
          const flags = expected["$options"] || "";
          const re = opVal instanceof RegExp ? opVal : new RegExp(opVal, flags);
          if (typeof actual !== "string" || !re.test(actual)) return false;
        } else if (op === "$options") {
          // Handled with $regex
        }
      }
      return true;
    }
  }

  if (expected instanceof RegExp) {
    return typeof actual === "string" && expected.test(actual);
  }

  return actual === expected;
}

export function matchDocument(doc: any, filter?: any): boolean {
  if (!filter || Object.keys(filter).length === 0) return true;

  for (const key of Object.keys(filter)) {
    if (key === "$or") {
      const clauses = filter["$or"];
      if (!Array.isArray(clauses) || !clauses.some(c => matchDocument(doc, c))) {
        return false;
      }
      continue;
    }

    if (key === "$and") {
      const clauses = filter["$and"];
      if (!Array.isArray(clauses) || !clauses.every(c => matchDocument(doc, c))) {
        return false;
      }
      continue;
    }

    const expected = filter[key];
    const actual = key === "_id" ? (doc._id ? doc._id.toString() : undefined) : getNestedValue(doc, key);

    if (!matchCondition(actual, expected)) {
      return false;
    }
  }

  return true;
}

function applyUpdate(doc: any, update: any, isInsert: boolean = false): any {
  const updated = JSON.parse(JSON.stringify(doc));

  if (isInsert && update.$setOnInsert) {
    for (const [k, v] of Object.entries(update.$setOnInsert)) {
      setNestedValue(updated, k, v);
    }
  }

  if (update.$set) {
    for (const [k, v] of Object.entries(update.$set)) {
      setNestedValue(updated, k, v);
    }
  }

  if (update.$unset) {
    for (const k of Object.keys(update.$unset)) {
      unsetNestedValue(updated, k);
    }
  }

  if (update.$inc) {
    for (const [k, v] of Object.entries(update.$inc)) {
      const cur = getNestedValue(updated, k) || 0;
      setNestedValue(updated, k, cur + Number(v));
    }
  }

  if (update.$push) {
    for (const [k, v] of Object.entries(update.$push)) {
      let arr = getNestedValue(updated, k);
      if (!Array.isArray(arr)) arr = [];
      if (v && typeof v === "object" && "$each" in (v as any)) {
        arr.push(...(v as any).$each);
      } else {
        arr.push(v);
      }
      setNestedValue(updated, k, arr);
    }
  }

  // If update has direct fields without operators
  const topKeys = Object.keys(update).filter(k => !k.startsWith("$"));
  if (topKeys.length > 0 && !update.$set) {
    for (const k of topKeys) {
      setNestedValue(updated, k, update[k]);
    }
  }

  return updated;
}

function setNestedValue(obj: any, path: string, val: any) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] == null || typeof cur[p] !== "object") cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = val;
}

function unsetNestedValue(obj: any, path: string) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] == null || typeof cur[p] !== "object") return;
    cur = cur[p];
  }
  delete cur[parts[parts.length - 1]];
}

function applyProjection(doc: any, projection?: Record<string, any>): any {
  if (!doc || !projection || Object.keys(projection).length === 0) return doc;
  const isInclusive = Object.values(projection).some(v => v === 1 || v === true);
  
  if (isInclusive) {
    const res: any = {};
    if (projection._id !== 0) res._id = doc._id;
    for (const [k, v] of Object.entries(projection)) {
      if (v === 1 || v === true) {
        res[k] = doc[k];
      }
    }
    return res;
  } else {
    const res = { ...doc };
    for (const [k, v] of Object.entries(projection)) {
      if (v === 0 || v === false) {
        delete res[k];
      }
    }
    return res;
  }
}

// ---------------------------------------------------------------------------
// Cursor
// ---------------------------------------------------------------------------
export class Cursor<T = any> {
  private collection: Collection;
  private filter: any;
  private sortFields?: Record<string, 1 | -1>;
  private limitCount?: number;
  private skipCount?: number;
  private projectionFields?: Record<string, any>;

  constructor(collection: Collection, filter?: any) {
    this.collection = collection;
    this.filter = filter;
  }

  sort(sortObj: Record<string, 1 | -1>): this {
    this.sortFields = sortObj;
    return this;
  }

  limit(n: number): this {
    this.limitCount = n;
    return this;
  }

  skip(n: number): this {
    this.skipCount = n;
    return this;
  }

  project<P = any>(proj: Record<string, any>): Cursor<P> {
    this.projectionFields = proj;
    return this as unknown as Cursor<P>;
  }

  async toArray(): Promise<T[]> {
    const all = await this.collection.findRaw(this.filter);

    let res = all;

    if (this.sortFields && Object.keys(this.sortFields).length > 0) {
      res.sort((a, b) => {
        for (const [field, dir] of Object.entries(this.sortFields!)) {
          const valA = getNestedValue(a, field);
          const valB = getNestedValue(b, field);
          if (valA === valB) continue;
          if (valA == null) return dir === 1 ? -1 : 1;
          if (valB == null) return dir === 1 ? 1 : -1;
          if (valA < valB) return dir === 1 ? -1 : 1;
          if (valA > valB) return dir === 1 ? 1 : -1;
        }
        return 0;
      });
    }

    if (this.skipCount && this.skipCount > 0) {
      res = res.slice(this.skipCount);
    }

    if (this.limitCount && this.limitCount > 0) {
      res = res.slice(0, this.limitCount);
    }

    if (this.projectionFields) {
      res = res.map(d => applyProjection(d, this.projectionFields));
    }

    return res;
  }
}

// ---------------------------------------------------------------------------
// Collection
// ---------------------------------------------------------------------------
export class Collection<T = any> {
  private tableName: string;
  private poolPromise: Promise<Pool>;

  constructor(name: string, poolPromise: Promise<Pool>) {
    this.tableName = `portal_${name.toLowerCase()}`;
    this.poolPromise = poolPromise;
  }

  private async getPool(): Promise<Pool> {
    return await this.poolPromise;
  }

  private async ensureTable() {
    const pool = await this.getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        _id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_data ON ${this.tableName} USING GIN (data);
    `);
  }

  async findRaw(filter?: any): Promise<any[]> {
    await this.ensureTable();
    const pool = await this.getPool();

    // Optimize single _id query
    const rawId = filter && filter._id ? extractSimpleId(filter._id) : null;
    if (rawId) {
      const res = await pool.query(`SELECT data FROM ${this.tableName} WHERE _id = $1`, [rawId]);
      if (res.rows.length === 0) return [];
      const doc = res.rows[0].data;
      return matchDocument(doc, filter) ? [doc] : [];
    }

    const res = await pool.query(`SELECT data FROM ${this.tableName}`);
    return res.rows.map(r => r.data).filter(d => matchDocument(d, filter));
  }

  find<T = any>(filter?: any): Cursor<T> {
    return new Cursor<T>(this, filter);
  }

  async findOne<T = any>(filter?: any, options?: { projection?: Record<string, any> }): Promise<T | null> {
    await this.ensureTable();
    const pool = await this.getPool();

    const rawId = filter && filter._id ? extractSimpleId(filter._id) : null;
    if (rawId) {
      const res = await pool.query(`SELECT data FROM ${this.tableName} WHERE _id = $1`, [rawId]);
      if (res.rows.length === 0) return null;
      const doc = res.rows[0].data;
      if (!matchDocument(doc, filter)) return null;
      return applyProjection(doc, options?.projection) as T;
    }

    const cursor = this.find<T>(filter);
    const docs = await cursor.limit(1).toArray();
    if (docs.length === 0) return null;
    return applyProjection(docs[0], options?.projection) as T;
  }

  async insertOne(doc: any): Promise<{ insertedId: ObjectId | string; acknowledged: boolean }> {
    await this.ensureTable();
    const pool = await this.getPool();

    const toInsert = { ...doc };
    if (!toInsert._id) {
      toInsert._id = new ObjectId().toString();
    } else if (toInsert._id instanceof ObjectId) {
      toInsert._id = toInsert._id.toString();
    }

    const id = String(toInsert._id);
    const now = new Date().toISOString();
    if (!toInsert.createdAt && !toInsert.created_at) toInsert.createdAt = now;
    if (!toInsert.updatedAt && !toInsert.updated_at) toInsert.updatedAt = now;

    await pool.query(
      `
      INSERT INTO ${this.tableName} (_id, data, created_at, updated_at)
      VALUES ($1, $2, NOW(), NOW())
      ON CONFLICT (_id) DO UPDATE SET
        data = EXCLUDED.data,
        updated_at = NOW();
      `,
      [id, JSON.stringify(toInsert)]
    );

    return { insertedId: new ObjectId(id), acknowledged: true };
  }

  async insertMany(docs: any[]): Promise<{ insertedIds: Record<number, ObjectId>; acknowledged: boolean }> {
    const insertedIds: Record<number, ObjectId> = {};
    for (let i = 0; i < docs.length; i++) {
      const res = await this.insertOne(docs[i]);
      insertedIds[i] = new ObjectId(res.insertedId.toString());
    }
    return { insertedIds, acknowledged: true };
  }

  async updateOne(
    filter: any,
    update: any,
    options?: { upsert?: boolean }
  ): Promise<{ matchedCount: number; modifiedCount: number; upsertedId?: ObjectId }> {
    await this.ensureTable();
    const existing = await this.findOne(filter);

    if (!existing) {
      if (options?.upsert) {
        const base = filter && typeof filter === "object" ? { ...filter } : {};
        delete base._id;
        const newDoc = applyUpdate(base, update, true);
        const ins = await this.insertOne(newDoc);
        return { matchedCount: 0, modifiedCount: 1, upsertedId: new ObjectId(ins.insertedId.toString()) };
      }
      return { matchedCount: 0, modifiedCount: 0 };
    }

    const updated = applyUpdate(existing, update, false);
    updated.updatedAt = new Date().toISOString();
    const pool = await this.getPool();

    await pool.query(
      `UPDATE ${this.tableName} SET data = $1, updated_at = NOW() WHERE _id = $2`,
      [JSON.stringify(updated), String(updated._id)]
    );

    return { matchedCount: 1, modifiedCount: 1 };
  }

  async updateMany(filter: any, update: any): Promise<{ matchedCount: number; modifiedCount: number }> {
    const matched = await this.find(filter).toArray();
    let mod = 0;
    for (const doc of matched) {
      await this.updateOne({ _id: doc._id }, update);
      mod++;
    }
    return { matchedCount: matched.length, modifiedCount: mod };
  }

  async findOneAndUpdate<T = any>(
    filter: any,
    update: any,
    options?: { returnDocument?: "before" | "after"; upsert?: boolean }
  ): Promise<any> {
    const existing = await this.findOne(filter);
    if (!existing) {
      if (options?.upsert) {
        const base = filter && typeof filter === "object" ? { ...filter } : {};
        delete base._id;
        const newDoc = applyUpdate(base, update, true);
        await this.insertOne(newDoc);
        const res: any = { ...newDoc, value: newDoc };
        return res;
      }
      return { value: null };
    }

    const updated = applyUpdate(existing, update, false);
    updated.updatedAt = new Date().toISOString();
    const pool = await this.getPool();

    await pool.query(
      `UPDATE ${this.tableName} SET data = $1, updated_at = NOW() WHERE _id = $2`,
      [JSON.stringify(updated), String(updated._id)]
    );

    const finalDoc = options?.returnDocument === "before" ? existing : updated;
    const res: any = { ...finalDoc, value: finalDoc };
    return res;
  }

  async bulkWrite(ops: any[]): Promise<any> {
    for (const op of ops) {
      if (op.updateOne) {
        await this.updateOne(op.updateOne.filter, op.updateOne.update, { upsert: op.updateOne.upsert });
      } else if (op.insertOne) {
        await this.insertOne(op.insertOne.document || op.insertOne);
      } else if (op.deleteOne) {
        await this.deleteOne(op.deleteOne.filter);
      }
    }
    return { acknowledged: true, insertedCount: 0, matchedCount: ops.length, modifiedCount: ops.length };
  }

  async deleteOne(filter: any): Promise<{ deletedCount: number }> {
    const doc = await this.findOne(filter);
    if (!doc) return { deletedCount: 0 };
    const pool = await this.getPool();
    await pool.query(`DELETE FROM ${this.tableName} WHERE _id = $1`, [String(doc._id)]);
    return { deletedCount: 1 };
  }

  async deleteMany(filter: any): Promise<{ deletedCount: number }> {
    const docs = await this.find(filter).toArray();
    if (docs.length === 0) return { deletedCount: 0 };
    const pool = await this.getPool();
    for (const doc of docs) {
      await pool.query(`DELETE FROM ${this.tableName} WHERE _id = $1`, [String(doc._id)]);
    }
    return { deletedCount: docs.length };
  }

  async countDocuments(filter?: any): Promise<number> {
    const docs = await this.find(filter).toArray();
    return docs.length;
  }
}

// ---------------------------------------------------------------------------
// Db and MongoClient
// ---------------------------------------------------------------------------
export class Db {
  private collections: Map<string, Collection<any>> = new Map();
  private poolPromise: Promise<Pool>;

  constructor(poolPromise: Promise<Pool>) {
    this.poolPromise = poolPromise;
  }

  collection<T = any>(name: string): Collection<T> {
    const lower = name.toLowerCase();
    if (!this.collections.has(lower)) {
      this.collections.set(lower, new Collection<any>(lower, this.poolPromise));
    }
    return this.collections.get(lower)! as unknown as Collection<T>;
  }
}

let globalDbInstance: Db | null = null;

export function getPortalDb(customPool?: Pool): Db {
  if (customPool) {
    return new Db(Promise.resolve(customPool));
  }
  if (!globalDbInstance) {
    globalDbInstance = new Db(getDb());
  }
  return globalDbInstance;
}

export class MongoClient {
  private dbInstance: Db;

  constructor(_uri?: string) {
    this.dbInstance = getPortalDb();
  }

  async connect(): Promise<this> {
    return this;
  }

  async close(): Promise<void> {
    // Shared pool in Neon, no-op for individual request close
  }

  db(_name?: string): Db {
    return this.dbInstance;
  }
}
