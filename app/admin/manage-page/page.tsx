'use client';

import { useState, useEffect } from 'react';
import API from '../../../core/services/apiService';
import { Save } from 'lucide-react';
import {
  DEFAULT_SITE_SETTINGS,
  SOCIAL_URL_FIELDS,
  PLACEHOLDER_URLS,
  normalizeSocialUrl,
  type SocialUrlKey,
  type SiteSettings,
} from '../../../lib/site-settings';
import { SOCIAL_PLATFORM_META } from '../../../lib/social-platforms';

export default function ManagePage() {
  const [contactInfo, setContactInfo] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const res = await API.get('/settings/public/contact_info');
      if (res.data && res.data.success && res.data.data) {
        setContactInfo({
          ...DEFAULT_SITE_SETTINGS,
          ...res.data.data,
        });
      }
    } catch (error) {
      console.error('Failed to fetch contact settings', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setField = (field: keyof SiteSettings, value: string) => {
    setContactInfo((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveMessage(null);

    const nextErrors: Record<string, string> = {};
    const normalized = { ...contactInfo };
    for (const key of Object.keys(SOCIAL_URL_FIELDS) as SocialUrlKey[]) {
      const result = normalizeSocialUrl(key, contactInfo[key]);
      if (result.error) nextErrors[key] = result.error;
      else normalized[key] = result.value;
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setSaveMessage({
        type: 'error',
        text: 'Please fix the invalid social media link(s) highlighted below before saving.',
      });
      return;
    }

    setIsSaving(true);
    setContactInfo(normalized);
    try {
      await API.put('/settings/public/contact_info', {
        value: normalized
      });
      setSaveMessage({ type: 'success', text: 'Contact information updated successfully.' });
    } catch (error) {
      console.error('Failed to update contact settings', error);
      setSaveMessage({ type: 'error', text: 'Failed to update contact information.' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  return (
    <div className="wsd-page">
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Manage Page</h1>
          <p style={styles.subtitle}>Configure and manage global website information</p>
        </div>
      </header>
      
      {isLoading ? (
        <div style={styles.loading}>Loading...</div>
      ) : (
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h2 style={styles.cardTitle}>Contact Information</h2>
              <p style={styles.cardSubtitle}>This information is displayed publicly on the landing page and contact page.</p>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Headquarters Address</label>
              <textarea 
                style={styles.textarea}
                value={contactInfo.headquarters}
                onChange={(e) => setField('headquarters', e.target.value)}
                placeholder="e.g. 123 Tech Street, Silicon Valley, CA 94000"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Contact Email</label>
              <input 
                type="email"
                style={styles.input}
                value={contactInfo.email}
                onChange={(e) => setField('email', e.target.value)}
                placeholder="e.g. support@websmithdigital.com"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Sales Email</label>
              <input 
                type="email"
                style={styles.input}
                value={contactInfo.sales_email}
                onChange={(e) => setField('sales_email', e.target.value)}
                placeholder="e.g. sales@websmithdigital.com"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>No-Reply Email</label>
              <input 
                type="email"
                style={styles.input}
                value={contactInfo.no_reply_email}
                onChange={(e) => setField('no_reply_email', e.target.value)}
                placeholder="e.g. no-reply@websmithdigital.com"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>HR Email</label>
              <input 
                type="email"
                style={styles.input}
                value={contactInfo.hr_email}
                onChange={(e) => setField('hr_email', e.target.value)}
                placeholder="e.g. hr@websmithdigital.com"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Mobile Number</label>
              <input 
                type="text"
                style={styles.input}
                value={contactInfo.mobile_number}
                onChange={(e) => setField('mobile_number', e.target.value)}
                placeholder="e.g. +91 98765 43210"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Fixed/Landline Number</label>
              <input 
                type="text"
                style={styles.input}
                value={contactInfo.landline_number}
                onChange={(e) => setField('landline_number', e.target.value)}
                placeholder="e.g. +1 (555) 123-4567"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Primary Contact Number</label>
              <input 
                type="text"
                style={styles.input}
                value={contactInfo.phone}
                onChange={(e) => setField('phone', e.target.value)}
                placeholder="e.g. +1 (555) 123-4567"
              />
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h2 style={styles.cardTitle}>Social Media Links</h2>
              <p style={styles.cardSubtitle}>Manage official social media profiles displayed on the website. Leave a link empty to hide that platform.</p>
            </div>

            {SOCIAL_PLATFORM_META.map((platform) => {
              const Icon = platform.icon;
              const error = errors[platform.key];
              return (
                <div key={platform.key} style={styles.socialRow}>
                  <div style={{ ...styles.socialIconChip, backgroundColor: platform.color }}>
                    <Icon size={18} color="#FFFFFF" />
                  </div>
                  <div style={styles.socialInputWrap}>
                    <label style={styles.label}>{platform.label}</label>
                    <input 
                      type="text"
                      style={{ ...styles.input, ...(error ? styles.inputError : {}) }}
                      value={contactInfo[platform.key]}
                      onChange={(e) => setField(platform.key, e.target.value)}
                      placeholder={platform.key === 'whatsapp_url'
                        ? 'https://wa.me/919876543210 or just 919876543210'
                        : PLACEHOLDER_URLS[platform.key]}
                    />
                    {platform.key === 'whatsapp_url' && !error && (
                      <span style={styles.fieldHint}>Enter https://wa.me/&lt;number&gt; or just the number — it will be saved as https://wa.me/&lt;number&gt; automatically.</span>
                    )}
                    {error && <span style={styles.fieldError}>{error}</span>}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={styles.formActions}>
            {saveMessage && (
              <span style={{ 
                color: saveMessage.type === 'success' ? '#34C759' : '#FF3B30', 
                fontSize: '14px', 
                fontWeight: 500 
              }}>
                {saveMessage.text}
              </span>
            )}
            <button type="submit" style={styles.saveButton} disabled={isSaving}>
              <Save size={16} />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

const styles: any = {
  header: {
    marginBottom: '32px',
  },
  title: {
    fontSize: '34px',
    fontWeight: 800,
    color: 'var(--text-primary)',
    margin: 0,
    marginBottom: '8px',
    letterSpacing: '-1px',
  },
  subtitle: {
    fontSize: '16px',
    color: 'var(--text-secondary)',
    margin: 0,
  },
  card: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
    padding: '32px',
  },
  cardHeader: {
    marginBottom: '24px',
    borderBottom: '1px solid var(--border-color)',
    paddingBottom: '20px',
  },
  cardTitle: {
    margin: '0 0 8px 0',
    fontSize: '20px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  cardSubtitle: {
    margin: 0,
    fontSize: '14px',
    color: 'var(--text-secondary)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '20px',
  },
  label: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--text-primary)',
  },
  input: {
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontSize: '15px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  inputError: {
    border: '1px solid #FF3B30',
  },
  textarea: {
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontSize: '15px',
    minHeight: '80px',
    resize: 'vertical',
    outline: 'none',
    fontFamily: 'inherit',
  },
  socialRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '14px',
    marginBottom: '20px',
  },
  socialIconChip: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: '2px',
  },
  socialInputWrap: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  fieldError: {
    fontSize: '13px',
    color: '#FF3B30',
    fontWeight: 500,
  },
  fieldHint: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    opacity: 0.85,
  },
  formActions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '12px',
    paddingTop: '20px',
    borderTop: '1px solid var(--border-color)',
  },
  saveButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    backgroundColor: '#007AFF',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    marginLeft: 'auto',
  },
  loading: {
    padding: '40px 0',
    textAlign: 'center',
    color: 'var(--text-secondary)',
    fontSize: '15px',
  }
};
