'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, Save, Loader2, Edit2, X, RefreshCw } from 'lucide-react';

const API_BASE = '/internal/backend/admin/sms/templates';

const SMS_TYPES = [
  'otp_verification', 'license_created', 'trial_started', 'trial_ending_reminder',
  'activation_success', 'activation_failed', 'license_renewed', 'license_expired',
  'license_revoked', 'device_changed', 'device_reset', 'payment_success',
  'subscription_reminder', 'product_purchased', 'welcome_customer',
  'admin_notification', 'product_archived', 'product_restored',
  'sdk_generated', 'api_key_generated', 'security_alert', 'audit_summary'
];

const TYPE_LABELS: Record<string, string> = {
  otp_verification: 'OTP Verification',
  license_created: 'License Created',
  trial_started: 'Trial Started',
  trial_ending_reminder: 'Trial Ending Reminder',
  activation_success: 'Activation Success',
  activation_failed: 'Activation Failed',
  license_renewed: 'License Renewed',
  license_expired: 'License Expired',
  license_revoked: 'License Revoked',
  device_changed: 'Device Changed',
  device_reset: 'Device Reset',
  payment_success: 'Payment Success',
  subscription_reminder: 'Subscription Reminder',
  product_purchased: 'Product Purchased',
  welcome_customer: 'Welcome Customer',
  admin_notification: 'Admin Notification',
  product_archived: 'Product Archived',
  product_restored: 'Product Restored',
  sdk_generated: 'SDK Generated',
  api_key_generated: 'API Key Generated',
  security_alert: 'Security Alert',
  audit_summary: 'Audit Summary'
};

export default function SmsTemplatesPage() {
  const [templates, setTemplates] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ message: '', is_active: true });
  const [saving, setSaving] = useState(false);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch(API_BASE);
      const data = await res.json();
      if (data.success) {
        const map: Record<string, any> = {};
        data.templates.forEach((t: any) => { map[t.sms_type] = t; });
        setTemplates(map);
      }
    } catch (e) {
      console.error('Failed to fetch SMS templates:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTemplates(); }, []);

  const handleSave = async (smsType: string) => {
    setSaving(true);
    try {
      const res = await fetch(API_BASE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sms_type: smsType, ...editForm }),
      });
      const data = await res.json();
      if (data.success) {
        setTemplates(t => ({ ...t, [smsType]: data.template }));
        setEditing(null);
      }
    } catch (e) {
      console.error('Failed to save SMS template:', e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-6 h-6 text-[var(--accent)]" />
          <h1 className="text-xl font-bold text-[var(--text-primary)]">SMS Templates</h1>
        </div>
        <button onClick={fetchTemplates} className="p-2 rounded-lg hover:bg-[var(--bg-secondary)]">
          <RefreshCw className="w-4 h-4 text-[var(--text-muted)]" />
        </button>
      </div>

      <div className="space-y-2">
        {SMS_TYPES.map((type) => {
          const tmpl = templates[type];
          return (
            <div key={type} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--text-primary)]">{TYPE_LABELS[type] || type}</span>
                    {tmpl && !tmpl.is_active && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-800">Disabled</span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--text-muted)] mt-0.5 font-mono">{type}</div>
                  {editing !== type && tmpl && (
                    <div className="text-xs text-[var(--text-secondary)] mt-1 truncate max-w-lg">{tmpl.message}</div>
                  )}
                </div>
                {editing === type ? (
                  <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-[var(--bg-secondary)]">
                    <X className="w-4 h-4 text-[var(--text-muted)]" />
                  </button>
                ) : (
                  <button onClick={() => { setEditing(type); setEditForm({ message: tmpl?.message || '', is_active: tmpl?.is_active ?? true }); }} className="p-1.5 rounded-lg hover:bg-[var(--bg-secondary)]">
                    <Edit2 className="w-4 h-4 text-[var(--text-muted)]" />
                  </button>
                )}
              </div>
              {editing === type && (
                <div className="px-4 pb-4 space-y-3 border-t border-[var(--border-color)] pt-3">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">SMS Message</label>
                    <textarea
                      rows={3}
                      value={editForm.message}
                      onChange={e => setEditForm(f => ({ ...f, message: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm font-mono"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="sms-active"
                      checked={editForm.is_active}
                      onChange={e => setEditForm(f => ({ ...f, is_active: e.target.checked }))}
                      className="rounded border-[var(--border-color)]"
                    />
                    <label htmlFor="sms-active" className="text-sm text-[var(--text-secondary)]">Active</label>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSave(type)}
                      disabled={saving || !editForm.message}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium disabled:opacity-50"
                    >
                      {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <Save className="w-3.5 h-3.5" />
                      Save
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
