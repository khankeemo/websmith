import { apiHandler, jsonBody, json, badRequest, ObjectId } from "@/lib/server/api";

export const GET = apiHandler(async ({ db, user }) => {
  const filter: any = {};
  if (user.role === "client") filter.clientEmail = user.email;
  const payments = await db.collection("payments").find(filter).sort({ createdAt: -1 }).toArray();
  return json({ data: payments.map((p) => ({ ...p, _id: p._id.toString() })) });
}, { auth: "required" });

export const POST = apiHandler(async ({ db, request, user }) => {
  if (user.role !== "admin") throw badRequest("Insufficient permissions");
  const body = await jsonBody(request);
  const invoiceId = body.invoiceId ? String(body.invoiceId) : null;
  if (!invoiceId) throw badRequest("invoiceId is required");
  const invoice = await db.collection("invoices").findOne({ _id: new ObjectId(invoiceId) }).catch(() => null);
  const now = new Date();
  const doc = {
    invoiceId,
    invoiceNumber: invoice?.invoiceNumber ?? body.invoiceNumber ?? "",
    clientName: invoice?.clientName ?? body.clientName ?? "",
    clientEmail: invoice?.clientEmail ?? body.clientEmail ?? "",
    amount: body.amount == null ? invoice?.amount ?? 0 : Number(body.amount),
    currency: body.currency ?? "USD",
    provider: body.provider ?? "manual",
    providerPaymentId: body.providerPaymentId ?? "",
    method: body.method ?? "bank",
    status: body.status ?? "completed",
    transactionId: body.transactionId || `TXN-${Date.now()}`,
    date: body.date || now.toISOString(),
    notes: body.notes ? String(body.notes) : "",
    receipt: "",
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.collection("payments").insertOne(doc);
  if (invoice) {
    const paid = (invoice.paidAmount ?? 0) + doc.amount;
    await db.collection("invoices").updateOne({ _id: invoice._id }, { $set: { paidAmount: paid, dueAmount: Math.max(0, invoice.amount - paid), status: paid >= invoice.amount ? "paid" : "partially_paid", updatedAt: now } });
  }
  return json({ data: { ...doc, _id: result.insertedId.toString() } }, { status: 201 });
}, { auth: "required" });
