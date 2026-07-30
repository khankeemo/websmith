"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Mail, Send, Loader2, AlertCircle, RefreshCw,
  Reply, User, Clock, Tag, MessageSquare, Paperclip,
  ChevronRight, UserCircle, Shield,
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

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  open: { label: 'Open', color: 'text-blue-400' },
  waiting_customer: { label: 'Waiting Customer', color: 'text-amber-400' },
  waiting_support: { label: 'Waiting Support', color: 'text-purple-400' },
  waiting_sales: { label: 'Waiting Sales', color: 'text-emerald-400' },
  resolved: { label: 'Resolved', color: 'text-green-400' },
  closed: { label: 'Closed', color: 'text-gray-400' },
};

const VALID_STATUSES = ['open', 'waiting_customer', 'waiting_support', 'waiting_sales', 'resolved', 'closed'];

const getAuthHeaders = () => {
  const token = localStorage.getItem("api_center_token");
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
};

export default function ConversationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [internalNotes, setInternalNotes] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [isInternal, setIsInternal] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

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
      }
    } catch {}
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

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

  return (
    <div className="p-6 space-y-6">
      <button onClick={() => router.push('/internal/api/communications')} className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
        <ArrowLeft size={14} /> Back to Communications
      </button>

      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-[var(--text-primary)]">{conversation.subject || '(No subject)'}</h1>
              <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${CATEGORY_COLORS[conversation.category] || ''}`}>
                {CATEGORY_LABELS[conversation.category] || conversation.category}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_LABELS[conversation.status]?.color || ''} bg-[var(--bg-tertiary)]/30`}>
                {STATUS_LABELS[conversation.status]?.label || conversation.status}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-[var(--text-muted)]">
              <span className="flex items-center gap-1.5"><User size={12} />{conversation.customer_name || 'Unknown'}</span>
              <span>{conversation.customer_email}</span>
            </div>
          </div>
          <button onClick={fetchConversation} className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)]/50 transition-colors">
            <RefreshCw size={16} className="text-[var(--text-muted)]" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4 p-4 rounded-lg bg-[var(--bg-tertiary)]/10 border border-[var(--border-color)] text-sm">
          <div><span className="text-[var(--text-muted)]">Product:</span> <span className="text-[var(--text-primary)]">{conversation.product_id || '-'}</span></div>
          <div><span className="text-[var(--text-muted)]">Hardware:</span> <code className="text-xs text-[var(--text-secondary)]">{conversation.hardware_id?.substring(0, 32) || '-'}</code></div>
          <div><span className="text-[var(--text-muted)]">License:</span> <code className="text-xs text-[var(--text-secondary)]">{conversation.license_key || '-'}</code></div>
          <div><span className="text-[var(--text-muted)]">SDK:</span> <span className="text-[var(--text-primary)]">{conversation.sdk_version || '-'}</span></div>
          <div><span className="text-[var(--text-muted)]">Runtime:</span> <span className="text-[var(--text-primary)]">{conversation.runtime_type || '-'}</span></div>
          <div><span className="text-[var(--text-muted)]">Created:</span> <span className="text-[var(--text-primary)]">{formatTime(conversation.created_at)}</span></div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-[var(--text-primary)]">Status:</span>
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
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <MessageSquare size={14} />Messages ({messages.length})
        </h2>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
            <Mail size={32} className="mb-2 opacity-30" />
            <p className="text-sm">No messages yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className={`rounded-xl border border-[var(--border-color)] p-4 ${
                msg.sender_type === 'admin' ? 'bg-blue-500/5 border-blue-500/10' : 'bg-[var(--bg-tertiary)]/5'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${
                      msg.sender_type === 'admin' ? 'bg-blue-500/10 text-blue-400' : 'bg-[var(--bg-tertiary)]/30 text-[var(--text-muted)]'
                    }`}>
                      {msg.sender_type === 'admin' ? <Shield size={14} /> : <UserCircle size={14} />}
                    </div>
                    <span className="font-medium text-[var(--text-primary)] text-sm">
                      {msg.sender_name || (msg.sender_type === 'admin' ? 'Support Team' : msg.sender_email)}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      msg.sender_type === 'admin' ? 'bg-blue-500/10 text-blue-400' : 'bg-[var(--bg-tertiary)]/30 text-[var(--text-muted)]'
                    }`}>
                      {msg.sender_type === 'admin' ? 'Admin' : 'Customer'}
                    </span>
                  </div>
                  <span className="text-xs text-[var(--text-muted)]">{formatTime(msg.created_at)}</span>
                </div>
                <div className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">{msg.message}</div>
                {msg.has_attachments && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-blue-400">
                    <Paperclip size={10} /> Has attachments
                  </div>
                )}
                {msg.email_error && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-red-400">
                    <AlertCircle size={10} /> Email failed: {msg.email_error}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {conversation.status !== 'closed' && conversation.status !== 'resolved' && (
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
