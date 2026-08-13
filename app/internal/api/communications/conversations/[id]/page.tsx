"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Mail, Send, Loader2, AlertCircle, RefreshCw,
  Reply, User, Clock, Tag, MessageSquare, Paperclip,
  UserCircle, Shield, Trash2, ExternalLink, Search,
  X, CheckCircle2, XCircle, Clock3, Activity,
  FileText, Eye, Repeat, RotateCcw, Delete,
} from "lucide-react";

const API_BASE = "/internal/backend/communications";

interface Conversation {
  id: string;
  category: string;
  status: string;
  customer_email: string;
  customer_name: string;
  subject: string;
  product_id: string;
  license_key: string | null;
  hardware_id: string;
  sdk_version: string | null;
  runtime_type: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_type: string;
  sender_name: string;
  sender_email: string;
  message: string;
  is_internal: boolean;
  has_attachments: boolean;
  email_sent: boolean;
  email_error: string | null;
  created_at: string;
}

interface DeliveryLog {
  id: string;
  status: string;
  customer_email?: string;
  message?: string;
  last_error?: string | null;
  retry_count?: number;
  max_retries?: number;
  created_at: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  support: 'Support', sales: 'Sales', activation: 'Activation',
  renewal: 'Renewal', reactivation: 'Reactivation',
  hardware_replacement: 'Hardware', general: 'General',
};

const CATEGORY_COLORS: Record<string, string> = {
  support: 'text-blue-400 bg-blue-500/10', sales: 'text-emerald-400 bg-emerald-500/10',
  activation: 'text-purple-400 bg-purple-500/10', renewal: 'text-amber-400 bg-amber-500/10',
  reactivation: 'text-rose-400 bg-rose-500/10', hardware_replacement: 'text-cyan-400 bg-cyan-500/10',
  general: 'text-gray-400 bg-gray-500/10',
};

const STATUS_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  open: { label: 'Open', color: 'text-blue-400 bg-blue-500/10', icon: Activity },
  waiting_customer: { label: 'Waiting Customer', color: 'text-amber-400 bg-amber-500/10', icon: Clock3 },
  waiting_support: { label: 'Waiting Support', color: 'text-purple-400 bg-purple-500/10', icon: Shield },
  waiting_sales: { label: 'Waiting Sales', color: 'text-emerald-400 bg-emerald-500/10', icon: Mail },
  resolved: { label: 'Resolved', color: 'text-green-400 bg-green-500/10', icon: CheckCircle2 },
  closed: { label: 'Closed', color: 'text-gray-400 bg-gray-500/10', icon: XCircle },
};

const VALID_STATUSES = ['open', 'waiting_customer', 'waiting_support', 'waiting_sales', 'resolved', 'closed'];

const DELIVERY_STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  sent: { label: 'Sent', color: 'text-green-400', icon: CheckCircle2 },
  delivered: { label: 'Delivered', color: 'text-blue-400', icon: CheckCircle2 },
  failed: { label: 'Failed', color: 'text-red-400', icon: XCircle },
  pending: { label: 'Pending', color: 'text-amber-400', icon: Clock3 },
};

const getAuthHeaders = () => {
  const token = localStorage.getItem("api_center_token");
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
};

function DeliveryStatusBadge({ emailSent, emailError }: { emailSent: boolean; emailError: string | null }) {
  if (emailError) {
    return <span className="inline-flex items-center gap-1 text-xs text-red-400"><XCircle size={10} /> Failed: {emailError}</span>;
  }
  if (emailSent) {
    return <span className="inline-flex items-center gap-1 text-xs text-green-400"><CheckCircle2 size={10} /> Delivered</span>;
  }
  return <span className="inline-flex items-center gap-1 text-xs text-amber-400"><Clock3 size={10} /> Pending</span>;
}

export default function ConversationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [internalNotes, setInternalNotes] = useState<Message[]>([]);
  const [deliveryLogs, setDeliveryLogs] = useState<DeliveryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [isInternal, setIsInternal] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPermanentDeleteConfirm, setShowPermanentDeleteConfirm] = useState(false);
  const [showDeliveryLog, setShowDeliveryLog] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryResult, setRetryResult] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const showNotice = useCallback((type: 'ok' | 'err', text: string) => {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 5000);
  }, []);

  const fetchConversation = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/conversations/${id}`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) {
        setConversation(json.data.conversation);
        setMessages(json.data.messages || []);
        setInternalNotes(json.data.internal_notes || []);
        setDeliveryLogs(json.data.delivery_logs || []);
      } else {
        setError(json.error?.message || 'Conversation not found');
      }
    } catch {
      setError('Failed to load conversation');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { if (id) fetchConversation(); }, [id, fetchConversation]);

  const handleReply = async () => {
    if (!replyText.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch('/internal/backend/admin/communication/reply', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          conversation_id: id,
          message: replyText.trim(),
          sender_name: 'Admin',
          is_internal: isInternal,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setReplyText('');
        setIsInternal(false);
        fetchConversation();
      } else {
        showNotice('err', json.error?.message || 'Failed to send reply');
      }
    } catch {
      showNotice('err', 'Failed to send reply');
    }
    setSending(false);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!VALID_STATUSES.includes(newStatus) || statusUpdating) return;
    setStatusUpdating(true);
    try {
      const res = await fetch('/internal/backend/admin/communication/status', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ conversation_id: id, status: newStatus }),
      });
      const json = await res.json();
      if (json.success) fetchConversation();
    } catch {}
    setStatusUpdating(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/conversations/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (json.success) {
        router.push('/internal/api/communications');
      } else {
        showNotice('err', json.error?.message || 'Delete failed');
      }
    } catch {
      showNotice('err', 'Delete failed');
    }
    setDeleting(false);
    setShowDeleteConfirm(false);
  };

  const handlePermanentDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/conversations/${id}?permanent=true`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (json.success) {
        router.push('/internal/api/communications?tab=trash');
      } else {
        showNotice('err', json.error?.message || 'Delete failed');
      }
    } catch {
      showNotice('err', 'Delete failed');
    }
    setDeleting(false);
    setShowPermanentDeleteConfirm(false);
  };

  const handleRestore = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/conversations/${id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'restore' }),
      });
      const json = await res.json();
      if (json.success) {
        showNotice('ok', 'Conversation restored from Trash');
        fetchConversation();
      } else {
        showNotice('err', json.error?.message || 'Restore failed');
      }
    } catch {
      showNotice('err', 'Restore failed');
    }
    setDeleting(false);
  };

  const handleRetry = async () => {
    setRetrying(true);
    setRetryResult(null);
    try {
      const res = await fetch(`${API_BASE}/conversations/${id}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'retry' }),
      });
      const json = await res.json();
      if (json.success) {
        setRetryResult(`Retried ${json.data.retried} failed message(s).`);
        fetchConversation();
      } else {
        setRetryResult(json.error?.message || 'Retry failed');
      }
    } catch {
      setRetryResult('Retry request failed');
    }
    setRetrying(false);
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatShortTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
      <span className="ml-3 text-[var(--text-secondary)]">Loading conversation...</span>
    </div>
  );

  if (error || !conversation) return (
    <div className="p-6">
      <button onClick={() => router.push('/internal/api/communications')} className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] mb-4 transition-colors">
        <ArrowLeft size={14} /> Back to Communications
      </button>
      <div className="flex items-center justify-center py-20">
        <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
        <span className="text-[var(--text-secondary)]">{error || 'Conversation not found'}</span>
      </div>
    </div>
  );

  const StatusIcon = STATUS_LABELS[conversation.status]?.icon || Activity;

  return (
    <div className="p-6 space-y-6">
      {/* Notice toast */}
      {notice && (
        <div className={`fixed bottom-5 right-5 z-[100] flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm shadow-2xl shadow-black/40 ${
          notice.type === 'ok' ? 'border-green-500/30 bg-[var(--bg-secondary)] text-green-400' : 'border-red-500/30 bg-[var(--bg-secondary)] text-red-400'
        }`}>
          {notice.type === 'ok' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          <span className="text-xs">{notice.text}</span>
        </div>
      )}
      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-6 w-[400px] max-w-full mx-4 space-y-4">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Delete Conversation</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Move this conversation to the Trash? It can be restored later from the Recovery Bin.
            </p>
            <div className="flex gap-2 pt-2">
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {deleting ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting...</> : <><Trash2 size={14} /> Move to Trash</>}
              </button>
              <button onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent delete confirmation modal */}
      {showPermanentDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-6 w-[400px] max-w-full mx-4 space-y-4">
            <h2 className="text-lg font-semibold text-red-400">Permanently Delete</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              This will permanently delete this conversation and ALL related messages, attachments, and queue records. This action CANNOT be undone.
            </p>
            <div className="flex gap-2 pt-2">
              <button onClick={handlePermanentDelete} disabled={deleting}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {deleting ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting...</> : <><Delete size={14} /> Delete Forever</>}
              </button>
              <button onClick={() => setShowPermanentDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Log modal */}
      {showDeliveryLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-6 w-[600px] max-w-full mx-4 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <FileText size={16} /> Delivery Logs
              </h2>
              <button onClick={() => setShowDeliveryLog(false)} className="p-1 rounded-lg hover:bg-[var(--bg-tertiary)]/50 transition-colors">
                <X size={16} className="text-[var(--text-muted)]" />
              </button>
            </div>
            {deliveryLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-[var(--text-muted)]">
                <Activity size={32} className="mb-2 opacity-30" />
                <p className="text-sm">No delivery logs for this conversation</p>
              </div>
            ) : (
              <div className="space-y-2">
                {deliveryLogs.map((log) => {
                  const statusConfig = DELIVERY_STATUS_CONFIG[log.status];
                  const StatusIcon2 = statusConfig?.icon || Clock3;
                  return (
                    <div key={log.id} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${statusConfig?.color || 'text-gray-400'}`}>
                          <StatusIcon2 size={10} /> {statusConfig?.label || log.status}
                        </span>
                        <span className="text-xs text-[var(--text-muted)]">{formatTime(log.created_at)}</span>
                      </div>
                      {log.last_error && (
                        <p className="text-xs text-red-400 mt-1">{log.last_error}</p>
                      )}
                      {log.retry_count !== undefined && (
                        <p className="text-xs text-[var(--text-muted)] mt-1">Retry {log.retry_count}/{log.max_retries}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <button onClick={() => setShowDeliveryLog(false)}
              className="w-full py-2 rounded-lg border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30 transition-colors">
              Close
            </button>
          </div>
        </div>
      )}

      {/* Back button + title row */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.push('/internal/api/communications')} className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
          <ArrowLeft size={14} /> Back to Communications
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowDeliveryLog} disabled={deliveryLogs.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-xs text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]/50 hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors">
            <FileText size={12} /> Delivery Log{deliveryLogs.length > 0 ? ` (${deliveryLogs.length})` : ''}
          </button>
          <button onClick={fetchConversation} className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)]/50 transition-colors">
            <RefreshCw size={16} className="text-[var(--text-muted)]" />
          </button>
        </div>
      </div>

      {/* Email-style header card */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 overflow-hidden">
        <div className="p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-[var(--text-primary)] truncate">{conversation.subject || '(No subject)'}</h1>
                <span className={`px-2 py-0.5 rounded-md text-xs font-medium shrink-0 ${CATEGORY_COLORS[conversation.category] || ''}`}>
                  {CATEGORY_LABELS[conversation.category] || conversation.category}
                </span>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0 ${STATUS_LABELS[conversation.status]?.color || ''}`}>
                  <StatusIcon size={10} />
                  {STATUS_LABELS[conversation.status]?.label || conversation.status}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <span className="text-[var(--text-muted)] shrink-0">From:</span>
            <span className="text-[var(--text-primary)]">
              {conversation.customer_name || 'Unknown'} &lt;{conversation.customer_email}&gt;
            </span>
            <span className="text-[var(--text-muted)]">To:</span>
            <span className="text-[var(--text-primary)]">Support Team</span>
            <span className="text-[var(--text-muted)]">Date:</span>
            <span className="text-[var(--text-primary)]">{formatTime(conversation.created_at)}</span>
            <span className="text-[var(--text-muted)]">Updated:</span>
            <span className="text-[var(--text-primary)]">{formatTime(conversation.updated_at)}</span>
          </div>
        </div>

        <div className="border-t border-[var(--border-color)] px-6 py-3 bg-[var(--bg-tertiary)]/10">
          <div className="flex items-center gap-4 text-sm flex-wrap">
            <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
              <User size={12} /> Customer:
            </span>
            <button onClick={() => router.push(`/internal/api/customers?email=${encodeURIComponent(conversation.customer_email)}`)}
              className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors">
              {conversation.customer_name || 'Unknown'} &lt;{conversation.customer_email}&gt;
              <ExternalLink size={10} />
            </button>

            {conversation.product_id && (
              <>
                <span className="text-[var(--text-muted)]">|</span>
                <span className="flex items-center gap-1.5 text-[var(--text-muted)]"><Tag size={12} /> Product:</span>
                <button onClick={() => router.push(`/internal/api/products/${conversation.product_id}`)}
                  className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors">
                  {conversation.product_id}
                  <ExternalLink size={10} />
                </button>
              </>
            )}

            {conversation.license_key && (
              <>
                <span className="text-[var(--text-muted)]">|</span>
                <span className="flex items-center gap-1.5 text-[var(--text-muted)]"><Key size={12} /> License:</span>
                <button onClick={() => router.push(`/internal/api/licenses/${conversation.license_key}`)}
                  className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors">
                  {conversation.license_key}
                  <ExternalLink size={10} />
                </button>
              </>
            )}

            {conversation.hardware_id && (
              <>
                <span className="text-[var(--text-muted)]">|</span>
                <span className="flex items-center gap-1.5 text-[var(--text-muted)]"><HardDrive size={12} /> Hardware:</span>
                <code className="text-xs text-[var(--text-secondary)]">{conversation.hardware_id.substring(0, 16)}...</code>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {conversation.deleted_at ? (
          <>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/20 text-xs text-red-400">
              <Trash2 size={12} /> In Trash
            </span>
            <div className="w-px h-5 bg-[var(--border-color)] mx-1" />
            <button onClick={handleRestore} disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/20 text-xs text-emerald-400 hover:bg-emerald-500/10 transition-colors">
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw size={12} />}
              Restore
            </button>
            <button onClick={() => { setShowPermanentDeleteConfirm(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/20 text-xs text-red-400 hover:bg-red-500/10 transition-colors">
              <Delete size={12} /> Permanently Delete
            </button>
          </>
        ) : (
          <>
            <select
              value={conversation.status}
              onChange={e => handleStatusChange(e.target.value)}
              disabled={statusUpdating}
              className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)]/20 text-[var(--text-primary)] text-sm disabled:opacity-50"
            >
              {VALID_STATUSES.map(s => (
                <option key={s} value={s}>{STATUS_LABELS[s]?.label || s}</option>
              ))}
            </select>
            {statusUpdating && <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />}

            <div className="w-px h-5 bg-[var(--border-color)] mx-1" />

            <button onClick={handleRetry} disabled={retrying}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-xs text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]/50 hover:text-[var(--text-primary)] disabled:opacity-50 transition-colors">
              {retrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Repeat size={12} />}
              Retry Failed
            </button>

            <button onClick={() => { setShowDeleteConfirm(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/20 text-xs text-red-400 hover:bg-red-500/10 transition-colors">
              <Trash2 size={12} /> Delete
            </button>
          </>
        )}

        {retryResult && (
          <span className="text-xs text-blue-400 animate-pulse">{retryResult}</span>
        )}
      </div>

      {/* Messages thread */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <MessageSquare size={14} /> Messages ({messages.length})
        </h2>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
            <Mail size={32} className="mb-2 opacity-30" />
            <p className="text-sm">No messages yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className={`rounded-xl border ${
                msg.sender_type === 'admin' ? 'border-blue-500/10 bg-blue-500/5' : 'border-[var(--border-color)] bg-[var(--bg-tertiary)]/5'
              } overflow-hidden`}>
                {/* Email header */}
                <div className={`px-4 py-2.5 border-b ${
                  msg.sender_type === 'admin' ? 'border-blue-500/10 bg-blue-500/5' : 'border-[var(--border-color)] bg-[var(--bg-tertiary)]/10'
                }`}>
                  <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                    <span className="text-[var(--text-muted)]">From:</span>
                    <span className="text-[var(--text-primary)] font-medium">
                      {msg.sender_type === 'admin' ? 'Support Team' : (msg.sender_name || msg.sender_email)}
                      {msg.sender_type === 'admin' && (
                        <span className="ml-1.5 px-1 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px]">Admin</span>
                      )}
                      {msg.sender_type === 'customer' && msg.sender_email && (
                        <span className="ml-1.5 text-[var(--text-muted)]">&lt;{msg.sender_email}&gt;</span>
                      )}
                    </span>
                    <span className="text-[var(--text-muted)]">To:</span>
                    <span className="text-[var(--text-primary)]">
                      {msg.sender_type === 'admin' ? (
                        <>{conversation.customer_name || 'Customer'} &lt;{conversation.customer_email}&gt;</>
                      ) : 'Support Team'}
                    </span>
                    <span className="text-[var(--text-muted)]">Date:</span>
                    <span className="text-[var(--text-primary)]">{formatTime(msg.created_at)}</span>
                    <span className="text-[var(--text-muted)]">Status:</span>
                    <DeliveryStatusBadge emailSent={msg.email_sent} emailError={msg.email_error} />
                  </div>
                </div>
                {/* Message body */}
                <div className="p-4">
                  <div className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">{msg.message}</div>
                  {msg.has_attachments && (
                    <div className="flex items-center gap-1 mt-3 text-xs text-blue-400">
                      <Paperclip size={10} /> Has attachments
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reply box */}
      {!conversation.deleted_at && conversation.status !== 'closed' && conversation.status !== 'resolved' && (
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Reply size={14} />Reply
            </h2>
            <label className="flex items-center gap-2 text-xs text-[var(--text-muted)] cursor-pointer">
              <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)}
                className="rounded border-[var(--border-color)]" />
              Internal note
            </label>
          </div>
          <textarea
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            placeholder={isInternal ? "Add an internal note (not visible to customer)..." : "Type your reply..."}
            rows={4}
            className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm placeholder-[var(--text-muted)]"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-muted)]">
              {isInternal ? 'Internal notes are visible to admins only' : 'Reply will be sent to the customer'}
            </span>
            <button onClick={handleReply} disabled={!replyText.trim() || sending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</> : <><Send size={14} /> {isInternal ? 'Add Note' : 'Send Reply'}</>}
            </button>
          </div>
        </div>
      )}

      {/* Internal notes */}
      {internalNotes.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
            <Shield size={14} />Internal Notes ({internalNotes.length})
          </h3>
          {internalNotes.map((note) => (
            <div key={note.id} className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-amber-400">{note.sender_name || 'Admin'}</span>
                <span className="text-xs text-[var(--text-muted)]">{formatTime(note.created_at)}</span>
              </div>
              <p className="text-sm text-[var(--text-secondary)]">{note.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Key({ size, className }: { size?: number; className?: string }) {
  return <svg width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="8" cy="15" r="4"/><line x1="10.85" y1="12.15" x2="19" y2="4"/><line x1="15" y1="9" x2="18" y2="6"/></svg>;
}

function HardDrive({ size, className }: { size?: number; className?: string }) {
  return <svg width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="22" y1="12" x2="2" y2="12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" y1="16" x2="6.01" y2="16"/><line x1="10" y1="16" x2="10.01" y2="16"/></svg>;
}