'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Plus, Search, Mail, CheckCircle, XCircle, Eye, Download, Trash2, MoreHorizontal, Loader2 } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/invoice/utils';
import { INVOICE_TEMPLATES } from '@/lib/invoice/types';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-500/20 text-gray-400',
  sent: 'bg-blue-500/20 text-blue-400',
  paid: 'bg-emerald-500/20 text-emerald-400',
  overdue: 'bg-red-500/20 text-red-400',
  cancelled: 'bg-yellow-500/20 text-yellow-400',
  refunded: 'bg-purple-500/20 text-purple-400',
};

interface Invoice {
  id: number;
  invoice_number: string;
  customer_name: string;
  customer_email: string;
  status: string;
  total: number;
  currency: string;
  template_name: string;
  is_gst: boolean;
  due_date: string;
  created_at: string;
  product_name: string;
  plan_name: string;
}

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const limit = 20;

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (search) params.set('search', search);
      params.set('limit', String(limit));
      params.set('offset', String(page * limit));
      const res = await fetch(`/internal/backend/admin/invoices?${params}`);
      const data = await res.json();
      if (data.success) {
        setInvoices(data.invoices);
        setTotal(data.total);
      }
    } catch (e) {
      console.error('Failed to fetch invoices', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInvoices(); }, [statusFilter, page]);

  const handleAction = async (id: number, action: string) => {
    setActionLoading(id);
    try {
      await fetch(`/internal/backend/admin/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      fetchInvoices();
    } catch (e) {
      console.error('Action failed', e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchInvoices();
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-[var(--accent)]" />
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Invoices</h1>
            <p className="text-sm text-[var(--text-secondary)]">{total} total invoices</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/internal/api/sales/invoices/new')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90"
          >
            <Plus className="w-4 h-4" /> New Invoice
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by invoice#, customer, email..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm outline-none focus:border-blue-500"
          />
        </form>
        <select
          value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
          className="px-3 py-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm outline-none"
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="cancelled">Cancelled</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 mx-auto mb-3 text-[var(--text-muted)] opacity-30" />
          <p className="text-[var(--text-secondary)]">No invoices found</p>
          <button onClick={() => router.push('/internal/api/sales/invoices/new')} className="mt-3 text-sm text-blue-500 hover:underline">Create your first invoice</button>
        </div>
      ) : (
        <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-color)]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Invoice</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Product</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Amount</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Date</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id} className="border-b border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]/30 transition-colors">
                  <td className="px-4 py-3">
                    <button onClick={() => router.push(`/internal/api/sales/invoices/${inv.id}`)} className="text-sm font-medium text-blue-500 hover:underline">
                      {inv.invoice_number}
                    </button>
                    <p className="text-xs text-[var(--text-secondary)]">{inv.template_name?.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{inv.customer_name || 'N/A'}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{inv.customer_email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-[var(--text-primary)]">{inv.product_name || '-'}</p>
                    {inv.plan_name && <p className="text-xs text-[var(--text-secondary)]">{inv.plan_name}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[inv.status] || 'bg-gray-500/20 text-gray-400'}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-[var(--text-primary)]">
                    {formatCurrency(Number(inv.total), inv.currency)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-[var(--text-secondary)]">
                    {formatDate(inv.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => router.push(`/internal/api/sales/invoices/${inv.id}`)} className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)]" title="View">
                        <Eye className="w-4 h-4 text-[var(--text-secondary)]" />
                      </button>
                      <button onClick={() => router.push(`/internal/api/sales/invoices/${inv.id}/print`)} className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)]" title="Print">
                        <Download className="w-4 h-4 text-[var(--text-secondary)]" />
                      </button>
                      {inv.status === 'draft' && (
                        <button onClick={() => handleAction(inv.id, 'send-email')} disabled={actionLoading === inv.id} className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)]" title="Send Email">
                          {actionLoading === inv.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4 text-[var(--text-secondary)]" />}
                        </button>
                      )}
                      {inv.status === 'sent' && (
                        <button onClick={() => handleAction(inv.id, 'mark-paid')} disabled={actionLoading === inv.id} className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)]" title="Mark Paid">
                          {actionLoading === inv.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 text-emerald-500" />}
                        </button>
                      )}
                      {(inv.status === 'draft' || inv.status === 'sent') && (
                        <button onClick={() => handleAction(inv.id, 'cancel')} disabled={actionLoading === inv.id} className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)]" title="Cancel">
                          <XCircle className="w-4 h-4 text-red-500" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-color)]">
              <span className="text-sm text-[var(--text-secondary)]">Page {page + 1} of {totalPages}</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1.5 rounded-lg text-sm border border-[var(--border-color)] disabled:opacity-40">Previous</button>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1.5 rounded-lg text-sm border border-[var(--border-color)] disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
