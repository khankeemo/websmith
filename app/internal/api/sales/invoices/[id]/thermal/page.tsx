'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { getInvoiceTemplate } from '@/lib/invoice/templates';
import { InvoiceData, InvoiceTemplate } from '@/lib/invoice/types';

function mapRowToInvoiceData(row: any, format: 'thermal-58' | 'thermal-80'): InvoiceData {
  return {
    invoice_number: row.invoice_number,
    order_number: row.order_number || '',
    transaction_id: row.transaction_id || '',
    invoice_date: row.created_at,
    due_date: row.due_date || '',
    status: row.status,
    template: 'thermal-receipt',
    is_gst: row.is_gst || false,
    paper_format: format,
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

export default function InvoiceThermalPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const format = (searchParams.get('format') || 'thermal-80') as 'thermal-58' | 'thermal-80';

  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/internal/backend/admin/invoices/${id}`);
        const data = await res.json();
        if (data.success) setInvoice(data.invoice);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    if (!loading && invoice) {
      setTimeout(() => window.print(), 500);
    }
  }, [loading, invoice]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  if (!invoice) {
    return <div className="p-8 text-center">Invoice not found</div>;
  }

  const data = mapRowToInvoiceData(invoice, format);
  const thermalWidth = format === 'thermal-58' ? '280px' : '380px';

  return (
    <div>
      <style>{`
        @page { margin: 0; size: ${format === 'thermal-58' ? '80mm' : '112mm'} 297mm; }
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff; }
        @media print { body { margin: 0; padding: 0; } }
      `}</style>
      <div className="no-print fixed top-4 left-1/2 -translate-x-1/2 z-50 flex gap-3">
        <button onClick={() => window.print()} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium shadow-lg hover:bg-blue-500">
          Print Thermal Receipt
        </button>
        <button onClick={() => window.close()} className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium shadow-lg hover:bg-gray-500">
          Close
        </button>
      </div>
      <div style={{ maxWidth: thermalWidth, margin: '0 auto', background: '#fff', padding: '8px 0' }}>
        {getInvoiceTemplate('thermal-receipt', data, true)}
      </div>
    </div>
  );
}
