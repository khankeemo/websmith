'use client';

import { useState, useEffect } from 'react';
import { Settings, Save, Loader2, MessageSquare, Phone, Send, Shield, Globe, Clock, RefreshCw } from 'lucide-react';

const API_BASE = '/internal/backend/admin/sms-config';

interface SmsConfig {
  id: number;
  provider: string;
  api_key: string;
  sender_id: string;
  route: string;
  environment: string;
  enabled: boolean;
  default_country_code: string;
  retry_count: number;
  timeout: number;
  delivery_report: boolean;
}

export default function SmsConfigPage() {
  const [config, setConfig] = useState<SmsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testSending, setTestSending] = useState(false);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch(API_BASE);
      const data = await res.json();
      if (data.success && data.config) setConfig(data.config);
    } catch (e) {
      console.error('Failed to fetch SMS config:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConfig(); }, []);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(API_BASE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.success) {
        setConfig(data.config);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (e) {
      console.error('Failed to save SMS config:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!config) return;
    setTestSending(true);
    setTestResult(null);

    try {
      const phone = prompt('Enter phone number to send test SMS (with country code, e.g. +919984835353):');
      if (!phone) { setTestSending(false); return; }

      const res = await fetch('/internal/backend/admin/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sms_type: 'license_created', phone, test: true }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (e: any) {
      setTestResult({ success: false, message: String(e) });
    } finally {
      setTestSending(false);
    }
  };

  const updateField = <K extends keyof SmsConfig>(key: K, value: SmsConfig[K]) => {
    if (!config) return;
    setConfig({ ...config, [key]: value });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-[var(--accent)]" />
          <h1 className="text-xl font-bold text-[var(--text-primary)]">SMS Configuration</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchConfig} className="p-2 rounded-lg hover:bg-[var(--bg-secondary)]">
            <RefreshCw className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
        </div>
      </div>

      {config && (
        <>
          {/* Status Banner */}
          <div className={`mb-6 p-4 rounded-lg border ${
            config.enabled
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
              : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-600'
          }`}>
            <div className="flex items-center gap-2 font-medium">
              <Shield className="w-5 h-5" />
              SMS is currently <strong>{config.enabled ? 'ENABLED' : 'DISABLED'}</strong>
            </div>
            {!config.enabled && (
              <p className="text-sm mt-1 opacity-80">Enable SMS above to send messages. Keep disabled until production credentials are configured.</p>
            )}
          </div>

          <div className="space-y-6">
            {/* Enable/Disable Toggle */}
            <div className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-[var(--text-primary)]">Enable SMS</label>
                  <p className="text-xs text-[var(--text-secondary)]">Master switch for all SMS notifications</p>
                </div>
                <button
                  onClick={() => updateField('enabled', !config.enabled)}
                  className={`relative w-14 h-7 rounded-full transition-colors ${
                    config.enabled ? 'bg-emerald-500' : 'bg-gray-400'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                    config.enabled ? 'translate-x-7' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>

            {/* Provider */}
            <div className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="w-4 h-4 text-[var(--accent)]" />
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Provider Settings</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">SMS Provider</label>
                  <select
                    value={config.provider}
                    onChange={e => updateField('provider', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm"
                  >
                    <option value="fast2sms">Fast2SMS</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Route</label>
                  <select
                    value={config.route}
                    onChange={e => updateField('route', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm"
                  >
                    <option value="dlt">DLT</option>
                    <option value="quick">Quick</option>
                    <option value="transactional">Transactional</option>
                    <option value="promotional">Promotional</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Environment</label>
                  <select
                    value={config.environment}
                    onChange={e => updateField('environment', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm"
                  >
                    <option value="production">Production</option>
                    <option value="staging">Staging</option>
                    <option value="development">Development</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">API Key</label>
                  <input
                    type="password"
                    value={config.api_key}
                    onChange={e => updateField('api_key', e.target.value)}
                    placeholder="Enter Fast2SMS API key"
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Sender ID</label>
                  <input
                    type="text"
                    value={config.sender_id}
                    onChange={e => updateField('sender_id', e.target.value)}
                    placeholder="WEBSMS"
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Phone Settings */}
            <div className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]">
              <div className="flex items-center gap-2 mb-4">
                <Phone className="w-4 h-4 text-[var(--accent)]" />
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Phone Settings</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    <Globe className="w-3 h-3 inline mr-1" />
                    Default Country Code
                  </label>
                  <input
                    type="text"
                    value={config.default_country_code}
                    onChange={e => updateField('default_country_code', e.target.value)}
                    placeholder="+91"
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    <Clock className="w-3 h-3 inline mr-1" />
                    Timeout (ms)
                  </label>
                  <input
                    type="number"
                    value={config.timeout}
                    onChange={e => updateField('timeout', parseInt(e.target.value) || 5000)}
                    min={1000}
                    max={30000}
                    step={1000}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Retry Count</label>
                  <input
                    type="number"
                    value={config.retry_count}
                    onChange={e => updateField('retry_count', parseInt(e.target.value) || 2)}
                    min={0}
                    max={10}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Delivery Report</label>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => updateField('delivery_report', !config.delivery_report)}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        config.delivery_report ? 'bg-emerald-500' : 'bg-gray-400'
                      }`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        config.delivery_report ? 'translate-x-6' : 'translate-x-0'
                      }`} />
                    </button>
                    <span className="text-xs text-[var(--text-secondary)]">
                      {config.delivery_report ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 mt-6">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>

            <button
              onClick={handleTest}
              disabled={testSending || !config.enabled}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-[var(--border-color)] text-[var(--text-primary)] text-sm font-medium hover:bg-[var(--bg-secondary)] disabled:opacity-50"
            >
              {testSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {testSending ? 'Sending...' : 'Test SMS'}
            </button>

            {saved && (
              <span className="text-sm text-emerald-500 font-medium flex items-center gap-1">
                <Save className="w-3.5 h-3.5" />
                Saved successfully
              </span>
            )}
          </div>

          {/* Test Result */}
          {testResult && (
            <div className={`mt-4 p-3 rounded-lg border text-sm ${
              testResult.success
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
                : 'bg-red-500/10 border-red-500/30 text-red-600'
            }`}>
              <strong>{testResult.success ? 'SMS sent successfully!' : 'SMS failed:'}</strong>{' '}
              {testResult.message || 'Unknown result'}
            </div>
          )}
        </>
      )}
    </div>
  );
}
