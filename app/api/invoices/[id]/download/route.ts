import { apiHandler, json, notFound, parseObjectId } from "@/lib/server/api";
import { buildPdf } from "@/lib/server/pdf";

export const GET = apiHandler(async ({ db, user, params }) => {
  const id = parseObjectId(params.id);
  const invoice = await db.collection("invoices").findOne({ _id: id });
  if (!invoice) throw notFound("Invoice not found");
  if (user.role === "client" && invoice.clientId !== user._id.toString()) {
    return json({ success: false, error: "Insufficient permissions", message: "Insufficient permissions" }, { status: 403 });
  }
  const lines: string[] = [];
  lines.push("WEBSMITH DIGITAL - INVOICE");
  lines.push(`Invoice #: ${invoice.invoiceNumber}`);
  lines.push(`Client: ${invoice.clientName} <${invoice.clientEmail}>`);
  lines.push(`Issue Date: ${String(invoice.issueDate).slice(0, 10)}  Due Date: ${String(invoice.dueDate).slice(0, 10)}`);
  lines.push(`Status: ${invoice.status}`);
  lines.push("");
  lines.push("ITEM DESCRIPTION             QTY      RATE      AMOUNT");
  for (const item of invoice.items ?? []) {
    lines.push(`${(item.description || "").slice(0, 28).padEnd(28)} ${String(item.quantity ?? 0).padStart(4)}  ${String(item.rate ?? 0).padStart(7)}  ${String(item.amount ?? 0).padStart(9)}`);
  }
  lines.push("");
  lines.push(`Subtotal: $${(invoice.amount ?? 0).toFixed(2)}`);
  if (invoice.discount) lines.push(`Discount: $${Number(invoice.discount).toFixed(2)}`);
  if (invoice.tax) lines.push(`Tax (${invoice.tax}%): $${((invoice.amount * Number(invoice.tax)) / (100 + Number(invoice.tax))).toFixed(2)}`);
  lines.push(`Total: $${(invoice.amount ?? 0).toFixed(2)}`);
  if (invoice.paidAmount) lines.push(`Paid: $${Number(invoice.paidAmount).toFixed(2)}`);
  if (invoice.dueAmount) lines.push(`Due: $${Number(invoice.dueAmount).toFixed(2)}`);
  const pdf = buildPdf(lines);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(pdf.length),
      "Content-Disposition": `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`,
    },
  });
}, { auth: "required" });
