import React from 'react';
import { InvoiceData, InvoiceLineItem } from './types';
import { formatCurrency, formatDate, numberToWords } from './utils';

interface TemplateProps {
  data: InvoiceData;
  thermal?: boolean;
}

function TableRow({ item, currency }: { item: InvoiceLineItem; currency: string }) {
  return (
    <tr style={{ borderBottom: '1px solid #eee' }}>
      <td style={{ padding: '10px 8px', fontSize: '13px' }}>{item.product}{item.plan ? ` (${item.plan})` : ''}</td>
      <td style={{ padding: '10px 8px', fontSize: '13px', textAlign: 'center' }}>{item.quantity}</td>
      <td style={{ padding: '10px 8px', fontSize: '13px', textAlign: 'right' }}>{formatCurrency(item.unit_price, currency)}</td>
      <td style={{ padding: '10px 8px', fontSize: '13px', textAlign: 'right' }}>{item.discount > 0 ? formatCurrency(item.discount, currency) : '-'}</td>
      <td style={{ padding: '10px 8px', fontSize: '13px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(item.total, currency)}</td>
    </tr>
  );
}

function GSTTable({ data, currency }: { data: InvoiceData; currency: string }) {
  if (!data.is_gst) return null;
  return (
    <>
      <tr><td style={{ padding: '8px', fontSize: '13px' }}>SGST ({data.hsn_sac || 'N/A'})</td><td style={{ padding: '8px', fontSize: '13px', textAlign: 'right' }}>{formatCurrency(data.sgst, currency)}</td></tr>
      <tr><td style={{ padding: '8px', fontSize: '13px' }}>CGST ({data.hsn_sac || 'N/A'})</td><td style={{ padding: '8px', fontSize: '13px', textAlign: 'right' }}>{formatCurrency(data.cgst, currency)}</td></tr>
    </>
  );
}

function TotalsBlock({ data, currency }: { data: InvoiceData; currency: string }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <tbody>
        <tr><td style={{ padding: '8px', fontSize: '13px', color: '#666' }}>Subtotal</td><td style={{ padding: '8px', fontSize: '13px', textAlign: 'right' }}>{formatCurrency(data.subtotal, currency)}</td></tr>
        {data.discount > 0 && (
          <tr><td style={{ padding: '8px', fontSize: '13px', color: '#666' }}>Discount</td><td style={{ padding: '8px', fontSize: '13px', textAlign: 'right', color: '#e53e3e' }}>-{formatCurrency(data.discount, currency)}</td></tr>
        )}
        <tr><td style={{ padding: '8px', fontSize: '13px', color: '#666' }}>Taxable Amount</td><td style={{ padding: '8px', fontSize: '13px', textAlign: 'right' }}>{formatCurrency(data.taxable_amount, currency)}</td></tr>
        <GSTTable data={data} currency={currency} />
        {!data.is_gst && data.total_tax > 0 && (
          <tr><td style={{ padding: '8px', fontSize: '13px', color: '#666' }}>Tax</td><td style={{ padding: '8px', fontSize: '13px', textAlign: 'right' }}>{formatCurrency(data.total_tax, currency)}</td></tr>
        )}
        <tr style={{ borderTop: '2px solid #333' }}>
          <td style={{ padding: '10px 8px', fontSize: '15px', fontWeight: 700 }}>Grand Total</td>
          <td style={{ padding: '10px 8px', fontSize: '15px', fontWeight: 700, textAlign: 'right' }}>{formatCurrency(data.grand_total, currency)}</td>
        </tr>
      </tbody>
    </table>
  );
}

// ================================================================
// TEMPLATE 1: Modern Corporate
// ================================================================
export function ModernCorporate({ data }: TemplateProps) {
  return (
    <div style={{ fontFamily: "'Inter','Segoe UI',sans-serif", maxWidth: '800px', margin: '0 auto', padding: '40px', color: '#1a1a2e' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', paddingBottom: '24px', borderBottom: '3px solid #4a90d9' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '28px', fontWeight: 800, color: '#1a1a2e' }}>{data.company.name}</h1>
          <p style={{ margin: '2px 0', fontSize: '12px', color: '#666' }}>{data.company.address}</p>
          <p style={{ margin: '2px 0', fontSize: '12px', color: '#666' }}>{data.company.contact} | {data.company.email}</p>
          {data.company.gstin && <p style={{ margin: '2px 0', fontSize: '12px', color: '#666' }}>GSTIN: {data.company.gstin}</p>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: '32px', fontWeight: 800, color: '#4a90d9', letterSpacing: '2px' }}>INVOICE</h2>
          <p style={{ margin: '2px 0', fontSize: '13px', color: '#666' }}><strong>Invoice #:</strong> {data.invoice_number}</p>
          <p style={{ margin: '2px 0', fontSize: '13px', color: '#666' }}><strong>Date:</strong> {formatDate(data.invoice_date)}</p>
          <p style={{ margin: '2px 0', fontSize: '13px', color: '#666' }}><strong>Due:</strong> {formatDate(data.due_date)}</p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '32px', marginBottom: '32px' }}>
        <div style={{ flex: 1, padding: '16px', background: '#f8f9fb', borderRadius: '8px' }}>
          <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, color: '#4a90d9', textTransform: 'uppercase' }}>Bill To</p>
          <p style={{ margin: '2px 0', fontSize: '14px', fontWeight: 600 }}>{data.customer.name}</p>
          <p style={{ margin: '2px 0', fontSize: '12px', color: '#666' }}>{data.customer.email}</p>
          <p style={{ margin: '2px 0', fontSize: '12px', color: '#666' }}>{data.customer.mobile}</p>
          <p style={{ margin: '2px 0', fontSize: '12px', color: '#666' }}>{data.customer.address}</p>
          {data.customer.gstin && <p style={{ margin: '2px 0', fontSize: '12px', color: '#666' }}>GSTIN: {data.customer.gstin}</p>}
        </div>
        <div style={{ flex: 1, padding: '16px', background: '#f8f9fb', borderRadius: '8px' }}>
          <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, color: '#4a90d9', textTransform: 'uppercase' }}>Order Info</p>
          {data.order_number && <p style={{ margin: '2px 0', fontSize: '12px', color: '#666' }}>Order: {data.order_number}</p>}
          {data.transaction_id && <p style={{ margin: '2px 0', fontSize: '12px', color: '#666' }}>Transaction: {data.transaction_id}</p>}
          {data.payment_method && <p style={{ margin: '2px 0', fontSize: '12px', color: '#666' }}>Payment: {data.payment_method}</p>}
          <p style={{ margin: '2px 0', fontSize: '12px', color: '#666' }}>Status: <span style={{ color: data.status === 'paid' ? '#22c55e' : data.status === 'overdue' ? '#ef4444' : '#f59e0b', fontWeight: 600 }}>{data.status.toUpperCase()}</span></p>
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
        <thead>
          <tr style={{ background: '#1a1a2e', color: '#fff' }}>
            <th style={{ padding: '12px 8px', fontSize: '12px', fontWeight: 600, textAlign: 'left' }}>ITEM</th>
            <th style={{ padding: '12px 8px', fontSize: '12px', fontWeight: 600, textAlign: 'center', width: '60px' }}>QTY</th>
            <th style={{ padding: '12px 8px', fontSize: '12px', fontWeight: 600, textAlign: 'right', width: '100px' }}>UNIT PRICE</th>
            <th style={{ padding: '12px 8px', fontSize: '12px', fontWeight: 600, textAlign: 'right', width: '90px' }}>DISCOUNT</th>
            <th style={{ padding: '12px 8px', fontSize: '12px', fontWeight: 600, textAlign: 'right', width: '100px' }}>TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, i) => <TableRow key={i} item={item} currency={data.currency} />)}
        </tbody>
      </table>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ width: '320px' }}>
          <TotalsBlock data={data} currency={data.currency} />
        </div>
      </div>
      {data.grand_total > 0 && (
        <p style={{ margin: '12px 0', fontSize: '12px', color: '#666', fontStyle: 'italic' }}>Amount in words: {numberToWords(data.grand_total)} {data.currency}</p>
      )}
      {data.notes && (
        <div style={{ marginTop: '24px', padding: '16px', background: '#f8f9fb', borderRadius: '8px' }}>
          <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: '#4a90d9', textTransform: 'uppercase' }}>Notes</p>
          <p style={{ margin: '0', fontSize: '13px', color: '#666' }}>{data.notes}</p>
        </div>
      )}
      {data.terms && (
        <div style={{ marginTop: '12px', padding: '16px', background: '#f8f9fb', borderRadius: '8px' }}>
          <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: '#4a90d9', textTransform: 'uppercase' }}>Terms & Conditions</p>
          <p style={{ margin: '0', fontSize: '13px', color: '#666' }}>{data.terms}</p>
        </div>
      )}
      <div style={{ marginTop: '32px', paddingTop: '16px', borderTop: '1px solid #eee', textAlign: 'center', fontSize: '11px', color: '#999' }}>
        {data.company.website} | {data.company.email} | Thank you for your business!
      </div>
    </div>
  );
}

// ================================================================
// TEMPLATE 2: Clean Minimal
// ================================================================
export function CleanMinimal({ data }: TemplateProps) {
  return (
    <div style={{ fontFamily: "'Inter','Helvetica Neue',sans-serif", maxWidth: '800px', margin: '0 auto', padding: '48px', color: '#333' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px' }}>
        <div>
          <h1 style={{ margin: '0 0 2px', fontSize: '24px', fontWeight: 300, letterSpacing: '4px', color: '#111' }}>{data.company.name}</h1>
          <p style={{ margin: '2px 0', fontSize: '11px', color: '#888' }}>{data.company.address}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 300, letterSpacing: '3px', color: '#888' }}>INVOICE</p>
          <p style={{ margin: '1px 0', fontSize: '11px', color: '#888' }}>#{data.invoice_number}</p>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px', padding: '20px', border: '1px solid #eee', borderRadius: '4px' }}>
        <div><p style={{ margin: '0 0 6px', fontSize: '9px', fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '1px' }}>Bill To</p><p style={{ margin: '2px 0', fontSize: '13px', color: '#333' }}>{data.customer.name}<br/>{data.customer.email}</p></div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: '0 0 6px', fontSize: '9px', fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '1px' }}>Details</p>
          <p style={{ margin: '2px 0', fontSize: '12px', color: '#666' }}>Date: {formatDate(data.invoice_date)}<br/>Due: {formatDate(data.due_date)}</p>
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
        <thead><tr style={{ borderBottom: '2px solid #333' }}>
          <th style={{ padding: '10px 6px', fontSize: '11px', fontWeight: 600, color: '#666', textAlign: 'left' }}>ITEM</th>
          <th style={{ padding: '10px 6px', fontSize: '11px', fontWeight: 600, color: '#666', textAlign: 'center', width: '50px' }}>QTY</th>
          <th style={{ padding: '10px 6px', fontSize: '11px', fontWeight: 600, color: '#666', textAlign: 'right', width: '90px' }}>RATE</th>
          <th style={{ padding: '10px 6px', fontSize: '11px', fontWeight: 600, color: '#666', textAlign: 'right', width: '90px' }}>TOTAL</th>
        </tr></thead>
        <tbody>
          {data.items.map((item, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '10px 6px', fontSize: '13px' }}>{item.product}</td>
              <td style={{ padding: '10px 6px', fontSize: '13px', textAlign: 'center' }}>{item.quantity}</td>
              <td style={{ padding: '10px 6px', fontSize: '13px', textAlign: 'right' }}>{formatCurrency(item.unit_price, data.currency)}</td>
              <td style={{ padding: '10px 6px', fontSize: '13px', textAlign: 'right' }}>{formatCurrency(item.total, data.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <table style={{ width: '280px', borderCollapse: 'collapse' }}>
          <tbody>
            <tr><td style={{ padding: '6px', fontSize: '13px', color: '#666' }}>Subtotal</td><td style={{ padding: '6px', fontSize: '13px', textAlign: 'right' }}>{formatCurrency(data.subtotal, data.currency)}</td></tr>
            {data.discount > 0 && <tr><td style={{ padding: '6px', fontSize: '13px', color: '#e53e3e' }}>Discount</td><td style={{ padding: '6px', fontSize: '13px', textAlign: 'right' }}>-{formatCurrency(data.discount, data.currency)}</td></tr>}
            {data.total_tax > 0 && <tr><td style={{ padding: '6px', fontSize: '13px', color: '#666' }}>Tax</td><td style={{ padding: '6px', fontSize: '13px', textAlign: 'right' }}>{formatCurrency(data.total_tax, data.currency)}</td></tr>}
            <tr style={{ borderTop: '2px solid #333' }}>
              <td style={{ padding: '10px 6px', fontSize: '16px', fontWeight: 700 }}>Total</td>
              <td style={{ padding: '10px 6px', fontSize: '16px', fontWeight: 700, textAlign: 'right' }}>{formatCurrency(data.grand_total, data.currency)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: '40px', paddingTop: '16px', borderTop: '1px solid #eee', textAlign: 'center', fontSize: '11px', color: '#aaa' }}>{data.company.website} | {data.company.email}</div>
    </div>
  );
}

// ================================================================
// TEMPLATE 3: Professional Blue
// ================================================================
export function ProfessionalBlue({ data }: TemplateProps) {
  return (
    <div style={{ fontFamily: "'Inter','Segoe UI',sans-serif", maxWidth: '800px', margin: '0 auto', padding: '0', color: '#1e293b' }}>
      <div style={{ background: 'linear-gradient(135deg,#1e40af,#3b82f6)', padding: '32px 40px', color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><h1 style={{ margin: '0', fontSize: '22px', fontWeight: 700 }}>{data.company.name}</h1><p style={{ margin: '4px 0 0', fontSize: '12px', opacity: 0.8 }}>{data.company.address}</p></div>
          <div style={{ textAlign: 'right' }}><h2 style={{ margin: '0', fontSize: '28px', fontWeight: 800, opacity: 0.9 }}>INVOICE</h2><p style={{ margin: '4px 0 0', fontSize: '12px', opacity: 0.8 }}>#{data.invoice_number}</p></div>
        </div>
      </div>
      <div style={{ padding: '32px 40px', background: '#fff' }}>
        <div style={{ display: 'flex', gap: '24px', marginBottom: '32px' }}>
          <div style={{ flex: 1, padding: '16px', background: '#f0f4ff', borderRadius: '6px', borderLeft: '3px solid #3b82f6' }}>
            <p style={{ margin: '0 0 8px', fontSize: '10px', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase' }}>Bill To</p>
            <p style={{ margin: '2px 0', fontWeight: 600, fontSize: '14px' }}>{data.customer.name}</p>
            <p style={{ margin: '2px 0', fontSize: '12px', color: '#64748b' }}>{data.customer.email}<br/>{data.customer.mobile}</p>
          </div>
          <div style={{ flex: 1, padding: '16px', background: '#f8fafc', borderRadius: '6px' }}>
            <p style={{ margin: '0 0 8px', fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Details</p>
            <p style={{ margin: '2px 0', fontSize: '12px', color: '#64748b' }}>Date: {formatDate(data.invoice_date)}<br/>Due: {formatDate(data.due_date)}<br/>Status: <strong>{data.status.toUpperCase()}</strong></p>
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
          <thead><tr style={{ background: '#f1f5f9' }}>
            <th style={{ padding: '12px 8px', fontSize: '12px', fontWeight: 600, color: '#475569', textAlign: 'left' }}>ITEM</th>
            <th style={{ padding: '12px 8px', fontSize: '12px', fontWeight: 600, color: '#475569', textAlign: 'center', width: '60px' }}>QTY</th>
            <th style={{ padding: '12px 8px', fontSize: '12px', fontWeight: 600, color: '#475569', textAlign: 'right', width: '100px' }}>UNIT PRICE</th>
            <th style={{ padding: '12px 8px', fontSize: '12px', fontWeight: 600, color: '#475569', textAlign: 'right', width: '100px' }}>TOTAL</th>
          </tr></thead>
          <tbody>{data.items.map((item, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '10px 8px', fontSize: '13px' }}>{item.product}</td>
              <td style={{ padding: '10px 8px', fontSize: '13px', textAlign: 'center' }}>{item.quantity}</td>
              <td style={{ padding: '10px 8px', fontSize: '13px', textAlign: 'right' }}>{formatCurrency(item.unit_price, data.currency)}</td>
              <td style={{ padding: '10px 8px', fontSize: '13px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(item.total, data.currency)}</td>
            </tr>
          ))}</tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: '300px' }}><TotalsBlock data={data} currency={data.currency} /></div>
        </div>
        {data.notes && <div style={{ marginTop: '24px', padding: '16px', background: '#f8fafc', borderRadius: '6px', fontSize: '13px', color: '#64748b' }}><strong>Notes:</strong> {data.notes}</div>}
        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '11px', color: '#94a3b8' }}>{data.company.website} | {data.company.email}</div>
      </div>
    </div>
  );
}

// ================================================================
// TEMPLATE 4: Enterprise
// ================================================================
export function Enterprise({ data }: TemplateProps) {
  return (
    <div style={{ fontFamily: "'Inter','Segoe UI',sans-serif", maxWidth: '800px', margin: '0 auto', padding: '0', border: '1px solid #d1d5db' }}>
      <div style={{ background: '#111827', padding: '32px 40px 24px', color: '#fff', borderBottom: '4px solid #f59e0b' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div><h1 style={{ margin: '0', fontSize: '20px', fontWeight: 700, letterSpacing: '1px' }}>{data.company.name}</h1><p style={{ margin: '4px 0', fontSize: '11px', color: '#9ca3af' }}>{data.company.address}</p></div>
          <div style={{ textAlign: 'right' }}><h2 style={{ margin: '0', fontSize: '24px', fontWeight: 900, color: '#f59e0b' }}>INVOICE</h2><p style={{ margin: '4px 0 0', fontSize: '12px', color: '#9ca3af' }}>#{data.invoice_number}</p></div>
        </div>
      </div>
      <div style={{ padding: '32px 40px' }}>
        <div style={{ display: 'flex', gap: '24px', marginBottom: '32px' }}>
          <div style={{ flex: 1 }}><p style={{ fontSize: '10px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '8px' }}>Bill To</p><p style={{ fontSize: '14px', fontWeight: 600 }}>{data.customer.name}</p><p style={{ fontSize: '12px', color: '#6b7280' }}>{data.customer.email}<br/>{data.customer.address}</p></div>
          <div style={{ flex: 1, textAlign: 'right' }}><p style={{ fontSize: '10px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '8px' }}>Invoice Details</p><p style={{ fontSize: '12px', color: '#6b7280' }}>Date: {formatDate(data.invoice_date)}<br/>Due: {formatDate(data.due_date)}<br/>Status: <span style={{ color: data.status === 'paid' ? '#059669' : '#d97706', fontWeight: 600 }}>{data.status.toUpperCase()}</span></p></div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
          <thead><tr style={{ background: '#f3f4f6' }}>
            <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: 600, color: '#374151', textAlign: 'left' }}>DESCRIPTION</th>
            <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: 600, color: '#374151', textAlign: 'right', width: '80px' }}>QTY</th>
            <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: 600, color: '#374151', textAlign: 'right', width: '100px' }}>UNIT PRICE</th>
            <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: 600, color: '#374151', textAlign: 'right', width: '100px' }}>AMOUNT</th>
          </tr></thead>
          <tbody>{data.items.map((item, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '10px 8px', fontSize: '13px' }}>{item.product}{item.plan ? ` - ${item.plan}` : ''}</td>
              <td style={{ padding: '10px 8px', fontSize: '13px', textAlign: 'right' }}>{item.quantity}</td>
              <td style={{ padding: '10px 8px', fontSize: '13px', textAlign: 'right' }}>{formatCurrency(item.unit_price, data.currency)}</td>
              <td style={{ padding: '10px 8px', fontSize: '13px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(item.total, data.currency)}</td>
            </tr>
          ))}</tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <table style={{ width: '300px', borderCollapse: 'collapse' }}>
            <tbody>
              <tr><td style={{ padding: '6px 8px', fontSize: '13px', color: '#6b7280' }}>Subtotal</td><td style={{ padding: '6px 8px', fontSize: '13px', textAlign: 'right' }}>{formatCurrency(data.subtotal, data.currency)}</td></tr>
              {data.discount > 0 && <tr><td style={{ padding: '6px 8px', fontSize: '13px', color: '#dc2626' }}>Discount</td><td style={{ padding: '6px 8px', fontSize: '13px', textAlign: 'right' }}>-{formatCurrency(data.discount, data.currency)}</td></tr>}
              {data.is_gst && <><tr><td style={{ padding: '6px 8px', fontSize: '13px', color: '#6b7280' }}>CGST</td><td style={{ padding: '6px 8px', fontSize: '13px', textAlign: 'right' }}>{formatCurrency(data.cgst, data.currency)}</td></tr><tr><td style={{ padding: '6px 8px', fontSize: '13px', color: '#6b7280' }}>SGST</td><td style={{ padding: '6px 8px', fontSize: '13px', textAlign: 'right' }}>{formatCurrency(data.sgst, data.currency)}</td></tr></>}
              <tr style={{ borderTop: '2px solid #111827' }}><td style={{ padding: '10px 8px', fontSize: '16px', fontWeight: 700 }}>Total Due</td><td style={{ padding: '10px 8px', fontSize: '16px', fontWeight: 700, textAlign: 'right', color: '#059669' }}>{formatCurrency(data.grand_total, data.currency)}</td></tr>
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: '32px', padding: '16px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '4px', fontSize: '12px', color: '#6b7280' }}>
          <p style={{ margin: '0 0 4px', fontWeight: 600, color: '#374151' }}>Terms</p>
          <p style={{ margin: '0' }}>{data.terms || 'Payment due within 30 days. Thank you for your business.'}</p>
        </div>
      </div>
    </div>
  );
}

// ================================================================
// TEMPLATE 5: Glass UI
// ================================================================
export function GlassUI({ data }: TemplateProps) {
  return (
    <div style={{ fontFamily: "'Inter','Segoe UI',sans-serif", maxWidth: '800px', margin: '0 auto', padding: '0', background: 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)', minHeight: '600px' }}>
      <div style={{ padding: '40px', margin: '0', backdropFilter: 'blur(20px)', background: 'rgba(255,255,255,0.15)' }}>
        <div style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: '16px', padding: '36px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '28px' }}>
            <div><h1 style={{ margin: '0', fontSize: '20px', fontWeight: 700, background: 'linear-gradient(135deg,#667eea,#764ba2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{data.company.name}</h1><p style={{ margin: '4px 0', fontSize: '11px', color: '#888' }}>{data.company.address}</p></div>
            <div style={{ textAlign: 'right' }}><h2 style={{ margin: '0', fontSize: '22px', fontWeight: 800, color: '#667eea' }}>INVOICE</h2><p style={{ margin: '2px 0', fontSize: '12px', color: '#888' }}>#{data.invoice_number}</p></div>
          </div>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
            <div style={{ flex: 1, padding: '16px', background: '#f8f9ff', borderRadius: '12px' }}><p style={{ margin: '0 0 6px', fontSize: '10px', fontWeight: 700, color: '#667eea', textTransform: 'uppercase' }}>Bill To</p><p style={{ margin: '2px 0', fontWeight: 600, fontSize: '13px' }}>{data.customer.name}</p><p style={{ margin: '2px 0', fontSize: '12px', color: '#666' }}>{data.customer.email}</p></div>
            <div style={{ flex: 1, padding: '16px', background: '#f8f9ff', borderRadius: '12px' }}><p style={{ margin: '0 0 6px', fontSize: '10px', fontWeight: 700, color: '#667eea', textTransform: 'uppercase' }}>Dates</p><p style={{ margin: '2px 0', fontSize: '12px', color: '#666' }}>Issued: {formatDate(data.invoice_date)}<br/>Due: {formatDate(data.due_date)}</p></div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
            <thead><tr style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', color: '#fff' }}>
              <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: 600, textAlign: 'left', borderRadius: '8px 0 0 0' }}>ITEM</th>
              <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: 600, textAlign: 'center', width: '50px' }}>QTY</th>
              <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: 600, textAlign: 'right', width: '90px' }}>PRICE</th>
              <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: 600, textAlign: 'right', width: '90px', borderRadius: '0 8px 0 0' }}>TOTAL</th>
            </tr></thead>
            <tbody>{data.items.map((item, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f0f0ff' }}>
                <td style={{ padding: '10px 8px', fontSize: '13px' }}>{item.product}</td>
                <td style={{ padding: '10px 8px', fontSize: '13px', textAlign: 'center' }}>{item.quantity}</td>
                <td style={{ padding: '10px 8px', fontSize: '13px', textAlign: 'right' }}>{formatCurrency(item.unit_price, data.currency)}</td>
                <td style={{ padding: '10px 8px', fontSize: '13px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(item.total, data.currency)}</td>
              </tr>
            ))}</tbody>
          </table>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ width: '280px' }}><TotalsBlock data={data} currency={data.currency} /></div>
          </div>
          <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '11px', color: '#aaa' }}>{data.company.website} | {data.company.email}</div>
        </div>
      </div>
    </div>
  );
}

// ================================================================
// TEMPLATE 6: Elegant Dark
// ================================================================
export function ElegantDark({ data }: TemplateProps) {
  return (
    <div style={{ fontFamily: "'Inter','Segoe UI',sans-serif", maxWidth: '800px', margin: '0 auto', padding: '0', background: '#0f0f13', color: '#e2e8f0' }}>
      <div style={{ padding: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px', paddingBottom: '24px', borderBottom: '1px solid #1e1e2a' }}>
          <div><h1 style={{ margin: '0', fontSize: '18px', fontWeight: 300, letterSpacing: '3px', color: '#a78bfa' }}>{data.company.name}</h1><p style={{ margin: '4px 0 0', fontSize: '11px', color: '#6b7280' }}>{data.company.address}</p></div>
          <div style={{ textAlign: 'right' }}><h2 style={{ margin: '0', fontSize: '28px', fontWeight: 200, color: '#a78bfa', letterSpacing: '6px' }}>INVOICE</h2><p style={{ margin: '4px 0 0', fontSize: '12px', color: '#6b7280' }}>#{data.invoice_number}</p></div>
        </div>
        <div style={{ display: 'flex', gap: '24px', marginBottom: '32px' }}>
          <div style={{ flex: 1, padding: '20px', border: '1px solid #1e1e2a', borderRadius: '8px' }}>
            <p style={{ margin: '0 0 8px', fontSize: '9px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '2px' }}>Bill To</p>
            <p style={{ margin: '2px 0', fontSize: '14px', fontWeight: 500, color: '#f1f5f9' }}>{data.customer.name}</p>
            <p style={{ margin: '2px 0', fontSize: '12px', color: '#6b7280' }}>{data.customer.email}<br/>{data.customer.address}</p>
          </div>
          <div style={{ flex: 1, padding: '20px', border: '1px solid #1e1e2a', borderRadius: '8px', textAlign: 'right' }}>
            <p style={{ margin: '0 0 8px', fontSize: '9px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '2px' }}>Details</p>
            <p style={{ margin: '2px 0', fontSize: '12px', color: '#6b7280' }}>Date: {formatDate(data.invoice_date)}<br/>Due: {formatDate(data.due_date)}</p>
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
          <thead><tr style={{ borderBottom: '1px solid #1e1e2a' }}>
            <th style={{ padding: '10px 8px', fontSize: '10px', fontWeight: 600, color: '#6b7280', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '1px' }}>Item</th>
            <th style={{ padding: '10px 8px', fontSize: '10px', fontWeight: 600, color: '#6b7280', textAlign: 'center', width: '50px', textTransform: 'uppercase', letterSpacing: '1px' }}>Qty</th>
            <th style={{ padding: '10px 8px', fontSize: '10px', fontWeight: 600, color: '#6b7280', textAlign: 'right', width: '90px', textTransform: 'uppercase', letterSpacing: '1px' }}>Rate</th>
            <th style={{ padding: '10px 8px', fontSize: '10px', fontWeight: 600, color: '#6b7280', textAlign: 'right', width: '90px', textTransform: 'uppercase', letterSpacing: '1px' }}>Amount</th>
          </tr></thead>
          <tbody>{data.items.map((item, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #1e1e2a' }}>
              <td style={{ padding: '10px 8px', fontSize: '13px', color: '#e2e8f0' }}>{item.product}</td>
              <td style={{ padding: '10px 8px', fontSize: '13px', textAlign: 'center', color: '#94a3b8' }}>{item.quantity}</td>
              <td style={{ padding: '10px 8px', fontSize: '13px', textAlign: 'right', color: '#94a3b8' }}>{formatCurrency(item.unit_price, data.currency)}</td>
              <td style={{ padding: '10px 8px', fontSize: '13px', textAlign: 'right', fontWeight: 600, color: '#a78bfa' }}>{formatCurrency(item.total, data.currency)}</td>
            </tr>
          ))}</tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <table style={{ width: '280px', borderCollapse: 'collapse' }}>
            <tbody>
              <tr><td style={{ padding: '6px 8px', fontSize: '13px', color: '#6b7280' }}>Subtotal</td><td style={{ padding: '6px 8px', fontSize: '13px', color: '#94a3b8', textAlign: 'right' }}>{formatCurrency(data.subtotal, data.currency)}</td></tr>
              <tr style={{ borderTop: '1px solid #1e1e2a' }}><td style={{ padding: '10px 8px', fontSize: '15px', fontWeight: 700, color: '#a78bfa' }}>Total Due</td><td style={{ padding: '10px 8px', fontSize: '15px', fontWeight: 700, color: '#a78bfa', textAlign: 'right' }}>{formatCurrency(data.grand_total, data.currency)}</td></tr>
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: '32px', textAlign: 'center', fontSize: '11px', color: '#4b5563' }}>{data.company.website} | {data.company.email}</div>
      </div>
    </div>
  );
}

// ================================================================
// TEMPLATE 7: Classic Business
// ================================================================
export function ClassicBusiness({ data }: TemplateProps) {
  return (
    <div style={{ fontFamily: "'Times New Roman','Georgia',serif", maxWidth: '800px', margin: '0 auto', padding: '40px', color: '#222', border: '2px solid #222' }}>
      <div style={{ textAlign: 'center', marginBottom: '24px', paddingBottom: '16px', borderBottom: '2px double #222' }}>
        <h1 style={{ margin: '0', fontSize: '26px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px' }}>{data.company.name}</h1>
        <p style={{ margin: '4px 0', fontSize: '12px', color: '#555' }}>{data.company.address} | {data.company.contact}</p>
        <p style={{ margin: '2px 0', fontSize: '12px', color: '#555' }}>{data.company.email} | {data.company.website}</p>
        {data.company.gstin && <p style={{ margin: '2px 0', fontSize: '12px', color: '#555' }}>GSTIN: {data.company.gstin}</p>}
        <h2 style={{ margin: '16px 0 0', fontSize: '30px', fontWeight: 700, letterSpacing: '8px' }}>INVOICE</h2>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div><p style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>Bill To:</p><p style={{ margin: '2px 0', fontSize: '13px' }}>{data.customer.name}<br/>{data.customer.address}<br/>{data.customer.email}</p></div>
        <div style={{ textAlign: 'right' }}><p style={{ margin: '2px 0', fontSize: '13px' }}>Invoice #: <strong>{data.invoice_number}</strong></p><p style={{ margin: '2px 0', fontSize: '13px' }}>Date: {formatDate(data.invoice_date)}</p><p style={{ margin: '2px 0', fontSize: '13px' }}>Due: {formatDate(data.due_date)}</p></div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', border: '1px solid #222' }}>
        <thead><tr style={{ background: '#222', color: '#fff' }}>
          <th style={{ padding: '8px', fontSize: '12px', fontWeight: 600, textAlign: 'left', border: '1px solid #222' }}>ITEM</th>
          <th style={{ padding: '8px', fontSize: '12px', fontWeight: 600, textAlign: 'center', border: '1px solid #222', width: '60px' }}>QTY</th>
          <th style={{ padding: '8px', fontSize: '12px', fontWeight: 600, textAlign: 'right', border: '1px solid #222', width: '100px' }}>RATE</th>
          <th style={{ padding: '8px', fontSize: '12px', fontWeight: 600, textAlign: 'right', border: '1px solid #222', width: '100px' }}>AMOUNT</th>
        </tr></thead>
        <tbody>{data.items.map((item, i) => (
          <tr key={i}>
            <td style={{ padding: '8px', fontSize: '13px', border: '1px solid #ddd' }}>{item.product}</td>
            <td style={{ padding: '8px', fontSize: '13px', textAlign: 'center', border: '1px solid #ddd' }}>{item.quantity}</td>
            <td style={{ padding: '8px', fontSize: '13px', textAlign: 'right', border: '1px solid #ddd' }}>{formatCurrency(item.unit_price, data.currency)}</td>
            <td style={{ padding: '8px', fontSize: '13px', textAlign: 'right', border: '1px solid #ddd', fontWeight: 600 }}>{formatCurrency(item.total, data.currency)}</td>
          </tr>
        ))}</tbody>
      </table>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <table style={{ width: '280px', borderCollapse: 'collapse' }}>
          <tbody>
            <tr><td style={{ padding: '5px 8px', fontSize: '13px' }}>Subtotal:</td><td style={{ padding: '5px 8px', fontSize: '13px', textAlign: 'right' }}>{formatCurrency(data.subtotal, data.currency)}</td></tr>
            {data.discount > 0 && <tr><td style={{ padding: '5px 8px', fontSize: '13px' }}>Discount:</td><td style={{ padding: '5px 8px', fontSize: '13px', textAlign: 'right' }}>-{formatCurrency(data.discount, data.currency)}</td></tr>}
            {data.total_tax > 0 && <tr><td style={{ padding: '5px 8px', fontSize: '13px' }}>Tax:</td><td style={{ padding: '5px 8px', fontSize: '13px', textAlign: 'right' }}>{formatCurrency(data.total_tax, data.currency)}</td></tr>}
            <tr style={{ borderTop: '2px solid #222' }}><td style={{ padding: '8px', fontSize: '16px', fontWeight: 700 }}>TOTAL:</td><td style={{ padding: '8px', fontSize: '16px', fontWeight: 700, textAlign: 'right' }}>{formatCurrency(data.grand_total, data.currency)}</td></tr>
          </tbody>
        </table>
      </div>
      <p style={{ marginTop: '16px', fontSize: '12px', color: '#555', fontStyle: 'italic' }}>{numberToWords(data.grand_total)} {data.currency}</p>
      {data.notes && <p style={{ marginTop: '16px', fontSize: '12px', color: '#555' }}><strong>Notes:</strong> {data.notes}</p>}
      <div style={{ marginTop: '24px', paddingTop: '12px', borderTop: '1px solid #ddd', textAlign: 'center', fontSize: '11px', color: '#888' }}>Thank you for your business!</div>
    </div>
  );
}

// ================================================================
// TEMPLATE 8: Startup Style
// ================================================================
export function StartupStyle({ data }: TemplateProps) {
  return (
    <div style={{ fontFamily: "'Inter','Segoe UI',sans-serif", maxWidth: '800px', margin: '0 auto', padding: '0', background: '#fff' }}>
      <div style={{ padding: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
          <div><h1 style={{ margin: '0', fontSize: '16px', fontWeight: 800, color: '#0891b2', textTransform: 'lowercase' }}>{data.company.name}</h1><p style={{ margin: '2px 0', fontSize: '10px', color: '#94a3b8' }}>{data.company.address}</p></div>
          <div style={{ background: '#0891b2', color: '#fff', padding: '8px 24px', borderRadius: '6px' }}><h2 style={{ margin: '0', fontSize: '18px', fontWeight: 800 }}>INVOICE</h2></div>
        </div>
        <div style={{ display: 'flex', gap: '24px', marginBottom: '28px' }}>
          <div style={{ flex: 1, background: '#f0fdfa', padding: '16px', borderRadius: '8px', borderLeft: '3px solid #14b8a6' }}>
            <p style={{ margin: '0 0 6px', fontSize: '10px', fontWeight: 700, color: '#0d9488', textTransform: 'uppercase' }}>Client</p>
            <p style={{ margin: '2px 0', fontWeight: 600, fontSize: '14px' }}>{data.customer.name}</p>
            <p style={{ margin: '2px 0', fontSize: '12px', color: '#64748b' }}>{data.customer.email}</p>
          </div>
          <div style={{ flex: 1 }}>
            <table style={{ width: '100%' }}>
              <tbody>
                <tr><td style={{ padding: '4px 8px', fontSize: '12px', color: '#64748b' }}>Invoice</td><td style={{ padding: '4px 8px', fontSize: '12px', fontWeight: 600, textAlign: 'right' }}>{data.invoice_number}</td></tr>
                <tr><td style={{ padding: '4px 8px', fontSize: '12px', color: '#64748b' }}>Date</td><td style={{ padding: '4px 8px', fontSize: '12px', textAlign: 'right' }}>{formatDate(data.invoice_date)}</td></tr>
                <tr><td style={{ padding: '4px 8px', fontSize: '12px', color: '#64748b' }}>Due</td><td style={{ padding: '4px 8px', fontSize: '12px', textAlign: 'right' }}>{formatDate(data.due_date)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
          <thead><tr style={{ background: '#f1f5f9' }}>
            <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: 600, color: '#475569', textAlign: 'left' }}>ITEM</th>
            <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: 600, color: '#475569', textAlign: 'center', width: '50px' }}>QTY</th>
            <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: 600, color: '#475569', textAlign: 'right', width: '90px' }}>PRICE</th>
            <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: 600, color: '#475569', textAlign: 'right', width: '90px' }}>TOTAL</th>
          </tr></thead>
          <tbody>{data.items.map((item, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '10px 8px', fontSize: '13px' }}>{item.product}{item.plan ? ` (${item.plan})` : ''}</td>
              <td style={{ padding: '10px 8px', fontSize: '13px', textAlign: 'center' }}>{item.quantity}</td>
              <td style={{ padding: '10px 8px', fontSize: '13px', textAlign: 'right' }}>{formatCurrency(item.unit_price, data.currency)}</td>
              <td style={{ padding: '10px 8px', fontSize: '13px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(item.total, data.currency)}</td>
            </tr>
          ))}</tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: '280px' }}><TotalsBlock data={data} currency={data.currency} /></div>
        </div>
        <div style={{ marginTop: '24px', padding: '12px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', fontSize: '12px', color: '#92400e' }}>
          <strong>📌 {data.notes || 'Thank you for choosing ' + data.company.name + '!'}</strong>
        </div>
        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '11px', color: '#94a3b8' }}>{data.company.website} | {data.company.email}</div>
      </div>
    </div>
  );
}

// ================================================================
// TEMPLATE 9: Marketplace Style (Amazon-inspired)
// ================================================================
export function MarketplaceStyle({ data }: TemplateProps) {
  return (
    <div style={{ fontFamily: "'Inter','Segoe UI',sans-serif", maxWidth: '800px', margin: '0 auto', padding: '0', background: '#f3f4f6' }}>
      <div style={{ background: '#131921', padding: '20px 32px', color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: '0', fontSize: '22px', fontWeight: 700 }}>{data.company.name}</h1>
          <span style={{ fontSize: '13px', opacity: 0.8 }}>Invoice #{data.invoice_number}</span>
        </div>
      </div>
      <div style={{ background: '#232f3e', padding: '12px 32px', color: '#ddd', fontSize: '13px' }}>
        {data.company.address} | {data.company.email}
      </div>
      <div style={{ padding: '24px 32px', background: '#fff', margin: '16px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', gap: '24px', marginBottom: '24px' }}>
          <div style={{ flex: 1 }}><p style={{ fontSize: '12px', fontWeight: 700, color: '#232f3e', marginBottom: '4px' }}>Sold to:</p><p style={{ fontSize: '13px', color: '#555' }}>{data.customer.name}<br/>{data.customer.email}<br/>{data.customer.mobile}</p></div>
          <div style={{ flex: 1, textAlign: 'right' }}><p style={{ fontSize: '12px', fontWeight: 700, color: '#232f3e', marginBottom: '4px' }}>Order Details:</p><p style={{ fontSize: '13px', color: '#555' }}>Date: {formatDate(data.invoice_date)}<br/>{data.order_number ? `Order: ${data.order_number}` : ''}<br/>Status: <span style={{ color: data.status === 'paid' ? '#059669' : '#b45309', fontWeight: 600 }}>{data.status.toUpperCase()}</span></p></div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
          <thead><tr style={{ background: '#f3f4f6' }}>
            <th style={{ padding: '10px 8px', fontSize: '12px', fontWeight: 600, color: '#374151', textAlign: 'left' }}>Product</th>
            <th style={{ padding: '10px 8px', fontSize: '12px', fontWeight: 600, color: '#374151', textAlign: 'center', width: '50px' }}>Qty</th>
            <th style={{ padding: '10px 8px', fontSize: '12px', fontWeight: 600, color: '#374151', textAlign: 'right', width: '100px' }}>Price</th>
            <th style={{ padding: '10px 8px', fontSize: '12px', fontWeight: 600, color: '#374151', textAlign: 'right', width: '100px' }}>Total</th>
          </tr></thead>
          <tbody>{data.items.map((item, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '10px 8px', fontSize: '13px' }}>{item.product}{item.plan ? <span style={{ color: '#6b7280' }}> - {item.plan}</span> : ''}</td>
              <td style={{ padding: '10px 8px', fontSize: '13px', textAlign: 'center' }}>{item.quantity}</td>
              <td style={{ padding: '10px 8px', fontSize: '13px', textAlign: 'right' }}>{formatCurrency(item.unit_price, data.currency)}</td>
              <td style={{ padding: '10px 8px', fontSize: '13px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(item.total, data.currency)}</td>
            </tr>
          ))}</tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: '300px', borderTop: '2px solid #131921', paddingTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px', color: '#6b7280' }}><span>Subtotal</span><span>{formatCurrency(data.subtotal, data.currency)}</span></div>
            {data.discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px', color: '#dc2626' }}><span>Discount</span><span>-{formatCurrency(data.discount, data.currency)}</span></div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px', color: '#6b7280' }}><span>Tax</span><span>{formatCurrency(data.total_tax, data.currency)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e5e7eb', fontSize: '18px', fontWeight: 700, color: '#131921' }}><span>Total</span><span>{formatCurrency(data.grand_total, data.currency)}</span></div>
          </div>
        </div>
        <div style={{ marginTop: '24px', padding: '12px', background: '#f0fdf4', borderRadius: '6px', fontSize: '13px', color: '#166534', textAlign: 'center' }}>
          🛡️ {data.terms || 'Your purchase is protected. Thank you for choosing ' + data.company.name + '!'}
        </div>
      </div>
      <div style={{ padding: '16px 32px', textAlign: 'center', fontSize: '11px', color: '#9ca3af' }}>{data.company.website} | {data.company.email}</div>
    </div>
  );
}

// ================================================================
// TEMPLATE 10: Thermal Receipt
// ================================================================
export function ThermalReceipt({ data }: TemplateProps) {
  const width = data.paper_format === 'thermal-58' ? '280px' : '380px';
  const fontSize = data.paper_format === 'thermal-58' ? '11px' : '12px';
  const headerFont = data.paper_format === 'thermal-58' ? '14px' : '16px';
  return (
    <div style={{ fontFamily: "'Courier New','Courier',monospace", maxWidth: width, margin: '0 auto', padding: '16px 12px', color: '#000', background: '#fff' }}>
      <div style={{ textAlign: 'center', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px dashed #000' }}>
        <h1 style={{ margin: '0', fontSize: headerFont, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>{data.company.name}</h1>
        <p style={{ margin: '2px 0', fontSize }}>{data.company.address}</p>
        <p style={{ margin: '2px 0', fontSize }}>{data.company.contact}</p>
        <p style={{ margin: '2px 0', fontSize }}>{data.company.email}</p>
        {data.company.gstin && <p style={{ margin: '2px 0', fontSize }}>GST: {data.company.gstin}</p>}
        <div style={{ margin: '8px 0', borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '4px 0' }}>
          <p style={{ margin: '0', fontSize: '13px', fontWeight: 700, letterSpacing: '3px' }}>TAX INVOICE</p>
          <p style={{ margin: '2px 0', fontSize }}>#{data.invoice_number}</p>
        </div>
        <p style={{ margin: '2px 0', fontSize }}>Date: {formatDate(data.invoice_date)}</p>
        {data.order_number && <p style={{ margin: '2px 0', fontSize }}>Order: {data.order_number}</p>}
      </div>
      <div style={{ marginBottom: '8px', padding: '4px 0', borderBottom: '1px dashed #000' }}>
        <p style={{ margin: '0 0 2px', fontSize, fontWeight: 700 }}>Customer: {data.customer.name}</p>
        <p style={{ margin: '0', fontSize }}>{data.customer.email}</p>
        <p style={{ margin: '0', fontSize }}>{data.customer.mobile}</p>
      </div>
      <table style={{ width: '100%', fontSize, borderCollapse: 'collapse' }}>
        <thead><tr style={{ borderBottom: '1px dashed #000' }}>
          <th style={{ padding: '4px 2px', textAlign: 'left' }}>ITEM</th>
          <th style={{ padding: '4px 2px', textAlign: 'center', width: '30px' }}>QTY</th>
          <th style={{ padding: '4px 2px', textAlign: 'right', width: '70px' }}>AMOUNT</th>
        </tr></thead>
        <tbody>{data.items.map((item, i) => (
          <tr key={i}>
            <td style={{ padding: '3px 2px' }}>{item.product}</td>
            <td style={{ padding: '3px 2px', textAlign: 'center' }}>{item.quantity}</td>
            <td style={{ padding: '3px 2px', textAlign: 'right' }}>{formatCurrency(item.total, data.currency)}</td>
          </tr>
        ))}</tbody>
      </table>
      <div style={{ margin: '8px 0', padding: '4px 0', borderTop: '1px dashed #000' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize }}><span>Subtotal</span><span>{formatCurrency(data.subtotal, data.currency)}</span></div>
        {data.discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize }}><span>Discount</span><span>-{formatCurrency(data.discount, data.currency)}</span></div>}
        {data.is_gst && <><div style={{ display: 'flex', justifyContent: 'space-between', fontSize }}><span>CGST</span><span>{formatCurrency(data.cgst, data.currency)}</span></div><div style={{ display: 'flex', justifyContent: 'space-between', fontSize }}><span>SGST</span><span>{formatCurrency(data.sgst, data.currency)}</span></div></>}
        {!data.is_gst && data.total_tax > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize }}><span>Tax</span><span>{formatCurrency(data.total_tax, data.currency)}</span></div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700, marginTop: '4px', paddingTop: '4px', borderTop: '1px dashed #000' }}>
          <span>TOTAL</span><span>{formatCurrency(data.grand_total, data.currency)}</span>
        </div>
      </div>
      {data.payment_method && (
        <div style={{ margin: '8px 0', padding: '4px 0', borderTop: '1px dashed #000', fontSize }}>
          <p style={{ margin: '2px 0' }}>Payment: {data.payment_method}</p>
          {data.transaction_id && <p style={{ margin: '2px 0' }}>Txn: {data.transaction_id}</p>}
          <p style={{ margin: '2px 0' }}>Status: {data.status.toUpperCase()}</p>
        </div>
      )}
      <div style={{ textAlign: 'center', marginTop: '12px', paddingTop: '8px', borderTop: '1px dashed #000', fontSize: '10px' }}>
        <p style={{ margin: '2px 0' }}>{data.terms || 'Thank you for your purchase!'}</p>
        <p style={{ margin: '2px 0' }}>{data.company.website}</p>
        <p style={{ margin: '4px 0 0', fontSize: '9px' }}>*** Powered by WebSmith Digital ***</p>
      </div>
    </div>
  );
}

export function getInvoiceTemplate(template: string, data: InvoiceData, thermal?: boolean) {
  const props = { data, thermal };
  switch (template) {
    case 'modern-corporate': return <ModernCorporate {...props} />;
    case 'clean-minimal': return <CleanMinimal {...props} />;
    case 'professional-blue': return <ProfessionalBlue {...props} />;
    case 'enterprise': return <Enterprise {...props} />;
    case 'glass-ui': return <GlassUI {...props} />;
    case 'elegant-dark': return <ElegantDark {...props} />;
    case 'classic-business': return <ClassicBusiness {...props} />;
    case 'startup-style': return <StartupStyle {...props} />;
    case 'marketplace-style': return <MarketplaceStyle {...props} />;
    case 'thermal-receipt': return <ThermalReceipt {...props} />;
    default: return <ModernCorporate {...props} />;
  }
}
