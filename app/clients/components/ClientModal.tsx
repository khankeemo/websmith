// C:\websmith\app\clients\components\ClientModal.tsx
// Client Modal - Form for adding/editing clients
// Features: Form validation, status dropdown

'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Client, ClientPayload } from '../services/clientService';

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (client: ClientPayload) => Promise<void>;
  client?: Client | null;
  isSaving?: boolean;
  submitError?: string | null;
}

interface FormData {
  name: string;
  email: string;
  phone: string;
  company: string;
  address: string;
  status: 'active' | 'inactive';
}

export default function ClientModal({ isOpen, onClose, onSave, client, isSaving = false, submitError }: ClientModalProps) {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    company: '',
    address: '',
    status: 'active',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name || '',
        email: client.email || '',
        phone: client.phone || '',
        company: client.company || '',
        address: client.address || '',
        status: client.status || 'active',
      });
    } else {
      setFormData({
        name: '',
        email: '',
        phone: '',
        company: '',
        address: '',
        status: 'active',
      });
    }
    setErrors({});
  }, [client, isOpen]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Client name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Client name must be at least 2 characters';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onSave({
      name: formData.name.trim(),
      email: formData.email.trim().toLowerCase(),
      phone: formData.phone.trim(),
      company: formData.company.trim(),
      address: formData.address.trim(),
      status: formData.status,
    });
  };

  const updateField = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>{client ? 'Edit Client' : 'New Client'}</h2>
          <button onClick={onClose} style={styles.closeBtn}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={styles.row}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Client Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                style={{ ...styles.input, ...(errors.name ? styles.inputError : {}) }}
                placeholder="John Doe"
                disabled={isSaving}
                className="modal-input-focus"
              />
              {errors.name && <p style={styles.errorText}>{errors.name}</p>}
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
                style={{ ...styles.input, ...(errors.email ? styles.inputError : {}) }}
                placeholder="client@example.com"
                disabled={isSaving}
                className="modal-input-focus"
              />
              {errors.email && <p style={styles.errorText}>{errors.email}</p>}
            </div>
          </div>

          <div style={styles.row}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                style={{ ...styles.input, ...(errors.phone ? styles.inputError : {}) }}
                placeholder="+1 234 567 8900"
                disabled={isSaving}
                className="modal-input-focus"
              />
              {errors.phone && <p style={styles.errorText}>{errors.phone}</p>}
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Company</label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => updateField('company', e.target.value)}
                style={{ ...styles.input, ...(errors.company ? styles.inputError : {}) }}
                placeholder="Company Name"
                disabled={isSaving}
                className="modal-input-focus"
              />
              {errors.company && <p style={styles.errorText}>{errors.company}</p>}
            </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Address</label>
            <textarea
              value={formData.address}
              onChange={(e) => updateField('address', e.target.value)}
              style={{ ...styles.textarea, ...(errors.address ? styles.inputError : {}) }}
              placeholder="Client address"
              rows={2}
              disabled={isSaving}
              className="modal-input-focus"
            />
            {errors.address && <p style={styles.errorText}>{errors.address}</p>}
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Status</label>
            <div style={styles.selectWrapper}>
              <select
                value={formData.status}
                onChange={(e) => updateField('status', e.target.value as 'active' | 'inactive')}
                style={styles.select}
                disabled={isSaving}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {!client && (
            <div style={styles.infoBox}>
              <p style={styles.infoText}>
                <strong>Note:</strong> Credentials will be generated and emailed to the client automatically upon saving.
              </p>
            </div>
          )}

          {submitError && <p style={styles.submitError}>{submitError}</p>}

          <div style={styles.modalFooter}>
            <button type="button" onClick={onClose} style={styles.cancelBtn} disabled={isSaving}>Cancel</button>
            <button type="submit" style={styles.saveBtn} disabled={isSaving}>
              {isSaving ? 'Saving...' : client ? 'Update Client' : 'Save Client'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; transform: translateY(20px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .modal-input-focus:focus {
          border-color: #007AFF !important;
          box-shadow: 0 0 0 3px rgba(0,122,255,0.1) !important;
        }
      `}</style>
    </div>
  );
}

const styles: any = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
  },
  modal: {
    backgroundColor: 'var(--bg-primary)',
    borderRadius: '32px',
    padding: '32px',
    width: '95%',
    maxWidth: '640px',
    maxHeight: '90vh',
    overflowY: 'auto',
    animation: 'modalFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    border: '1.5px solid var(--border-color)',
    boxShadow: '0 24px 60px rgba(0,0,0,0.2)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '28px',
  },
  modalTitle: {
    fontSize: '28px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    letterSpacing: '-1px',
  },
  closeBtn: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    padding: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formGroup: {
    marginBottom: '24px',
    flex: 1,
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '8px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    fontSize: '15px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1.5px solid var(--border-color)',
    borderRadius: '14px',
    outline: 'none',
    color: 'var(--text-primary)',
    fontFamily: 'inherit',
    transition: 'all 0.2s ease',
  },
  textarea: {
    width: '100%',
    padding: '14px 16px',
    fontSize: '15px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1.5px solid var(--border-color)',
    borderRadius: '14px',
    outline: 'none',
    color: 'var(--text-primary)',
    fontFamily: 'inherit',
    resize: 'none',
  },
  selectWrapper: {
    position: 'relative',
  },
  select: {
    width: '100%',
    padding: '14px 16px',
    fontSize: '15px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1.5px solid var(--border-color)',
    borderRadius: '14px',
    outline: 'none',
    color: 'var(--text-primary)',
    fontFamily: 'inherit',
    appearance: 'none',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    fontSize: '12px',
    color: '#FF3B30',
    marginTop: '6px',
    fontWeight: 500,
  },
  row: {
    display: 'flex',
    gap: '20px',
    flexWrap: 'wrap',
  },
  infoBox: {
    backgroundColor: 'rgba(0, 122, 255, 0.05)',
    padding: '16px',
    borderRadius: '14px',
    marginBottom: '24px',
    border: '1px solid rgba(0, 122, 255, 0.1)',
  },
  infoText: {
    fontSize: '13px',
    color: '#007AFF',
    margin: 0,
    lineHeight: 1.5,
  },
  submitError: {
    fontSize: '14px',
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: '20px',
    fontWeight: 600,
  },
  modalFooter: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    marginTop: '12px',
  },
  cancelBtn: {
    padding: '12px 24px',
    fontSize: '15px',
    fontWeight: 700,
    backgroundColor: 'transparent',
    border: '1.5px solid var(--border-color)',
    borderRadius: '14px',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  saveBtn: {
    padding: '12px 28px',
    fontSize: '15px',
    fontWeight: 700,
    backgroundColor: '#007AFF',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '14px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 8px 16px rgba(0,122,255,0.2)',
  },
};
