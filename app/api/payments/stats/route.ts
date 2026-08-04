import { apiHandler, json, forbidden } from "@/lib/server/api";

export const GET = apiHandler(async ({ db, user }) => {
  if (user.role !== "admin") throw forbidden();
  const payments = await db.collection("payments").find().toArray();
  const total = payments.length;
  const count = (s: string) => payments.filter((p) => p.status === s).length;
  const totalAmount = payments.reduce((s, p) => s + (p.status === "completed" ? p.amount : 0), 0);

  const monthlyMap: Record<string, { amount: number; count: number }> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    monthlyMap[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`] = { amount: 0, count: 0 };
  }
  for (const p of payments) {
    const key = String(p.date ?? p.createdAt ?? "").slice(0, 7);
    if (monthlyMap[key]) {
      monthlyMap[key].amount += p.amount;
      monthlyMap[key].count += 1;
    }
  }
  const monthlyData = Object.entries(monthlyMap).map(([month, v]) => ({ month, amount: v.amount, count: v.count }));

  return json({
    data: {
      total,
      completed: count("completed"),
      pending: count("pending"),
      failed: count("failed"),
      refunded: count("refunded"),
      totalAmount,
      monthlyData,
    },
  });
}, { auth: "required" });
