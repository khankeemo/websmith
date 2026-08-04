import { apiHandler, jsonBody, json, forbidden, notFound, parseObjectId } from "@/lib/server/api";

export const GET = apiHandler(async ({ db, user, params }) => {
  const id = parseObjectId(params.id);
  const invoice = await db.collection("invoices").findOne({ _id: id });
  if (!invoice) throw notFound("Invoice not found");
  if (user.role === "client" && invoice.clientId !== user._id.toString()) throw forbidden();
  return json({ data: { ...invoice, _id: invoice._id.toString() } });
}, { auth: "required" });

export const PUT = apiHandler(async ({ db, request, user, params }) => {
  if (user.role !== "admin") throw forbidden();
  const id = parseObjectId(params.id);
  const body = await jsonBody(request);
  const invoice = await db.collection("invoices").findOne({ _id: id });
  if (!invoice) throw notFound("Invoice not found");
  const update: any = { updatedAt: new Date() };
  for (const key of ["clientId", "projectId", "billingType", "milestoneLabel", "clientName", "clientEmail", "clientAddress", "issueDate", "dueDate", "notes"]) {
    if (body[key] !== undefined) update[key] = body[key];
  }
  if (Array.isArray(body.items)) {
    update.items = body.items.map((item: any) => ({
      description: String(item.description ?? ""),
      quantity: Number(item.quantity ?? 0),
      rate: Number(item.rate ?? 0),
      amount: Number(item.quantity ?? 0) * Number(item.rate ?? 0),
    }));
  }
  if (body.tax !== undefined) update.tax = Number(body.tax);
  if (body.discount !== undefined) update.discount = Number(body.discount);
  const subtotal = (update.items ?? invoice.items ?? []).reduce((sum: number, item: any) => sum + item.amount, 0);
  update.amount = Math.round(Math.max(0, subtotal - (Number(update.discount ?? invoice.discount) || 0)) * (1 + (Number(update.tax ?? invoice.tax) || 0) / 100) * 100) / 100;
  update.dueAmount = Math.max(0, Math.round((update.amount - (invoice.paidAmount ?? 0)) * 100) / 100);
  if (update.dueAmount === 0 && invoice.status !== "paid") update.status = "paid";
  const result = await db.collection("invoices").findOneAndUpdate({ _id: id }, { $set: update }, { returnDocument: "after" });
  return json({ data: { ...result, _id: result._id.toString() } });
}, { auth: "required" });

export const DELETE = apiHandler(async ({ db, user, params }) => {
  if (user.role !== "admin") throw forbidden();
  const id = parseObjectId(params.id);
  const result = await db.collection("invoices").deleteOne({ _id: id });
  if (result.deletedCount === 0) throw notFound("Invoice not found");
  return json({ message: "Invoice deleted" });
}, { auth: "required" });
