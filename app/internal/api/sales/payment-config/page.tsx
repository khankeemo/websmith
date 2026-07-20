'use client';

import { useState, useEffect } from 'react';
import {
  Settings, Save, Loader2, CreditCard, Shield, Globe, DollarSign, Percent,
  RefreshCw, FileText, ToggleLeft, Lock, KeyRound, Building2, Wallet
} from 'lucide-react';

const API_BASE = '/internal/backend/admin/payment-config';

interface PaymentConfig {
  id: number;
  provider: string;
  api_key: string;
  webhook_secret: string;
  environment: string;
  currency: string;
  tax_rate: number;
  tax_name: string;
  invoice_prefix: string;
  payment_status: string;
  test_mode: boolean;
  razorpay_key: string;
  razorpay_secret: string;
  stripe_publishable_key: string;
  paypal_client_id: string;
  paypal_secret: string;
  phonepe_merchant_id: string;
  phonepe_salt_key: string;
  cashfree_app_id: string;
  cashfree_secret_key: string;
  enabled: boolean;
}

const PROVIDERS = [
  { value: 'stripe', label: 'Stripe' },
  { value: 'razorpay', label: 'Razorpay' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'phonepe', label: 'PhonePe' },
  { value: 'cashfree', label: 'Cashfree' },
];

export default function PaymentConfigPage() {
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch(API_BASE);
      const data = await res.json();
      if (data.success && data.config) setConfig(data.config);
    } catch (e) {
      console.error('Failed to fetch payment config:', e);
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
      console.error('Failed to save payment config:', e);
    } finally {
      setSaving(false);
    }
  };

  const updateField = <K extends keyof PaymentConfig>(key: K, value: PaymentConfig[K]) => {
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
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <CreditCard className="w-6 h-6 text-[var(--accent)]" />
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Payment Setup</h1>
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
              Payment gateway is currently <strong>{config.enabled ? 'ENABLED' : 'DISABLED'}</strong>
              {config.test_mode && <span className="ml-2 text-xs bg-blue-500/20 text-blue-600 px-2 py-0.5 rounded-full">Test Mode</span>}
            </div>
            {!config.enabled && (
              <p className="text-sm mt-1 opacity-80">Enable payment below to activate. Keep disabled until production credentials are configured.</p>
            )}
          </div>

          <div className="space-y-6">
            {/* Enable/Disable Toggle */}
            <div className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-[var(--text-primary)]">Enable Payment</label>
                  <p className="text-xs text-[var(--text-secondary)]">Master switch for payment processing</p>
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

            {/* Gateway Provider */}
            <div className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-4 h-4 text-[var(--accent)]" />
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Gateway Provider</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Provider</label>
                  <select
                    value={config.provider}
                    onChange={e => updateField('provider', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm"
                  >
                    {PROVIDERS.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Environment</label>
                  <select
                    value={config.environment}
                    onChange={e => updateField('environment', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm"
                  >
                    <option value="test">Test / Sandbox</option>
                    <option value="production">Production</option>
                  </select>
                </div>
              </div>
            </div>

            {/* API Credentials */}
            <div className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]">
              <div className="flex items-center gap-2 mb-4">
                <KeyRound className="w-4 h-4 text-[var(--accent)]" />
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">API Credentials</h3>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">API Key (Secret)</label>
                    <input
                      type="password"
                      value={config.api_key}
                      onChange={e => updateField('api_key', e.target.value)}
                      placeholder="Enter provider API key"
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Webhook Secret</label>
                    <input
                      type="password"
                      value={config.webhook_secret}
                      onChange={e => updateField('webhook_secret', e.target.value)}
                      placeholder="Webhook signing secret"
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Provider-specific credentials */}
            <div className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]">
              <div className="flex items-center gap-2 mb-4">
                <Wallet className="w-4 h-4 text-[var(--accent)]" />
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Provider Credentials</h3>
              </div>
              <div className="space-y-3">
                {/* Stripe */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Stripe Publishable Key</label>
                    <input
                      type="password"
                      value={config.stripe_publishable_key}
                      onChange={e => updateField('stripe_publishable_key', e.target.value)}
                      placeholder="pk_live_..."
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm font-mono"
                    />
                  </div>
                </div>
                {/* Razorpay */}
                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-[var(--border-color)]">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Razorpay Key ID</label>
                    <input
                      type="text"
                      value={config.razorpay_key}
                      onChange={e => updateField('razorpay_key', e.target.value)}
                      placeholder="rzp_live_..."
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Razorpay Key Secret</label>
                    <input
                      type="password"
                      value={config.razorpay_secret}
                      onChange={e => updateField('razorpay_secret', e.target.value)}
                      placeholder="Enter secret"
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm font-mono"
                    />
                  </div>
                </div>
                {/* PayPal */}
                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-[var(--border-color)]">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">PayPal Client ID</label>
                    <input
                      type="text"
                      value={config.paypal_client_id}
                      onChange={e => updateField('paypal_client_id', e.target.value)}
                      placeholder="PayPal client ID"
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">PayPal Secret</label>
                    <input
                      type="password"
                      value={config.paypal_secret}
                      onChange={e => updateField('paypal_secret', e.target.value)}
                      placeholder="PayPal secret"
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm font-mono"
                    />
                  </div>
                </div>
                {/* PhonePe */}
                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-[var(--border-color)]">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">PhonePe Merchant ID</label>
                    <input
                      type="text"
                      value={config.phonepe_merchant_id}
                      onChange={e => updateField('phonepe_merchant_id', e.target.value)}
                      placeholder="Merchant ID"
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">PhonePe Salt Key</label>
                    <input
                      type="password"
                      value={config.phonepe_salt_key}
                      onChange={e => updateField('phonepe_salt_key', e.target.value)}
                      placeholder="Salt key"
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm font-mono"
                    />
                  </div>
                </div>
                {/* Cashfree */}
                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-[var(--border-color)]">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Cashfree App ID</label>
                    <input
                      type="text"
                      value={config.cashfree_app_id}
                      onChange={e => updateField('cashfree_app_id', e.target.value)}
                      placeholder="App ID"
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Cashfree Secret Key</label>
                    <input
                      type="password"
                      value={config.cashfree_secret_key}
                      onChange={e => updateField('cashfree_secret_key', e.target.value)}
                      placeholder="Secret key"
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Currency & Tax Settings */}
            <div className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="w-4 h-4 text-[var(--accent)]" />
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Currency & Tax Settings</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    <Globe className="w-3 h-3 inline mr-1" />
                    Currency
                  </label>
                  <select
                    value={config.currency}
                    onChange={e => updateField('currency', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm"
                  >
                    <option value="USD">USD - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="GBP">GBP - British Pound</option>
                    <option value="INR">INR - Indian Rupee</option>
                    <option value="AUD">AUD - Australian Dollar</option>
                    <option value="CAD">CAD - Canadian Dollar</option>
                    <option value="SGD">SGD - Singapore Dollar</option>
                    <option value="AED">AED - UAE Dirham</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    <Percent className="w-3 h-3 inline mr-1" />
                    Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    value={config.tax_rate}
                    onChange={e => updateField('tax_rate', parseFloat(e.target.value) || 0)}
                    min={0}
                    max={100}
                    step={0.01}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Tax Name</label>
                  <input
                    type="text"
                    value={config.tax_name}
                    onChange={e => updateField('tax_name', e.target.value)}
                    placeholder="VAT"
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    <FileText className="w-3 h-3 inline mr-1" />
                    Invoice Prefix
                  </label>
                  <input
                    type="text"
                    value={config.invoice_prefix}
                    onChange={e => updateField('invoice_prefix', e.target.value)}
                    placeholder="INV-"
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Test Mode Toggle */}
            <div className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ToggleLeft className="w-4 h-4 text-[var(--accent)]" />
                  <div>
                    <label className="text-sm font-medium text-[var(--text-primary)]">Test Mode</label>
                    <p className="text-xs text-[var(--text-secondary)]">Use sandbox/test environment for payments</p>
                  </div>
                </div>
                <button
                  onClick={() => updateField('test_mode', !config.test_mode)}
                  className={`relative w-14 h-7 rounded-full transition-colors ${
                    config.test_mode ? 'bg-blue-500' : 'bg-gray-400'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                    config.test_mode ? 'translate-x-7' : 'translate-x-0'
                  }`} />
                </button>
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

            {saved && (
              <span className="text-sm text-emerald-500 font-medium flex items-center gap-1">
                <Save className="w-3.5 h-3.5" />
                Saved successfully
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
