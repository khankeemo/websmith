"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Inbox, Search, RefreshCw, Loader2, AlertCircle, Mail, Filter, ChevronDown, ChevronUp, Clock, CheckCircle, XCircle, MessageSquare } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";

const REQUEST_TYPES = ['ALL', 'BUY', 'RENEW', 'SUPPORT', 'ACTIVATION', 'DEVICE_REPLACEMENT', 'HARDWARE', 'GENERAL'];
const STATUSES = ['ALL', 'open', 'pending', 'resolved', 'closed'];

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  pending: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  resolved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  closed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

export default function RequestCenterPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const [updating, setUpdating] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (typeFilter !== 'ALL') params.set('request_type', typeFilter);
      params.set('limit', '100');

      const res = await fetch(`/api/v1/admin/requests?${params}`);
      const data = await res.json();
      if (data.success) {
        setRequests(data.data.requests);
      } else {
        setError(data.error?.message || 'Failed to load requests');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const filtered = requests.filter(r => {
    if (search) {
      const q = search.toLowerCase();
      const match = r.request_id?.toLowerCase().includes(q) ||
        r.customer_name?.toLowerCase().includes(q) ||
        r.customer_email?.toLowerCase().includes(q) ||
        r.subject?.toLowerCase().includes(q) ||
        r.message?.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const handleUpdateStatus = async (requestId: string, newStatus: string) => {
    setUpdating(true);
    try {
      const res = await fetch('/api/v1/admin/requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: requestId,
          status: newStatus,
          admin_notes: adminNotes || undefined,
          reply_message: replyMessage || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDetailOpen(false);
        setSelectedRequest(null);
        setAdminNotes('');
        setReplyMessage('');
        fetchRequests();
      }
    } catch (err: any) {
      console.error('Update error:', err);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Request Center</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Manage all customer requests from the Universal License Center
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={fetchRequests} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search by ID, name, email, subject..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-sm"
        >
          {STATUSES.map(s => (
            <option key={s} value={s}>{s === 'ALL' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-sm"
        >
          {REQUEST_TYPES.map(t => (
            <option key={t} value={t}>{t === 'ALL' ? 'All Types' : t.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      )}

      {error && (
        <Card className="p-6">
          <div className="flex items-center gap-3 text-red-500">
            <AlertCircle className="w-5 h-5" />
            <p>{error}</p>
          </div>
        </Card>
      )}

      {!loading && !error && filtered.length === 0 && (
        <Card className="p-12">
          <div className="flex flex-col items-center gap-4 text-[var(--text-muted)]">
            <Inbox className="w-12 h-12" />
            <p className="text-lg">No requests found</p>
          </div>
        </Card>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((req) => (
            <Card
              key={req.id}
              className="p-4 cursor-pointer hover:border-blue-500/50 transition-colors"
              onClick={() => {
                setSelectedRequest(req);
                setAdminNotes(req.admin_notes || '');
                setReplyMessage('');
                setDetailOpen(true);
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-[var(--text-muted)]">{req.request_id}</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[req.status] || STATUS_COLORS.open}`}>
                      {req.status}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                      {req.request_type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <h3 className="font-medium text-[var(--text-primary)] truncate">{req.subject}</h3>
                  <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mt-1">{req.message}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-[var(--text-muted)]">
                    {req.customer_name && <span>{req.customer_name}</span>}
                    {req.customer_email && <span>{req.customer_email}</span>}
                    {req.product_name && <span>{req.product_name}</span>}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(req.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={detailOpen}
        onClose={() => { setDetailOpen(false); setSelectedRequest(null); }}
        title="Request Details"
      >
        {selectedRequest && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[selectedRequest.status] || STATUS_COLORS.open}`}>
                {selectedRequest.status}
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                {selectedRequest.request_type.replace(/_/g, ' ')}
              </span>
            </div>

            <div className="text-sm text-[var(--text-muted)] font-mono">{selectedRequest.request_id}</div>

            <div>
              <label className="text-sm font-medium text-[var(--text-primary)]">Subject</label>
              <p className="text-sm text-[var(--text-secondary)]">{selectedRequest.subject}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-[var(--text-primary)]">Message</label>
              <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{selectedRequest.message}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              {selectedRequest.customer_name && (
                <div>
                  <label className="font-medium text-[var(--text-primary)]">Name</label>
                  <p className="text-[var(--text-secondary)]">{selectedRequest.customer_name}</p>
                </div>
              )}
              {selectedRequest.customer_email && (
                <div>
                  <label className="font-medium text-[var(--text-primary)]">Email</label>
                  <p className="text-[var(--text-secondary)]">{selectedRequest.customer_email}</p>
                </div>
              )}
              {selectedRequest.product_name && (
                <div>
                  <label className="font-medium text-[var(--text-primary)]">Product</label>
                  <p className="text-[var(--text-secondary)]">{selectedRequest.product_name}</p>
                </div>
              )}
              {selectedRequest.plan_name && (
                <div>
                  <label className="font-medium text-[var(--text-primary)]">Plan</label>
                  <p className="text-[var(--text-secondary)]">{selectedRequest.plan_name}</p>
                </div>
              )}
              {selectedRequest.license_key && (
                <div>
                  <label className="font-medium text-[var(--text-primary)]">License Key</label>
                  <p className="font-mono text-[var(--text-secondary)]">{selectedRequest.license_key}</p>
                </div>
              )}
              {selectedRequest.hardware_id && (
                <div>
                  <label className="font-medium text-[var(--text-primary)]">Hardware ID</label>
                  <p className="font-mono text-xs text-[var(--text-secondary)]">{selectedRequest.hardware_id}</p>
                </div>
              )}
              {selectedRequest.sdk_version && (
                <div>
                  <label className="font-medium text-[var(--text-primary)]">SDK Version</label>
                  <p className="text-[var(--text-secondary)]">{selectedRequest.sdk_version}</p>
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-[var(--text-primary)]">Admin Notes</label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                className="w-full mt-1 p-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-sm min-h-[80px]"
                placeholder="Add internal notes..."
              />
            </div>

            <div>
              <label className="text-sm font-medium text-[var(--text-primary)]">Reply to Customer</label>
              <textarea
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                className="w-full mt-1 p-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-sm min-h-[100px]"
                placeholder="Type your reply here... (will be sent via email)"
              />
            </div>

            <div className="flex gap-2 pt-2">
              {selectedRequest.status !== 'resolved' && (
                <Button onClick={() => handleUpdateStatus(selectedRequest.request_id, 'resolved')} disabled={updating}>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Mark Resolved
                </Button>
              )}
              {selectedRequest.status !== 'closed' && (
                <Button variant="outline" onClick={() => handleUpdateStatus(selectedRequest.request_id, 'closed')} disabled={updating}>
                  <XCircle className="w-4 h-4 mr-2" />
                  Close
                </Button>
              )}
              {selectedRequest.status === 'closed' && (
                <Button variant="outline" onClick={() => handleUpdateStatus(selectedRequest.request_id, 'open')} disabled={updating}>
                  Reopen
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
