/** Shared rules for pending/overdue so dashboard matches date reality (not only DB status). */

export type InvoiceLike = {
  status: string;
  dueDate: string | Date;
  amount?: number;
};

export function isInvoiceOverdue(inv: InvoiceLike): boolean {
  if (inv.status === "paid") return false;
  if (inv.status === "overdue") return true;
  const due = new Date(inv.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return due < today && (inv.status === "pending" || inv.status === "draft");
}

export function isInvoicePendingDisplay(inv: InvoiceLike): boolean {
  if (inv.status === "paid" || inv.status === "overdue") return false;
  if (isInvoiceOverdue(inv)) return false;
  return inv.status === "pending" || inv.status === "draft";
}

export function computeInvoiceDashboardStats(invoices: InvoiceLike[]) {
  let pending = 0;
  let overdue = 0;
  let paid = 0;
  let totalAmount = 0;

  for (const inv of invoices) {
    totalAmount += Number(inv.amount ?? 0);
    if (inv.status === "paid") {
      paid++;
      continue;
    }
    if (isInvoiceOverdue(inv)) overdue++;
    else if (isInvoicePendingDisplay(inv)) pending++;
  }

  return {
    total: invoices.length,
    paid,
    pending,
    overdue,
    totalAmount,
  };
}
