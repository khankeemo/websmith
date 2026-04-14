// PATH: C:\websmith\app\admin\services\components\ServiceModal.tsx
"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { ManagedService, ManagedServicePayload } from "@/app/services/services/adminService";

interface ServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (service: ManagedServicePayload) => Promise<void>;
  service?: ManagedService | null;
  isSaving?: boolean;
  submitError?: string | null;
}

interface FormData {
  name: string;
  description: string;
  isActive: boolean;
}

export default function ServiceModal({
  isOpen,
  onClose,
  onSave,
  service,
  isSaving = false,
  submitError,
}: ServiceModalProps) {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    description: "",
    isActive: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (service) {
      setFormData({
        name: service.name || "",
        description: service.description || "",
        isActive: service.isActive ?? true,
      });
    } else {
      setFormData({
        name: "",
        description: "",
        isActive: true,
      });
    }
    setErrors({});
  }, [service, isOpen]);

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      nextErrors.name = "Service name is required";
    }

    if (!formData.description.trim()) {
      nextErrors.description = "Description is required";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    await onSave({
      name: formData.name.trim(),
      description: formData.description.trim(),
      isActive: formData.isActive,
    });
  };

  const updateField = (field: keyof FormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>{service ? "Edit Service" : "New Service"}</h2>
          <button onClick={onClose} style={styles.closeBtn}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Service Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(event) => updateField("name", event.target.value)}
              style={{ ...styles.input, ...(errors.name ? styles.inputError : {}) }}
              placeholder="Web Development"
              disabled={isSaving}
              className="modal-input-focus"
            />
            {errors.name && <p style={styles.errorText}>{errors.name}</p>}
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Description *</label>
            <textarea
              value={formData.description}
              onChange={(event) => updateField("description", event.target.value)}
              style={{ ...styles.textarea, ...(errors.description ? styles.inputError : {}) }}
              placeholder="Describe what this service includes"
              rows={4}
              disabled={isSaving}
              className="modal-input-focus"
            />
            {errors.description && <p style={styles.errorText}>{errors.description}</p>}
          </div>

          <div style={styles.row}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Visibility</label>
              <div style={styles.selectWrapper}>
                <select
                  value={formData.isActive ? "active" : "inactive"}
                  onChange={(event) => updateField("isActive", event.target.value === "active")}
                  style={styles.select}
                  disabled={isSaving}
                >
                  <option value="active">Active (Visible)</option>
                  <option value="inactive">Inactive (Hidden)</option>
                </select>
              </div>
            </div>
          </div>

          {submitError && <p style={styles.submitError}>{submitError}</p>}

          <div style={styles.modalFooter}>
            <button type="button" onClick={onClose} style={styles.cancelBtn} disabled={isSaving}>
              Cancel
            </button>
            <button type="submit" style={styles.saveBtn} disabled={isSaving}>
              {isSaving ? "Saving..." : service ? "Update Service" : "Save Service"}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes modalSlideUp {
          from { opacity: 0; transform: translateY(30px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .modal-input-focus:focus {
          border-color: #007AFF !important;
          box-shadow: 0 0 0 3px rgba(0,122,255,0.1) !important;
          background-color: var(--bg-primary) !important;
        }
      `}</style>
    </div>
  );
}

const styles: any = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    backdropFilter: "blur(12px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2000,
  },
  modal: {
    backgroundColor: "var(--bg-primary)",
    borderRadius: "32px",
    padding: "40px",
    width: "95%",
    maxWidth: "680px",
    maxHeight: "90vh",
    overflowY: "auto",
    animation: "modalSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
    border: '1.5px solid var(--border-color)',
    boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "32px",
  },
  modalTitle: {
    fontSize: "30px",
    fontWeight: 700,
    color: "var(--text-primary)",
    letterSpacing: '-1px',
    margin: 0,
  },
  closeBtn: {
    background: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
    borderRadius: "14px",
    cursor: "pointer",
    color: "var(--text-secondary)",
    padding: "8px",
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
  formGroup: {
    marginBottom: "24px",
    flex: 1,
  },
  label: {
    display: "block",
    fontSize: "13px",
    fontWeight: 700,
    color: "var(--text-primary)",
    marginBottom: "10px",
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  input: {
    width: "100%",
    padding: "16px",
    fontSize: "16px",
    backgroundColor: 'var(--bg-secondary)',
    border: "1.5px solid var(--border-color)",
    borderRadius: "16px",
    outline: "none",
    color: "var(--text-primary)",
    fontFamily: "inherit",
    transition: 'all 0.2s ease',
  },
  textarea: {
    width: "100%",
    padding: "16px",
    fontSize: "16px",
    backgroundColor: 'var(--bg-secondary)',
    border: "1.5px solid var(--border-color)",
    borderRadius: "16px",
    outline: "none",
    color: "var(--text-primary)",
    fontFamily: "inherit",
    resize: "none",
    transition: 'all 0.2s ease',
  },
  selectWrapper: {
    position: 'relative'
  },
  select: {
    width: "100%",
    padding: "16px",
    fontSize: "16px",
    backgroundColor: 'var(--bg-secondary)',
    border: "1.5px solid var(--border-color)",
    borderRadius: "16px",
    outline: "none",
    color: "var(--text-primary)",
    fontFamily: "inherit",
    cursor: 'pointer',
    appearance: 'none',
  },
  row: {
    display: "flex",
    gap: "24px",
    flexWrap: 'wrap',
  },
  inputError: {
    borderColor: "#FF3B30",
  },
  errorText: {
    fontSize: "13px",
    color: "#FF3B30",
    marginTop: "8px",
    fontWeight: 600,
  },
  submitError: {
    fontSize: "15px",
    color: "#FF3B30",
    textAlign: 'center',
    marginBottom: "24px",
    fontWeight: 700,
  },
  modalFooter: {
    display: "flex",
    gap: "16px",
    justifyContent: "flex-end",
    marginTop: "16px",
    paddingTop: "32px",
    borderTop: "1.5px solid var(--border-color)",
  },
  cancelBtn: {
    padding: "14px 28px",
    fontSize: "16px",
    fontWeight: 700,
    backgroundColor: "transparent",
    border: "1.5px solid var(--border-color)",
    borderRadius: "16px",
    color: "var(--text-secondary)",
    cursor: "pointer",
    fontFamily: "inherit",
    transition: 'all 0.2s ease',
  },
  saveBtn: {
    padding: "14px 32px",
    fontSize: "16px",
    fontWeight: 700,
    backgroundColor: "#007AFF",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "16px",
    cursor: "pointer",
    fontFamily: "inherit",
    boxShadow: "0 8px 16px rgba(0,122,255,0.25)",
    transition: 'all 0.2s ease',
  },
};
