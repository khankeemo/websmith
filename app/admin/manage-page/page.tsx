'use client';

import { useState, useEffect, useRef } from 'react';
import API from '../../../core/services/apiService';
import { Save, Mail, Phone, Smartphone, PhoneCall, MapPin, Upload, Film, Image as ImageIcon } from 'lucide-react';
import {
  DEFAULT_SITE_SETTINGS,
  SOCIAL_URL_FIELDS,
  PLACEHOLDER_URLS,
  normalizeSocialUrl,
  validateContactEmails,
  validateContactPhones,
  type SocialUrlKey,
  type SiteSettings,
} from '../../../lib/site-settings';
import { SOCIAL_PLATFORM_META } from '../../../lib/social-platforms';
import { MEDIA_SLOTS, MAX_MEDIA_FILE_SIZE, type MediaAsset } from '../../../lib/media';
import { refreshMediaAssets } from '../../../hooks/useMediaAsset';

const EMAIL_FIELDS: Array<{ key: 'email' | 'sales_email' | 'no_reply_email' | 'hr_email'; label: string; placeholder: string }> = [
  { key: 'email', label: 'Contact Email', placeholder: 'e.g. support@websmithdigital.com' },
  { key: 'sales_email', label: 'Sales Email', placeholder: 'e.g. sales@websmithdigital.com' },
  { key: 'no_reply_email', label: 'No-Reply Email', placeholder: 'e.g. no-reply@websmithdigital.com' },
  { key: 'hr_email', label: 'HR Email', placeholder: 'e.g. hr@websmithdigital.com' },
];

const PHONE_FIELDS: Array<{ key: 'mobile_number' | 'landline_number' | 'phone'; label: string; placeholder: string; icon: any }> = [
  { key: 'mobile_number', label: 'Mobile Number', placeholder: 'e.g. +91 98765 43210', icon: Smartphone },
  { key: 'landline_number', label: 'Fixed/Landline Number', placeholder: 'e.g. +1 (555) 123-4567', icon: PhoneCall },
  { key: 'phone', label: 'Primary Contact Number', placeholder: 'e.g. +1 (555) 123-4567', icon: Phone },
];

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

    const emailErrors = validateContactEmails(contactInfo);
    Object.assign(nextErrors, emailErrors);

    const phoneErrors = validateContactPhones(contactInfo);
    Object.assign(nextErrors, phoneErrors);

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setSaveMessage({
        type: 'error',
        text: 'Please fix the invalid value(s) highlighted below before saving.',
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

  const renderEmailFields = () => (
    <div style={styles.fieldRow}>
      {EMAIL_FIELDS.map((field) => {
        const error = errors[field.key];
        return (
          <div key={field.key} style={styles.fieldCell}>
            <div style={styles.fieldLabelRow}>
              <Mail size={15} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
              <label style={styles.label}>{field.label}</label>
            </div>
            <input
              type="email"
              style={{ ...styles.input, ...(error ? styles.inputError : {}) }}
              value={contactInfo[field.key]}
              onChange={(e) => setField(field.key, e.target.value)}
              placeholder={field.placeholder}
            />
            {error && <span style={styles.fieldError}>{error}</span>}
          </div>
        );
      })}
    </div>
  );

  const renderPhoneFields = () => (
    <div style={styles.fieldRow}>
      {PHONE_FIELDS.map((field) => {
        const Icon = field.icon;
        const error = errors[field.key];
        return (
          <div key={field.key} style={styles.fieldCell}>
            <div style={styles.fieldLabelRow}>
              <Icon size={15} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
              <label style={styles.label}>{field.label}</label>
            </div>
            <input
              type="text"
              style={{ ...styles.input, ...(error ? styles.inputError : {}) }}
              value={contactInfo[field.key]}
              onChange={(e) => setField(field.key, e.target.value)}
              placeholder={field.placeholder}
            />
            {error && <span style={styles.fieldError}>{error}</span>}
          </div>
        );
      })}
    </div>
  );

  const renderSocialFields = () => (
    <div style={styles.socialRow} className="social-grid-row">
      {SOCIAL_PLATFORM_META.map((platform) => {
        const Icon = platform.icon;
        const error = errors[platform.key];
        return (
          <div key={platform.key} style={styles.socialCell}>
            <div style={styles.fieldLabelRow}>
              <span style={{ ...styles.socialIconChip, backgroundColor: platform.color }}>
                <Icon size={13} color="#FFFFFF" />
              </span>
              <label style={styles.label}>{platform.label}</label>
            </div>
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
        );
      })}
    </div>
  );

  return (
    <div className="wsd-page admin-panel-scope">
      <style>{`
        @media (max-width: 1024px) {
          .manage-page-grid {
            grid-template-columns: 1fr !important;
          }
          .media-row-grid {
            grid-template-columns: 1fr !important;
            gap: 14px !important;
          }
        }
        @media (max-width: 640px) {
          .social-grid-row {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
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
          <div style={styles.contactSocialGrid} className="manage-page-grid">
            <div style={{ ...styles.card, height: '100%', boxSizing: 'border-box' }} className="admin-card">
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>Contact Information</h2>
                <p style={styles.cardSubtitle}>This information is displayed publicly on the landing page and contact page.</p>
              </div>

              <div style={styles.formGroup}>
                <div style={styles.fieldLabelRow}>
                  <MapPin size={15} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
                  <label style={styles.label}>Headquarters Address</label>
                </div>
                <textarea
                  style={styles.textarea}
                  value={contactInfo.headquarters}
                  onChange={(e) => setField('headquarters', e.target.value)}
                  placeholder="e.g. 123 Tech Street, Silicon Valley, CA 94000"
                />
              </div>

              <div style={styles.formGroup}>
                <div style={styles.fieldLabelRow}>
                  <Mail size={15} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
                  <label style={styles.label}>Email Addresses</label>
                </div>
                {renderEmailFields()}
              </div>

              <div style={styles.formGroup}>
                <div style={styles.fieldLabelRow}>
                  <Phone size={15} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
                  <label style={styles.label}>Phone Numbers</label>
                </div>
                {renderPhoneFields()}
              </div>
            </div>

            <div style={{ ...styles.card, height: '100%', boxSizing: 'border-box' }} className="admin-card">
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>Social Media Links</h2>
                <p style={styles.cardSubtitle}>Manage official social media profiles displayed on the website. Leave a link empty to hide that platform.</p>
              </div>
              {renderSocialFields()}
            </div>
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

      <WebsiteMediaCard />
    </div>
  );
}

function WebsiteMediaCard() {
  const [mediaMap, setMediaMap] = useState<Record<string, MediaAsset>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, { type: 'success' | 'error', text: string }>>({});
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    fetchMedia();
  }, []);

  const fetchMedia = async () => {
    try {
      setIsLoading(true);
      const res = await API.get('/settings/public/media');
      if (res.data && res.data.success && res.data.data) {
        const map: Record<string, MediaAsset> = {};
        for (const slot of MEDIA_SLOTS) {
          const record = res.data.data[slot.key];
          map[slot.key] = record
            ? { ...record, managed: true }
            : { url: slot.fallback, fileName: '', contentType: '', fileSize: 0, updatedAt: '', managed: false };
        }
        setMediaMap(map);
      }
    } catch (error) {
      console.error('Failed to fetch website media', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = async (slotKey: string, file: File | null) => {
    if (!file) return;
    setMessages((prev) => ({ ...prev, [slotKey]: { type: 'error', text: '' } }));
    if (file.size > MAX_MEDIA_FILE_SIZE) {
      setMessages((prev) => ({
        ...prev,
        [slotKey]: { type: 'error', text: `File exceeds the ${Math.floor(MAX_MEDIA_FILE_SIZE / 1024 / 1024)}MB limit.` },
      }));
      return;
    }
    try {
      setUploadingKey(slotKey);
      const form = new FormData();
      form.append('slotKey', slotKey);
      form.append('file', file);
      const res = await API.post('/settings/public/media', form);
      if (res.data && res.data.success && res.data.data) {
        const record = res.data.data;
        setMediaMap((prev) => ({ ...prev, [slotKey]: { ...record, managed: true } }));
        refreshMediaAssets();
        setMessages((prev) => ({
          ...prev,
          [slotKey]: { type: 'success', text: `Uploaded successfully. The new media is now live on every page.` },
        }));
      } else {
        setMessages((prev) => ({
          ...prev,
          [slotKey]: { type: 'error', text: res.data?.error || 'Upload failed.' },
        }));
      }
    } catch (error: any) {
      console.error('Failed to upload media', error);
      const errorMessage = typeof error?.response?.data?.error === 'string'
        ? error.response.data.error
        : error?.message
          ? String(error.message)
          : 'Upload failed. Please try again.';
      setMessages((prev) => ({
        ...prev,
        [slotKey]: { type: 'error', text: errorMessage },
      }));
    } finally {
      setUploadingKey(null);
      if (fileInputs.current[slotKey]) fileInputs.current[slotKey].value = '';
    }
  };

  const renderPreview = (slot: (typeof MEDIA_SLOTS)[number], asset: MediaAsset | undefined) => {
    if (!asset || !asset.managed || !asset.url) {
      return (
        <div style={styles.mediaEmptyPreview}>
          <span style={styles.mediaEmptyText}>Using default asset</span>
          <span style={styles.mediaEmptyHint}>{slot.fallback}</span>
        </div>
      );
    }
    const common = { width: '100%', height: '100%', objectFit: 'cover' as const, borderRadius: '10px' };
    if (slot.type === 'video') {
      return <video src={asset.url} controls muted preload="metadata" style={common} />;
    }
    return <img src={asset.url} alt={slot.label} style={common} />;
  };

  return (
    <div style={styles.card} className="admin-card">
      <div style={styles.cardHeader}>
        <h2 style={styles.cardTitle}>Website Media</h2>
        <p style={styles.cardSubtitle}>
          Upload the background videos, images and logos used across the public website and the
          panel sidebar. Uploads apply immediately — every page switches to the new media without
          a refresh.
        </p>
      </div>

      {isLoading ? (
        <div style={styles.loading}>Loading...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {MEDIA_SLOTS.map((slot) => {
            const asset = mediaMap[slot.key];
            const message = messages[slot.key];
            const isUploading = uploadingKey === slot.key;
            const Icon = slot.type === 'video' ? Film : ImageIcon;
            return (
              <div key={slot.key} style={styles.mediaRow} className="media-row-grid">
                <div style={styles.mediaInfo}>
                  <div style={styles.fieldLabelRow}>
                    <Icon size={15} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
                    <label style={styles.label}>{slot.label}</label>
                  </div>
                  <span style={styles.mediaUsage}>{slot.usage}</span>
                  {asset?.managed && asset.fileName && (
                    <span style={styles.mediaMeta}>
                      {asset.fileName} · {Math.round(asset.fileSize / 1024)} KB
                      {asset.updatedAt ? ` · ${new Date(asset.updatedAt).toLocaleString()}` : ''}
                    </span>
                  )}
                  {message?.text && (
                    <span style={{ fontSize: '13px', fontWeight: 500, color: message.type === 'success' ? '#34C759' : '#FF3B30' }}>
                      {message.text}
                    </span>
                  )}
                </div>
                <div style={styles.mediaPreview}>{renderPreview(slot, asset)}</div>
                <div style={styles.mediaActions}>
                  <button
                    type="button"
                    style={{ ...styles.uploadButton, opacity: isUploading ? 0.6 : 1 }}
                    disabled={isUploading}
                    onClick={() => fileInputs.current[slot.key]?.click()}
                  >
                    <Upload size={14} />
                    {isUploading ? 'Uploading...' : 'Upload'}
                  </button>
                  <input
                    ref={(el) => { fileInputs.current[slot.key] = el; }}
                    type="file"
                    accept={slot.accept}
                    style={{ display: 'none' }}
                    onChange={(e) => handleFileChange(slot.key, e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles: any = {
  header: {
    marginBottom: '32px',
  },
  contactSocialGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.45fr) minmax(0, 1fr)',
    gap: '24px',
    alignItems: 'stretch',
    width: '100%',
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
    gap: '12px',
    marginBottom: '20px',
  },
  fieldRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
    gap: '14px',
  },
  fieldCell: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    minWidth: 0,
  },
  fieldLabelRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
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
    backgroundColor: 'transparent',
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
    backgroundColor: 'transparent',
    color: 'var(--text-primary)',
    fontSize: '15px',
    minHeight: '80px',
    resize: 'vertical',
    outline: 'none',
    fontFamily: 'inherit',
  },
  socialRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '16px 14px',
    alignItems: 'start',
  },
  socialCell: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    minWidth: 0,
  },
  socialIconChip: {
    width: '26px',
    height: '26px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
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
  },
  mediaRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(240px, 1.4fr) 200px 120px',
    gap: '20px',
    alignItems: 'center',
    padding: '16px 20px',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    backgroundColor: 'transparent',
  },
  mediaInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    minWidth: 0,
  },
  mediaUsage: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    opacity: 0.9,
  },
  mediaMeta: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    opacity: 0.8,
  },
  mediaPreview: {
    width: '200px',
    height: '110px',
    borderRadius: '10px',
    overflow: 'hidden',
    backgroundColor: 'var(--bg-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid var(--border-color)',
  },
  mediaEmptyPreview: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    padding: '8px',
    textAlign: 'center',
  },
  mediaEmptyText: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
  },
  mediaEmptyHint: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
    opacity: 0.7,
    wordBreak: 'break-all',
  },
  mediaActions: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: '8px',
  },
  uploadButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '10px 14px',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
};
