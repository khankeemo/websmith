'use client';

import { useState, useEffect } from 'react';
import { Bell, Mail, MessageSquare, Loader2, Save, RefreshCw } from 'lucide-react';

const API_BASE = '/internal/backend/admin/event-config';

const ALL_EVENTS = [
  { type: 'otp_verification', label: 'OTP Verification', default: 'both' },
  { type: 'license_created', label: 'License Created', default: 'both' },
  { type: 'trial_started', label: 'Trial Started', default: 'both' },
  { type: 'trial_ending_reminder', label: 'Trial Ending Reminder', default: 'both' },
  { type: 'activation_success', label: 'Activation Success', default: 'both' },
  { type: 'activation_failed', label: 'Activation Failed', default: 'both' },
  { type: 'license_renewed', label: 'License Renewed', default: 'both' },
  { type: 'license_expired', label: 'License Expired', default: 'both' },
  { type: 'license_revoked', label: 'License Revoked', default: 'both' },
  { type: 'device_changed', label: 'Device Changed', default: 'both' },
  { type: 'device_reset', label: 'Device Reset', default: 'both' },
  { type: 'payment_success', label: 'Payment Success', default: 'both' },
  { type: 'subscription_reminder', label: 'Subscription Reminder', default: 'both' },
  { type: 'product_purchased', label: 'Product Purchased', default: 'both' },
  { type: 'welcome_customer', label: 'Welcome Customer', default: 'both' },
  { type: 'admin_notification', label: 'Admin Notification', default: 'email' },
  { type: 'product_archived', label: 'Product Archived', default: 'email' },
  { type: 'product_restored', label: 'Product Restored', default: 'email' },
  { type: 'sdk_generated', label: 'SDK Generated', default: 'email' },
  { type: 'api_key_generated', label: 'API Key Generated', default: 'email' },
  { type: 'security_alert', label: 'Security Alert', default: 'email' },
  { type: 'audit_summary', label: 'Audit Summary', default: 'email' },
];

export default function EventNotificationConfigPage() {
  const [configs, setConfigs] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const res = await fetch(API_BASE);
      const data = await res.json();
      if (data.success) {
        const map: Record<string, any> = {};
        data.configs.forEach((c: any) => { map[c.event_type] = c; });
        setConfigs(map);
      }
    } catch (e) {
      console.error('Failed to fetch event configs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConfigs(); }, []);

  const toggleEmail = async (eventType: string, current: boolean) => {
    setSaving(eventType);
    try {
      const res = await fetch(API_BASE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type: eventType, email_enabled: !current, sms_enabled: configs[eventType]?.sms_enabled ?? false }),
      });
      const data = await res.json();
      if (data.success) {
        setConfigs(c => ({ ...c, [eventType]: data.config }));
      }
    } catch (e) {
      console.error('Failed to toggle email:', e);
    } finally {
      setSaving(null);
    }
  };

  const toggleSms = async (eventType: string, current: boolean) => {
    setSaving(eventType);
    try {
      const res = await fetch(API_BASE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type: eventType, email_enabled: configs[eventType]?.email_enabled ?? true, sms_enabled: !current }),
      });
      const data = await res.json();
      if (data.success) {
        setConfigs(c => ({ ...c, [eventType]: data.config }));
      }
    } catch (e) {
      console.error('Failed to toggle SMS:', e);
    } finally {
      setSaving(null);
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
          <Bell className="w-6 h-6 text-[var(--accent)]" />
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Event Notification Configuration</h1>
        </div>
        <button onClick={fetchConfigs} className="p-2 rounded-lg hover:bg-[var(--bg-secondary)]">
          <RefreshCw className="w-4 h-4 text-[var(--text-muted)]" />
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--border-color)]">
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--bg-secondary)]">
              <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Event</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                <div className="flex items-center justify-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> Email
                </div>
              </th>
              <th className="text-center px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                <div className="flex items-center justify-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" /> SMS
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {ALL_EVENTS.map((ev) => {
              const cfg = configs[ev.type];
              const emailEnabled = cfg?.email_enabled ?? ev.default === 'both';
              const smsEnabled = cfg?.sms_enabled ?? ev.default === 'both';
              const isSaving = saving === ev.type;
              return (
                <tr key={ev.type} className="hover:bg-[var(--bg-secondary)]/50">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-[var(--text-primary)]">{ev.label}</div>
                    <div className="text-xs text-[var(--text-muted)] font-mono">{ev.type}</div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleEmail(ev.type, emailEnabled)}
                      disabled={isSaving}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${emailEnabled ? 'bg-green-500' : 'bg-gray-300'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${emailEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleSms(ev.type, smsEnabled)}
                      disabled={isSaving}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${smsEnabled ? 'bg-blue-500' : 'bg-gray-300'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${smsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
