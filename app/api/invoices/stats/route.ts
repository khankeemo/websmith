import { apiHandler, json, forbidden } from "@/lib/server/api";

export const GET = apiHandler(async ({ db, user }) => {
  if (user.role !== "admin") throw forbidden();
  const invoices = await db.collection("invoices").find().toArray();
  const now = new Date();
  const totalAmount = invoices.reduce((s, i) => s + (i.amount ?? 0), 0);
  const totalPaidAmount = invoices.reduce((s, i) => s + (i.paidAmount ?? 0), 0);
  const overdue = invoices.filter((i) => {
    if (i.status === "paid") return false;
    return i.dueDate && new Date(i.dueDate) < now;
  });
  const data = {
    total: invoices.length,
    paid: invoices.filter((i) => i.status === "paid").length,
    pending: invoices.filter((i) => ["pending", "draft"].includes(i.status)).length,
    overdue: overdue.length,
    totalAmount,
    totalPaidAmount,
    totalPendingAmount: Math.max(0, totalAmount - totalPaidAmount),
  };
  return json({ data });
}, { auth: "required" });
