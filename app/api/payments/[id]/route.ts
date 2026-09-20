import { apiHandler, jsonBody, json, notFound, parseObjectId, forbidden, badRequest, ObjectId } from "@/lib/server/api";

const recomputeInvoice = async (db: any, invoiceId: string | null) => {
  if (!invoiceId) return;
  try {
    const invoice = await db.collection("invoices").findOne({ _id: new ObjectId(invoiceId) });
    if (!invoice) return;
    const payments = await db.collection("payments").find({ invoiceId, status: "completed" }).toArray();
    const paid = payments.reduce((s: number, p: any) => s + (p.amount ?? 0), 0);
    await db.collection("invoices").updateOne(
      { _id: invoice._id },
      { $set: { paidAmount: paid, dueAmount: Math.max(0, invoice.amount - paid), status: paid >= invoice.amount ? "paid" : paid > 0 ? "partially_paid" : "pending", updatedAt: new Date() } }
    );
  } catch { /* ignore */ }
};

export const GET = apiHandler(async ({ db, user, params }) => {
  const id = parseObjectId(params.id);
  const payment = await db.collection("payments").findOne({ _id: id });
  if (!payment) throw notFound("Payment not found");
  if (user.role === "client" && payment.clientEmail !== user.email) throw forbidden();
  return json({ data: { ...payment, _id: payment._id.toString() } });
}, { auth: "required" });

export const PUT = apiHandler(async ({ db, request, user, params }) => {
  if (user.role !== "admin") throw forbidden();
  const id = parseObjectId(params.id);
  const body = await jsonBody(request);
  const payment = await db.collection("payments").findOne({ _id: id });
  if (!payment) throw notFound("Payment not found");
  const update: any = { updatedAt: new Date() };
  if (typeof body.method === "string") update.method = body.method;
  if (typeof body.status === "string") update.status = body.status;
  if (body.amount !== undefined) update.amount = Number(body.amount);
  if (typeof body.notes === "string") update.notes = body.notes;
  if (typeof body.transactionId === "string") update.transactionId = body.transactionId;
  if (typeof body.date === "string") update.date = body.date;
  const result = await db.collection("payments").findOneAndUpdate({ _id: id }, { $set: update }, { returnDocument: "after" });
  await recomputeInvoice(db, result.invoiceId ?? payment.invoiceId ?? null);
  return json({ data: { ...result, _id: result._id.toString() } });
}, { auth: "required" });

export const DELETE = apiHandler(async ({ db, user, params }) => {
  if (user.role !== "admin") throw forbidden();
  const id = parseObjectId(params.id);
  const payment = await db.collection("payments").findOne({ _id: id });
  if (!payment) throw notFound("Payment not found");
  await db.collection("payments").deleteOne({ _id: id });
  await recomputeInvoice(db, payment.invoiceId ?? null);
  return json({ message: "Payment deleted" });
}, { auth: "required" });
