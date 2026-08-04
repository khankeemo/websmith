import { apiHandler, json, notFound, parseObjectId } from "@/lib/server/api";
import { buildPdf } from "@/lib/server/pdf";

export const GET = apiHandler(async ({ db, user, params }) => {
  const id = parseObjectId(params.id);
  const payment = await db.collection("payments").findOne({ _id: id });
  if (!payment) throw notFound("Payment not found");
  if (user.role === "client" && payment.clientEmail !== user.email) {
    return json({ success: false, error: "Insufficient permissions", message: "Insufficient permissions" }, { status: 403 });
  }
  const lines: string[] = [];
  lines.push("WEBSMITH DIGITAL - PAYMENT RECEIPT");
  lines.push(`Receipt #: ${payment.transactionId ?? payment._id.toString()}`);
  lines.push(`Invoice #: ${payment.invoiceNumber ?? ""}`);
  lines.push(`Client: ${payment.clientName ?? ""} <${payment.clientEmail ?? ""}>`);
  lines.push(`Date: ${String(payment.date ?? "").slice(0, 10)}`);
  lines.push(`Method: ${payment.method ?? ""}  Provider: ${payment.provider ?? ""}`);
  lines.push(`Status: ${payment.status ?? ""}`);
  lines.push("");
  lines.push(`Amount: ${(payment.currency ?? "USD")} ${(payment.amount ?? 0).toFixed(2)}`);
  if (payment.notes) {
    lines.push("");
    lines.push(`Notes: ${payment.notes}`);
  }
  const pdf = buildPdf(lines);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(pdf.length),
      "Content-Disposition": `attachment; filename="receipt-${payment.transactionId ?? payment._id.toString()}.pdf"`,
    },
  });
}, { auth: "required" });
