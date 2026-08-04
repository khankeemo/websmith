import { apiHandler, json, forbidden, notFound, parseObjectId } from "@/lib/server/api";

export const PATCH = apiHandler(async ({ db, user, params }) => {
  if (user.role !== "admin") throw forbidden();
  const id = parseObjectId(params.id);
  const invoice = await db.collection("invoices").findOne({ _id: id });
  if (!invoice) throw notFound("Invoice not found");
  const result = await db.collection("invoices").findOneAndUpdate(
    { _id: id },
    { $set: { status: "paid", paidAmount: invoice.amount, dueAmount: 0, updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  return json({ data: { ...result, _id: result._id.toString() } });
}, { auth: "required" });
