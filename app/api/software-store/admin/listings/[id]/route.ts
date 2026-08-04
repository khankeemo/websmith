import { apiHandler, jsonBody, json, forbidden, notFound, parseObjectId } from "@/lib/server/api";

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

export const PUT = apiHandler(async ({ db, request, user, params }) => {
  if (user.role !== "admin") throw forbidden();
  const id = parseObjectId(params.id);
  const body = await jsonBody(request);
  const update: any = { updatedAt: new Date() };
  if (typeof body.title === "string") update.title = body.title.trim();
  if (typeof body.description === "string") update.description = body.description;
  if (typeof body.category === "string") update.category = body.category;
  if (body.price !== undefined) update.price = typeof body.price === "number" ? body.price : parseFloat(body.price) || 0;
  if (typeof body.currency === "string") update.currency = body.currency;
  if (body.licenseType !== undefined) update.licenseType = body.licenseType;
  if (body.listingMode !== undefined) update.listingMode = body.listingMode;
  if (typeof body.sellerName === "string") update.sellerName = body.sellerName;
  if (typeof body.sellerEmail === "string") update.sellerEmail = body.sellerEmail;
  if (typeof body.website === "string") update.website = body.website;
  if (typeof body.isActive === "boolean") update.isActive = body.isActive;
  if (typeof body.isFeatured === "boolean") update.isFeatured = body.isFeatured;
  const result = await db.collection("software_listings").findOneAndUpdate({ _id: id }, { $set: update }, { returnDocument: "after" });
  if (!result) throw notFound("Listing not found");
  return json({ data: toListing(result) });
}, { auth: "required" });

export const DELETE = apiHandler(async ({ db, user, params }) => {
  if (user.role !== "admin") throw forbidden();
  const id = parseObjectId(params.id);
  const result = await db.collection("software_listings").deleteOne({ _id: id });
  if (result.deletedCount === 0) throw notFound("Listing not found");
  return json({ message: "Listing deleted" });
}, { auth: "required" });
