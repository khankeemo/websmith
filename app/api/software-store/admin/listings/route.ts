import { apiHandler, jsonBody, json, forbidden } from "@/lib/server/api";

const toListing = (l: any) => ({
  _id: l._id.toString(),
  title: l.title,
  description: l.description,
  category: l.category,
  price: l.price ?? 0,
  currency: l.currency ?? "USD",
  licenseType: l.licenseType ?? "one_time",
  listingMode: l.listingMode ?? "both",
  sellerName: l.sellerName ?? "",
  sellerEmail: l.sellerEmail ?? "",
  website: l.website ?? "",
  isActive: l.isActive ?? true,
  isFeatured: l.isFeatured ?? false,
  createdAt: l.createdAt ?? null,
});

export const GET = apiHandler(async ({ db, user }) => {
  if (user.role !== "admin") throw forbidden();
  const listings = await db.collection("software_listings").find().sort({ createdAt: -1 }).toArray();
  return json({ data: listings.map(toListing) });
}, { auth: "required" });

export const POST = apiHandler(async ({ db, request, user }) => {
  if (user.role !== "admin") throw forbidden();
  const body = await jsonBody(request);
  const title = String(body.title ?? "").trim();
  if (!title) return json({ success: false, error: "Title is required", message: "Title is required" }, { status: 400 });
  const doc = {
    title,
    description: String(body.description ?? "").trim(),
    category: String(body.category ?? "").trim(),
    price: typeof body.price === "number" ? body.price : parseFloat(body.price) || 0,
    currency: String(body.currency ?? "USD"),
    licenseType: body.licenseType ?? "one_time",
    listingMode: body.listingMode ?? "both",
    sellerName: String(body.sellerName ?? "").trim(),
    sellerEmail: String(body.sellerEmail ?? "").trim(),
    website: String(body.website ?? "").trim(),
    isActive: body.isActive !== false,
    isFeatured: body.isFeatured === true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const result = await db.collection("software_listings").insertOne(doc);
  return json({ data: toListing({ ...doc, _id: result.insertedId }) }, { status: 201 });
}, { auth: "required" });
