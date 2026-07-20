export type InvoiceTemplate =
  | 'modern-corporate'
  | 'clean-minimal'
  | 'professional-blue'
  | 'enterprise'
  | 'glass-ui'
  | 'elegant-dark'
  | 'classic-business'
  | 'startup-style'
  | 'marketplace-style'
  | 'thermal-receipt';

export const INVOICE_TEMPLATES: { value: InvoiceTemplate; label: string }[] = [
  { value: 'modern-corporate', label: 'Modern Corporate' },
  { value: 'clean-minimal', label: 'Clean Minimal' },
  { value: 'professional-blue', label: 'Professional Blue' },
  { value: 'enterprise', label: 'Enterprise' },
  { value: 'glass-ui', label: 'Glass UI' },
  { value: 'elegant-dark', label: 'Elegant Dark' },
  { value: 'classic-business', label: 'Classic Business' },
  { value: 'startup-style', label: 'Startup Style' },
  { value: 'marketplace-style', label: 'Marketplace Style' },
  { value: 'thermal-receipt', label: 'Thermal Receipt' },
];

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'refunded';
export type DiscountType = 'percentage' | 'fixed';
export type PaperFormat = 'a4' | 'thermal-58' | 'thermal-80';

export interface InvoiceCompanyInfo {
  logo?: string;
  name: string;
  address: string;
  contact: string;
  email: string;
  website: string;
  gstin?: string;
}

export interface InvoiceCustomerInfo {
  name: string;
  email: string;
  mobile: string;
  address: string;
  gstin?: string;
}

export interface InvoiceLineItem {
  product: string;
  plan?: string;
  license_key?: string;
  quantity: number;
  unit_price: number;
  discount: number;
  discount_type: DiscountType;
  total: number;
}

export interface InvoiceData {
  id?: number;
  invoice_number: string;
  order_number?: string;
  transaction_id?: string;
  payment_id?: string;
  invoice_date: string;
  due_date: string;
  status: InvoiceStatus;
  template: InvoiceTemplate;
  is_gst: boolean;
  paper_format: PaperFormat;

  company: InvoiceCompanyInfo;
  customer: InvoiceCustomerInfo;

  items: InvoiceLineItem[];

  subtotal: number;
  discount: number;
  discount_type: DiscountType;
  taxable_amount: number;
  hsn_sac?: string;
  cgst: number;
  sgst: number;
  igst: number;
  total_tax: number;
  grand_total: number;

  currency: string;
  payment_method?: string;
  payment_status?: string;

  notes?: string;
  terms?: string;

  created_at?: string;
  updated_at?: string;
}

export function calculateInvoiceTotals(items: InvoiceLineItem[], taxRate: number, isGst: boolean, gstType?: 'cgst_sgst' | 'igst'): {
  subtotal: number;
  discount: number;
  taxable_amount: number;
  cgst: number;
  sgst: number;
  igst: number;
  total_tax: number;
  grand_total: number;
} {
  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const discount = items.reduce((s, i) => s + i.discount, 0);
  const taxable_amount = subtotal - discount;

  let cgst = 0, sgst = 0, igst = 0;
  if (isGst && taxRate > 0) {
    if (gstType === 'igst') {
      igst = taxable_amount * (taxRate / 100);
    } else {
      const halfRate = taxRate / 2;
      cgst = taxable_amount * (halfRate / 100);
      sgst = taxable_amount * (halfRate / 100);
    }
  }
  const total_tax = cgst + sgst + igst;
  const grand_total = taxable_amount + total_tax;

  return { subtotal, discount, taxable_amount, cgst, sgst, igst, total_tax, grand_total };
}
