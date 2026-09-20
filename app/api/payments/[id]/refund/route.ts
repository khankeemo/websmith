import { apiHandler, jsonBody, json, notFound, parseObjectId, forbidden, badRequest, ObjectId } from "@/lib/server/api";

export const POST = apiHandler(async ({ db, request, user, params }) => {
  if (user.role !== "admin") throw forbidden();
  const id = parseObjectId(params.id);
  const body = await jsonBody(request);
  const payment = await db.collection("payments").findOne({ _id: id });
  if (!payment) throw notFound("Payment not found");
  if (payment.status === "refunded") throw badRequest("Payment already refunded");
  const update: any = { status: "refunded", updatedAt: new Date() };
  if (body.reason) update.refundReason = String(body.reason);
  const result = await db.collection("payments").findOneAndUpdate({ _id: id }, { $set: update }, { returnDocument: "after" });

  if (payment.invoiceId) {
    try {
      const invoice = await db.collection("invoices").findOne({ _id: new ObjectId(payment.invoiceId) });
      if (invoice) {
        const payments = await db.collection("payments").find({ invoiceId: payment.invoiceId, status: "completed" }).toArray();
        const paid = payments.reduce((s: number, p: any) => s + (p.amount ?? 0), 0);
        await db.collection("invoices").updateOne(
          { _id: invoice._id },
          { $set: { paidAmount: paid, dueAmount: Math.max(0, invoice.amount - paid), status: paid >= invoice.amount ? "paid" : paid > 0 ? "partially_paid" : "pending", updatedAt: new Date() } }
        );
      }
    } catch { /* ignore */ }
  }

  return json({ data: { ...result, _id: result._id.toString() } });
}, { auth: "required" });
