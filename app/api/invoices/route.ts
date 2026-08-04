import { apiHandler, jsonBody, json, forbidden, badRequest } from "@/lib/server/api";

function computeAmount(items: any[], tax: number, discount: number): number {
  const subtotal = (items || []).reduce((sum: number, item: any) => sum + Number(item.quantity ?? 0) * Number(item.rate ?? 0), 0);
  const afterDiscount = Math.max(0, subtotal - (Number(discount) || 0));
  const total = Math.round(afterDiscount * (1 + (Number(tax) || 0) / 100) * 100) / 100;
  return total;
}

export const GET = apiHandler(async ({ db, user }) => {
  const filter: any = {};
  if (user.role === "client") filter.clientId = user._id.toString();
  const invoices = await db.collection("invoices").find(filter).sort({ createdAt: -1 }).toArray();
  return json({ data: invoices.map((i) => ({ ...i, _id: i._id.toString() })) });
}, { auth: "required" });

export const POST = apiHandler(async ({ db, request, user }) => {
  if (user.role !== "admin") throw forbidden();
  const body = await jsonBody(request);
  const clientName = String(body.clientName ?? "").trim();
  const clientEmail = String(body.clientEmail ?? "").trim();
  if (!clientName || !clientEmail) throw badRequest("Client name and email are required");
  if (!Array.isArray(body.items) || body.items.length === 0) throw badRequest("At least one invoice item is required");

  const count = await db.collection("invoices").countDocuments();
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const invoiceNumber = body.invoiceNumber || `INV-${ymd}-${String(count + 1).padStart(4, "0")}`;

  const tax = body.tax == null ? 0 : Number(body.tax);
  const discount = body.discount == null ? 0 : Number(body.discount);
  const amount = computeAmount(body.items, tax, discount);

  const doc = {
    clientId: body.clientId ? String(body.clientId) : null,
    projectId: body.projectId ? String(body.projectId) : null,
    billingType: body.billingType || "project_completion",
    milestoneLabel: body.milestoneLabel ? String(body.milestoneLabel) : "",
    invoiceNumber,
    clientName,
    clientEmail,
    clientAddress: String(body.clientAddress ?? ""),
    amount,
    paidAmount: 0,
    dueAmount: amount,
    status: "pending",
    issueDate: body.issueDate || now.toISOString(),
    dueDate: body.dueDate || now.toISOString(),
    items: body.items.map((item: any) => ({
      description: String(item.description ?? ""),
      quantity: Number(item.quantity ?? 0),
      rate: Number(item.rate ?? 0),
      amount: Number(item.quantity ?? 0) * Number(item.rate ?? 0),
    })),
    notes: body.notes ? String(body.notes) : "",
    tax,
    discount,
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.collection("invoices").insertOne(doc);
  return json({ data: { ...doc, _id: result.insertedId.toString() } }, { status: 201 });
}, { auth: "required" });
