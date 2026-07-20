'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Save, Loader2, FileText } from 'lucide-react';
import { INVOICE_TEMPLATES, InvoiceTemplate, InvoiceLineItem, calculateInvoiceTotals } from '@/lib/invoice/types';
import { formatCurrency } from '@/lib/invoice/utils';

const DEFAULT_COMPANY = {
  name: '', address: '', contact: '', email: '', website: '', gstin: '',
};

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'SGD', 'AED'];

export default function NewInvoicePage() {
  const router = useRouter();

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');

  const [company, setCompany] = useState(DEFAULT_COMPANY);
  const [template, setTemplate] = useState<InvoiceTemplate>('modern-corporate');
  const [isGst, setIsGst] = useState(false);
  const [currency, setCurrency] = useState('USD');
  const [hsnSac, setHsnSac] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paperFormat, setPaperFormat] = useState<'a4' | 'thermal-58' | 'thermal-80'>('a4');

  const [items, setItems] = useState<InvoiceLineItem[]>([
    { product: '', plan: '', license_key: '', quantity: 1, unit_price: 0, discount: 0, discount_type: 'percentage', total: 0 },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [taxRate, setTaxRate] = useState(18);

  const updateItem = (index: number, field: keyof InvoiceLineItem, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      (updated[index] as any)[field] = value;
      if (field === 'unit_price' || field === 'quantity' || field === 'discount' || field === 'discount_type') {
        const line = updated[index];
        const gross = line.unit_price * line.quantity;
        line.total = line.discount_type === 'percentage'
          ? gross * (1 - line.discount / 100)
          : gross - line.discount;
      }
      return updated;
    });
  };

  const addItem = () => {
    setItems(prev => [...prev, { product: '', plan: '', license_key: '', quantity: 1, unit_price: 0, discount: 0, discount_type: 'percentage', total: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const totals = calculateInvoiceTotals(items, taxRate, isGst, currency === 'INR' ? 'cgst_sgst' : 'igst');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    if (!customerName || !customerEmail) {
      setError('Customer name and email are required');
      setSubmitting(false);
      return;
    }

    try {
      const payload = {
        customer_name: customerName,
        customer_email: customerEmail,
        customer_mobile: customerMobile,
        customer_address: customerAddress,
        customer_gstin: customerGstin,
        company_name: company.name,
        company_address: company.address,
        company_contact: company.contact,
        company_email: company.email,
        company_website: company.website,
        company_gstin: company.gstin,
        template_name: template,
        is_gst: isGst,
        currency,
        hsn_sac: hsnSac,
        due_date: dueDate || null,
        notes,
        terms,
        order_number: orderNumber,
        payment_method: paymentMethod,
        paper_format: paperFormat,
        status: 'draft',
        product_name: items[0]?.product || '',
        plan_name: items[0]?.plan || '',
        license_key: items[0]?.license_key || '',
        quantity: items.reduce((s, i) => s + i.quantity, 0),
        unit_price: items[0]?.unit_price || 0,
        discount_amount: totals.discount,
        discount_type: 'fixed',
        amount: totals.subtotal,
        tax: totals.total_tax,
        total: totals.grand_total,
        cgst: totals.cgst,
        sgst: totals.sgst,
        igst: totals.igst,
      };

      const res = await fetch('/internal/backend/admin/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        router.push(`/internal/api/sales/invoices/${data.invoice.id}`);
      } else {
        setError(data.error || 'Failed to create invoice');
      }
    } catch (e: any) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-[var(--bg-secondary)]">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <FileText className="w-6 h-6 text-[var(--accent)]" />
        <h1 className="text-xl font-bold text-[var(--text-primary)]">New Invoice</h1>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Template Selection */}
        <div className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Invoice Template</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {INVOICE_TEMPLATES.map(t => (
              <button key={t.value} type="button" onClick={() => setTemplate(t.value)}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${template === t.value ? 'bg-blue-500/15 border-blue-500/40 text-blue-400' : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:border-blue-500/30'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex gap-4 mt-3">
            <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <input type="checkbox" checked={isGst} onChange={e => setIsGst(e.target.checked)} className="rounded" />
              GST Invoice
            </label>
            <select value={currency} onChange={e => setCurrency(e.target.value)} className="px-2 py-1 rounded border border-[var(--border-color)] bg-[var(--bg-secondary)] text-sm">
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={paperFormat} onChange={e => setPaperFormat(e.target.value as any)} className="px-2 py-1 rounded border border-[var(--border-color)] bg-[var(--bg-secondary)] text-sm">
              <option value="a4">A4</option>
              <option value="thermal-80">Thermal 80mm</option>
              <option value="thermal-58">Thermal 58mm</option>
            </select>
          </div>
        </div>

        {/* Company Info */}
        <div className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Company Information</h3>
          <div className="grid grid-cols-2 gap-3">
            <input value={company.name} onChange={e => setCompany(p => ({ ...p, name: e.target.value }))} placeholder="Company Name" className="col-span-2 px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-sm" />
            <input value={company.address} onChange={e => setCompany(p => ({ ...p, address: e.target.value }))} placeholder="Address" className="col-span-2 px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-sm" />
            <input value={company.contact} onChange={e => setCompany(p => ({ ...p, contact: e.target.value }))} placeholder="Contact" className="px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-sm" />
            <input value={company.email} onChange={e => setCompany(p => ({ ...p, email: e.target.value }))} placeholder="Email" className="px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-sm" />
            <input value={company.website} onChange={e => setCompany(p => ({ ...p, website: e.target.value }))} placeholder="Website" className="px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-sm" />
            {isGst && <input value={company.gstin} onChange={e => setCompany(p => ({ ...p, gstin: e.target.value }))} placeholder="Company GSTIN" className="px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-sm" />}
          </div>
        </div>

        {/* Customer Info */}
        <div className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Customer Information</h3>
          <div className="grid grid-cols-2 gap-3">
            <input value={customerName} onChange={e => setCustomerName(e.target.value)} required placeholder="Customer Name" className="px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-sm" />
            <input value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} required type="email" placeholder="Email" className="px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-sm" />
            <input value={customerMobile} onChange={e => setCustomerMobile(e.target.value)} placeholder="Mobile" className="px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-sm" />
            <input value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} placeholder="Address" className="px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-sm" />
            {isGst && <input value={customerGstin} onChange={e => setCustomerGstin(e.target.value)} placeholder="Customer GSTIN" className="px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-sm" />}
            <input value={orderNumber} onChange={e => setOrderNumber(e.target.value)} placeholder="Order Number (optional)" className="px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-sm" />
          </div>
        </div>

        {/* Line Items */}
        <div className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Line Items</h3>
            <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-400">
              <Plus className="w-3 h-3" /> Add Item
            </button>
          </div>
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex gap-2 items-start p-2 rounded-lg bg-[var(--bg-secondary)]">
                <div className="flex-1 grid grid-cols-6 gap-2">
                  <input value={item.product} onChange={e => updateItem(i, 'product', e.target.value)} placeholder="Product" className="col-span-2 px-2 py-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-primary)] text-sm" />
                  <input value={item.plan || ''} onChange={e => updateItem(i, 'plan', e.target.value)} placeholder="Plan" className="px-2 py-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-primary)] text-sm" />
                  <input value={item.license_key || ''} onChange={e => updateItem(i, 'license_key', e.target.value)} placeholder="License Key" className="px-2 py-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-primary)] text-sm" />
                  <input type="number" value={item.quantity} onChange={e => updateItem(i, 'quantity', parseInt(e.target.value) || 1)} min={1} className="px-2 py-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-primary)] text-sm w-16" />
                  <input type="number" value={item.unit_price} onChange={e => updateItem(i, 'unit_price', parseFloat(e.target.value) || 0)} min={0} step={0.01} className="px-2 py-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-primary)] text-sm w-24" />
                </div>
                <span className="text-sm font-medium py-1.5 text-[var(--text-primary)] min-w-[80px] text-right">{formatCurrency(item.total, currency)}</span>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(i)} className="p-1.5 rounded hover:bg-red-500/10">
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {isGst && (
            <div className="mt-3 flex items-center gap-3">
              <input value={hsnSac} onChange={e => setHsnSac(e.target.value)} placeholder="HSN/SAC Code" className="px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-sm w-40" />
              <div className="flex items-center gap-2">
                <label className="text-xs text-[var(--text-secondary)]">Tax Rate %</label>
                <input type="number" value={taxRate} onChange={e => setTaxRate(parseFloat(e.target.value) || 0)} min={0} max={100} step={0.01} className="px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-sm w-20" />
              </div>
            </div>
          )}
        </div>

        {/* Totals Preview */}
        <div className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Summary</h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Subtotal</span><span>{formatCurrency(totals.subtotal, currency)}</span></div>
            {totals.discount > 0 && <div className="flex justify-between"><span className="text-red-400">Discount</span><span>-{formatCurrency(totals.discount, currency)}</span></div>}
            <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Taxable Amount</span><span>{formatCurrency(totals.taxable_amount, currency)}</span></div>
            {isGst && <><div className="flex justify-between"><span className="text-[var(--text-secondary)]">CGST</span><span>{formatCurrency(totals.cgst, currency)}</span></div><div className="flex justify-between"><span className="text-[var(--text-secondary)]">SGST</span><span>{formatCurrency(totals.sgst, currency)}</span></div></>}
            {!isGst && totals.total_tax > 0 && <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Tax</span><span>{formatCurrency(totals.total_tax, currency)}</span></div>}
            <div className="flex justify-between font-bold text-base pt-2 border-t border-[var(--border-color)]"><span>Grand Total</span><span>{formatCurrency(totals.grand_total, currency)}</span></div>
          </div>
        </div>

        {/* Dates & Payment */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]">
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">Due Date</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-sm" />
          </div>
          <div className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]">
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">Payment Method</label>
            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-sm">
              <option value="">Select...</option>
              <option value="stripe">Stripe</option>
              <option value="razorpay">Razorpay</option>
              <option value="paypal">PayPal</option>
              <option value="phonepe">PhonePe</option>
              <option value="cashfree">Cashfree</option>
              <option value="bank">Bank Transfer</option>
              <option value="cash">Cash</option>
            </select>
          </div>
        </div>

        {/* Notes & Terms */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]">
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Additional notes..." className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-sm resize-none" />
          </div>
          <div className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]">
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">Terms & Conditions</label>
            <textarea value={terms} onChange={e => setTerms(e.target.value)} rows={3} placeholder="Payment terms..." className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-sm resize-none" />
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={submitting} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {submitting ? 'Creating...' : 'Create Invoice'}
          </button>
          <button type="button" onClick={() => router.back()} className="px-5 py-2.5 rounded-lg border border-[var(--border-color)] text-sm hover:bg-[var(--bg-secondary)]">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
