'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Printer, Download, Mail, CheckCircle, XCircle, FileText, Loader2, ExternalLink } from 'lucide-react';
import { getInvoiceTemplate } from '@/lib/invoice/templates';
import { InvoiceData, InvoiceTemplate, INVOICE_TEMPLATES, InvoiceLineItem } from '@/lib/invoice/types';
import { formatCurrency, formatDate } from '@/lib/invoice/utils';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-500/20 text-gray-400',
  sent: 'bg-blue-500/20 text-blue-400',
  paid: 'bg-emerald-500/20 text-emerald-400',
  overdue: 'bg-red-500/20 text-red-400',
  cancelled: 'bg-yellow-500/20 text-yellow-400',
  refunded: 'bg-purple-500/20 text-purple-400',
};

function mapRowToInvoiceData(row: any): InvoiceData {
  return {
    invoice_number: row.invoice_number,
    order_number: row.order_number || '',
    transaction_id: row.transaction_id || '',
    invoice_date: row.created_at,
    due_date: row.due_date || '',
    status: row.status,
    template: (row.template_name || 'modern-corporate') as InvoiceTemplate,
    is_gst: row.is_gst || false,
    paper_format: (row.paper_format || 'a4') as any,
    company: {
      name: row.company_name || '',
      address: row.company_address || '',
      contact: row.company_contact || '',
      email: row.company_email || '',
      website: row.company_website || '',
      gstin: row.company_gstin || '',
    },
    customer: {
      name: row.customer_name || '',
      email: row.customer_email || '',
      mobile: row.customer_mobile || '',
      address: row.customer_address || '',
      gstin: row.customer_gstin || '',
    },
    items: [{
      product: row.product_name || '',
      plan: row.plan_name || '',
      license_key: row.license_key || '',
      quantity: row.quantity || 1,
      unit_price: parseFloat(row.unit_price) || 0,
      discount: parseFloat(row.discount_amount) || 0,
      discount_type: row.discount_type || 'percentage',
      total: parseFloat(row.total) || 0,
    }],
    subtotal: parseFloat(row.amount) || 0,
    discount: parseFloat(row.discount_amount) || 0,
    discount_type: row.discount_type || 'percentage',
    taxable_amount: (parseFloat(row.amount) || 0) - (parseFloat(row.discount_amount) || 0),
    hsn_sac: row.hsn_sac || '',
    cgst: parseFloat(row.cgst) || 0,
    sgst: parseFloat(row.sgst) || 0,
    igst: parseFloat(row.igst) || 0,
    total_tax: parseFloat(row.tax) || 0,
    grand_total: parseFloat(row.total) || 0,
    currency: row.currency || 'USD',
    payment_method: row.payment_method || '',
    notes: row.notes || '',
    terms: row.terms || '',
  };
}

export default function InvoiceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const fetchInvoice = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/internal/backend/admin/invoices/${id}`);
      const data = await res.json();
      if (data.success) setInvoice(data.invoice);
    } catch (e) {
      console.error('Failed to load invoice', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInvoice(); }, [id]);

  const handleAction = async (action: string) => {
    setActionLoading(action);
    setMessage('');
    try {
      const res = await fetch(`/internal/backend/admin/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage(data.message || `${action} successful`);
        fetchInvoice();
      } else {
        setMessage(data.error || `Failed to ${action}`);
      }
    } catch (e: any) {
      setMessage(String(e));
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" /></div>;
  }

  if (!invoice) {
    return <div className="p-6 text-center text-[var(--text-secondary)]">Invoice not found</div>;
  }

  const data = mapRowToInvoiceData(invoice);

  const TemplatePreview = getInvoiceTemplate(data.template, data);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/internal/api/sales/invoices')} className="p-2 rounded-lg hover:bg-[var(--bg-secondary)]">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <FileText className="w-6 h-6 text-[var(--accent)]" />
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">{invoice.invoice_number}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[invoice.status] || 'bg-gray-500/20 text-gray-400'}`}>{invoice.status}</span>
              <span className="text-xs text-[var(--text-secondary)]">Created {formatDate(invoice.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button onClick={() => router.push(`/internal/api/sales/invoices/${id}/print`)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border-color)] text-sm hover:bg-[var(--bg-secondary)]">
            <Printer className="w-4 h-4" /> A4 Print
          </button>
          <button onClick={() => router.push(`/internal/api/sales/invoices/${id}/thermal`)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border-color)] text-sm hover:bg-[var(--bg-secondary)]">
            <FileText className="w-4 h-4" /> Thermal
          </button>
          {invoice.status === 'draft' && (
            <button onClick={() => handleAction('send-email')} disabled={actionLoading === 'send-email'} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500 disabled:opacity-50">
              {actionLoading === 'send-email' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Send Email
            </button>
          )}
          {invoice.status === 'sent' && (
            <button onClick={() => handleAction('mark-paid')} disabled={actionLoading === 'mark-paid'} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-500 disabled:opacity-50">
              {actionLoading === 'mark-paid' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Mark Paid
            </button>
          )}
          {(invoice.status === 'draft' || invoice.status === 'sent') && (
            <button onClick={() => handleAction('cancel')} disabled={actionLoading === 'cancel'} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-500/30 text-red-400 text-sm hover:bg-red-500/10 disabled:opacity-50">
              <XCircle className="w-4 h-4" /> Cancel
            </button>
          )}
        </div>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${message.includes('successful') ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-500' : 'bg-blue-500/10 border border-blue-500/30 text-blue-400'}`}>
          {message}
        </div>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]">
          <p className="text-xs text-[var(--text-secondary)] mb-1">Customer</p>
          <p className="text-sm font-medium">{data.customer.name || 'N/A'}</p>
          <p className="text-xs text-[var(--text-secondary)]">{data.customer.email}</p>
        </div>
        <div className="p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]">
          <p className="text-xs text-[var(--text-secondary)] mb-1">Amount</p>
          <p className="text-sm font-semibold text-emerald-400">{formatCurrency(data.grand_total, data.currency)}</p>
          <p className="text-xs text-[var(--text-secondary)]">{data.is_gst ? 'GST' : 'Non-GST'}</p>
        </div>
        <div className="p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]">
          <p className="text-xs text-[var(--text-secondary)] mb-1">Template</p>
          <p className="text-sm font-medium capitalize">{data.template.replace('-', ' ')}</p>
          <p className="text-xs text-[var(--text-secondary)]">{data.paper_format === 'a4' ? 'A4 Format' : `Thermal ${data.paper_format === 'thermal-58' ? '58mm' : '80mm'}`}</p>
        </div>
        <div className="p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]">
          <p className="text-xs text-[var(--text-secondary)] mb-1">Due Date</p>
          <p className="text-sm font-medium">{data.due_date ? formatDate(data.due_date) : 'N/A'}</p>
          <p className="text-xs text-[var(--text-secondary)]">{data.payment_method || 'No payment method'}</p>
        </div>
      </div>

      {/* Template Preview */}
      <div className="border border-[var(--border-color)] rounded-xl overflow-hidden bg-white shadow-lg">
        <div className="p-2 bg-gray-100 border-b border-gray-200 flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-xs text-gray-500 ml-2">{data.template} — {data.invoice_number}</span>
        </div>
        <div className="print-area">
          {TemplatePreview}
        </div>
      </div>

      <style jsx>{`
        .print-area {
          background: white;
          color: black;
        }
        .print-area :global(table) {
          color: #333;
        }
      `}</style>
    </div>
  );
}
