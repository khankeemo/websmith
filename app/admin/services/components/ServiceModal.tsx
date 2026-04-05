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
  price: string;
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
    price: "",
    isActive: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (service) {
      setFormData({
        name: service.name || "",
        description: service.description || "",
        price: typeof service.price === "number" ? String(service.price) : "",
        isActive: service.isActive ?? true,
      });
    } else {
      setFormData({
        name: "",
        description: "",
        price: "",
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

    if (formData.price && (Number.isNaN(Number(formData.price)) || Number(formData.price) < 0)) {
      nextErrors.price = "Price must be a valid positive number";
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
      price: formData.price ? Number(formData.price) : null,
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
            />
            {errors.description && <p style={styles.errorText}>{errors.description}</p>}
          </div>

          <div style={styles.row}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Starting Price</label>
              <input
                type="number"
                min="0"
                step="1"
                value={formData.price}
                onChange={(event) => updateField("price", event.target.value)}
                style={{ ...styles.input, ...(errors.price ? styles.inputError : {}) }}
                placeholder="2500"
                disabled={isSaving}
              />
              {errors.price && <p style={styles.errorText}>{errors.price}</p>}
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Status</label>
              <select
                value={formData.isActive ? "active" : "inactive"}
                onChange={(event) => updateField("isActive", event.target.value === "active")}
                style={styles.select}
                disabled={isSaving}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
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
    backgroundColor: "rgba(0,0,0,0.5)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    backgroundColor: "#FFFFFF",
    borderRadius: "24px",
    padding: "28px",
    width: "90%",
    maxWidth: "640px",
    maxHeight: "90vh",
    overflowY: "auto",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "24px",
  },
  modalTitle: {
    fontSize: "24px",
    fontWeight: 600,
    color: "#1C1C1E",
  },
  closeBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#8E8E93",
    padding: "4px",
  },
  formGroup: {
    marginBottom: "20px",
    flex: 1,
  },
  label: {
    display: "block",
    fontSize: "14px",
    fontWeight: 500,
    color: "#1C1C1E",
    marginBottom: "8px",
  },
  input: {
    width: "100%",
    padding: "12px 16px",
    fontSize: "15px",
    border: "1.5px solid #E5E5EA",
    borderRadius: "12px",
    outline: "none",
    fontFamily: "inherit",
  },
  textarea: {
    width: "100%",
    padding: "12px 16px",
    fontSize: "15px",
    border: "1.5px solid #E5E5EA",
    borderRadius: "12px",
    outline: "none",
    fontFamily: "inherit",
    resize: "vertical",
  },
  select: {
    width: "100%",
    padding: "12px 16px",
    fontSize: "15px",
    border: "1.5px solid #E5E5EA",
    borderRadius: "12px",
    outline: "none",
    fontFamily: "inherit",
    backgroundColor: "#FFFFFF",
  },
  row: {
    display: "flex",
    gap: "16px",
  },
  inputError: {
    borderColor: "#FF3B30",
  },
  errorText: {
    fontSize: "12px",
    color: "#FF3B30",
    marginTop: "6px",
  },
  submitError: {
    fontSize: "13px",
    color: "#FF3B30",
    marginTop: "-4px",
    marginBottom: "8px",
  },
  modalFooter: {
    display: "flex",
    gap: "12px",
    justifyContent: "flex-end",
    marginTop: "24px",
    paddingTop: "16px",
    borderTop: "1px solid #E5E5EA",
  },
  cancelBtn: {
    padding: "10px 20px",
    fontSize: "14px",
    fontWeight: 500,
    backgroundColor: "#F2F2F7",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  saveBtn: {
    padding: "10px 20px",
    fontSize: "14px",
    fontWeight: 600,
    backgroundColor: "#007AFF",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    fontFamily: "inherit",
  },
};
