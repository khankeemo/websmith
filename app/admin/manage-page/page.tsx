'use client';

import { useState, useEffect } from 'react';
import API from '../../../core/services/apiService';
import { Save } from 'lucide-react';

export default function ManagePage() {
  const [contactInfo, setContactInfo] = useState({
    headquarters: '',
    email: '',
    phone: ''
  });
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
        setContactInfo(res.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch contact settings', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage(null);
    try {
      await API.put('/settings/public/contact_info', {
        value: contactInfo
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
      
      <div style={styles.content}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>Contact Information</h2>
            <p style={styles.cardSubtitle}>This information is displayed publicly on the landing page and contact page.</p>
          </div>

          {isLoading ? (
            <div style={styles.loading}>Loading...</div>
          ) : (
            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Headquarters Address</label>
                <textarea 
                  style={styles.textarea}
                  value={contactInfo.headquarters}
                  onChange={(e) => setContactInfo({...contactInfo, headquarters: e.target.value})}
                  placeholder="e.g. 123 Tech Street, Silicon Valley, CA 94000"
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Contact Email</label>
                <input 
                  type="email"
                  style={styles.input}
                  value={contactInfo.email}
                  onChange={(e) => setContactInfo({...contactInfo, email: e.target.value})}
                  placeholder="e.g. sales@websmithdigital.com"
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Contact Phone Number</label>
                <input 
                  type="text"
                  style={styles.input}
                  value={contactInfo.phone}
                  onChange={(e) => setContactInfo({...contactInfo, phone: e.target.value})}
                  placeholder="e.g. +1 (555) 123-4567"
                />
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
      </div>
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
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
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
    gap: '20px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
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
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontSize: '15px',
    outline: 'none',
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
