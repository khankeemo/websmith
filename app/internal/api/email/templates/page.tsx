'use client';

import { useState, useEffect } from 'react';
import { Mail, Save, Loader2, Eye, Edit2, X, RefreshCw, Send, Info } from 'lucide-react';

const API_BASE = '/internal/backend/admin/email/templates';

const EMAIL_TYPES = [
  'license_created', 'trial_started', 'activation_success', 'activation_failed',
  'license_renewed', 'license_expired', 'license_revoked', 'device_reset',
  'device_changed', 'payment_success', 'subscription_reminder', 'admin_notification'
];

const TYPE_LABELS: Record<string, string> = {
  license_created: 'License Created',
  trial_started: 'Trial Started',
  activation_success: 'Activation Success',
  activation_failed: 'Activation Failed',
  license_renewed: 'License Renewed',
  license_expired: 'License Expired',
  license_revoked: 'License Revoked',
  device_reset: 'Device Reset',
  device_changed: 'Device Changed',
  payment_success: 'Payment Success',
  subscription_reminder: 'Subscription Reminder',
  admin_notification: 'Admin Notification'
};

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ subject: '', body: '', plain_text: '' });
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch(API_BASE);
      const data = await res.json();
      if (data.success) {
        const map: Record<string, any> = {};
        data.templates.forEach((t: any) => { map[t.email_type] = t; });
        setTemplates(map);
      }
    } catch (e) {
      console.error('Failed to fetch templates:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTemplates(); }, []);

  const handleSave = async (emailType: string) => {
    setSaving(true);
    try {
      const res = await fetch(API_BASE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_type: emailType, subject: editForm.subject, body: editForm.body, plain_text: editForm.plain_text }),
      });
      const data = await res.json();
      if (data.success) {
        setTemplates(prev => ({ ...prev, [emailType]: data.template }));
        setEditing(null);
      }
    } catch (e) {
      console.error('Failed to save:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[var(--api-blue-500-10)] text-[var(--api-blue-400)]">
            <Mail className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Email Templates</h1>
            <p className="text-sm text-[var(--text-secondary)]">Manage automated email templates sent via Nodemailer SMTP</p>
          </div>
        </div>
        <button onClick={fetchTemplates} className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)]/50 transition-colors">
          <RefreshCw size={18} className="text-[var(--text-muted)]" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 text-[var(--api-blue-400)] animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4">
          {EMAIL_TYPES.map(type => {
            const tmpl = templates[type];
            const isEditing = editing === type;
            return (
              <div key={type} className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/5 overflow-hidden">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${tmpl?.is_active !== false ? 'bg-green-400' : 'bg-gray-400'}`} />
                    <div>
                      <h3 className="font-medium text-[var(--text-primary)]">{TYPE_LABELS[type] || type}</h3>
                      <p className="text-xs text-[var(--text-muted)]">{tmpl?.subject || 'Default template'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {tmpl && (
                      <button onClick={() => setPreview(preview === type ? null : type)} className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)]/50 transition-colors">
                        <Eye size={16} className="text-[var(--text-muted)]" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setEditing(type);
                        setEditForm({ subject: tmpl?.subject || '', body: tmpl?.body || '', plain_text: tmpl?.plain_text || '' });
                      }}
                      className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)]/50 transition-colors"
                    >
                      <Edit2 size={16} className="text-[var(--text-muted)]" />
                    </button>
                  </div>
                </div>

                {preview === type && tmpl && (
                  <div className="px-4 pb-4 space-y-3">
                    <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] p-4 max-h-64 overflow-y-auto">
                      <div className="text-sm font-medium text-[var(--text-primary)] mb-2">{tmpl.subject}</div>
                      <div className="text-sm text-[var(--text-secondary)] prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: tmpl.body }} />
                    </div>
                    {tmpl.plain_text && (
                      <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] p-4 max-h-32 overflow-y-auto">
                        <div className="text-xs font-medium text-[var(--text-muted)] mb-1">Plain Text</div>
                        <pre className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap font-sans">{tmpl.plain_text}</pre>
                      </div>
                    )}
                  </div>
                )}

                {isEditing && (
                  <div className="px-4 pb-4 space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Subject</label>
                      <input
                        type="text"
                        value={editForm.subject}
                        onChange={e => setEditForm(f => ({ ...f, subject: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">HTML Body</label>
                      <textarea
                        rows={8}
                        value={editForm.body}
                        onChange={e => setEditForm(f => ({ ...f, body: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Plain Text Version</label>
                      <textarea
                        rows={4}
                        value={editForm.plain_text}
                        onChange={e => setEditForm(f => ({ ...f, plain_text: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm font-mono"
                      />
                    </div>
                    <div className="p-3 rounded-lg bg-[var(--bg-tertiary)]/30 border border-[var(--border-color)]">
                      <div className="flex items-center gap-2 mb-2">
                        <Info size={14} className="text-[var(--api-blue-400)]" />
                        <span className="text-xs font-medium text-[var(--text-primary)]">Available Variables</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 text-xs">
                        {['customer_name','customer_email','product','plan','license_key','expiry_date','device_name','duration_days','days_remaining','max_devices','company','support_email','website','amount','reason','message','runtime','version','api_key','previous_device'].map(v => (
                          <code
                            key={v}
                            onClick={() => setEditForm(f => ({ ...f, body: f.body + `{{${v}}}` }))}
                            className="px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--api-blue-400)] border border-[var(--border-color)] cursor-pointer hover:bg-[var(--api-blue-500-10)] transition-colors"
                          >{'{{'+v+'}}'}</code>
                        ))}
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-2">Click a variable to insert it at the end of the body</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleSave(type)} disabled={saving} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                        {saving ? <><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Saving...</> : <><Save className="h-4 w-4 inline mr-2" />Save</>}
                      </button>
                      <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg border border-[var(--border-color)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/30">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
