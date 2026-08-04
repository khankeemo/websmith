import { apiHandler, jsonBody, json, forbidden } from "@/lib/server/api";

export const GET = apiHandler(async ({ db, user }) => {
  if (user.role !== "admin") throw forbidden();
  const inquiries = await db.collection("software_inquiries").find().sort({ createdAt: -1 }).toArray();
  const data = await Promise.all(inquiries.map(async (q) => {
    let listingId: any = q.listingId ?? null;
    if (q.listingId) {
      try {
        const listing = await db.collection("software_listings").findOne({ _id: q.listingId });
        if (listing) listingId = { _id: listing._id.toString(), title: listing.title };
      } catch { /* keep raw */ }
    }
    return {
      _id: q._id.toString(),
      listingId,
      intent: q.intent ?? "buy",
      name: q.name,
      email: q.email,
      company: q.company ?? "",
      budget: q.budget ?? null,
      message: q.message,
      status: q.status ?? "new",
      createdAt: q.createdAt ?? null,
    };
  }));
  return json({ data });
}, { auth: "required" });

export const POST = apiHandler(async ({ db, request }) => {
  const body = await jsonBody(request);
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  if (!name || !email || !email.includes("@")) return json({ success: false, error: "Name and valid email are required", message: "Name and valid email are required" }, { status: 400 });
  const doc = {
    listingId: body.listingId ?? null,
    intent: body.intent === "sell" ? "sell" : "buy",
    name,
    email,
    company: String(body.company ?? "").trim(),
    budget: body.budget ?? null,
    message: String(body.message ?? "").trim(),
    status: "new",
    createdAt: new Date(),
  };
  const result = await db.collection("software_inquiries").insertOne(doc);
  return json({ data: { ...doc, _id: result.insertedId.toString() } }, { status: 201 });
});
