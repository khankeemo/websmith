"use client";

import { useMemo, useState } from "react";
import { X, Lock, AlertCircle, CheckCircle, Eye, EyeOff } from "lucide-react";
import API from "../../core/services/apiService";
import {
  getPasswordChecklistItems,
  getPasswordValidationMessage,
  validateStrongPassword,
} from "../../core/utils/validation";

interface PasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PasswordModal({ isOpen, onClose }: PasswordModalProps) {
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const checklistItems = useMemo(() => getPasswordChecklistItems(formData.newPassword), [formData.newPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (formData.newPassword !== formData.confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    if (!validateStrongPassword(formData.newPassword)) {
      setError(getPasswordValidationMessage());
      return;
    }

    setLoading(true);

    try {
      const response = await API.post("/users/change-password", {
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword
      });

      if (response.data.success) {
        setSuccess("Password changed successfully!");
        setFormData({ currentPassword: "", newPassword: "", confirmPassword: "" });
        setTimeout(() => {
          setSuccess("");
          onClose();
        }, 2000);
      } else {
        setError(response.data.message || "Failed to change password");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <Lock size={24} color="#007AFF" />
            <h2 style={styles.title}>Change Password</h2>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>
            <X size={20} />
          </button>
        </div>

        {success && (
          <div style={styles.successMessage}>
            <CheckCircle size={16} />
            <span>{success}</span>
          </div>
        )}

        {error && (
          <div style={styles.errorMessage}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Current Password</label>
            <div style={styles.inputWrap}>
              <input
                type={showCurrentPassword ? "text" : "password"}
                value={formData.currentPassword}
                onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                style={styles.input}
                required
                disabled={loading}
              />
              <button type="button" onClick={() => setShowCurrentPassword((value) => !value)} style={styles.eyeBtn}>
                {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>New Password</label>
            <div style={styles.inputWrap}>
              <input
                type={showNewPassword ? "text" : "password"}
                value={formData.newPassword}
                onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                style={styles.input}
                required
                disabled={loading}
              />
              <button type="button" onClick={() => setShowNewPassword((value) => !value)} style={styles.eyeBtn}>
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p style={styles.hint}>{getPasswordValidationMessage()}</p>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Confirm New Password</label>
            <div style={styles.inputWrap}>
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                style={styles.input}
                required
                disabled={loading}
              />
              <button type="button" onClick={() => setShowConfirmPassword((value) => !value)} style={styles.eyeBtn}>
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div style={styles.checklist}>
            {checklistItems.map((item) => (
              <div key={item.key} style={styles.checklistItem}>
                <span style={{ ...styles.checkDot, backgroundColor: item.met ? "#34C759" : "#D1D5DB" }} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>

          <div style={styles.footer}>
            <button 
              type="button" 
              onClick={onClose} 
              style={styles.cancelBtn} 
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              style={styles.submitBtn} 
              disabled={loading}
            >
              {loading ? "Changing..." : "Change Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, any> = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    backdropFilter: "blur(10px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2000,
  },
  modal: {
    backgroundColor: "var(--bg-primary)",
    borderRadius: "24px",
    padding: "32px",
    width: "95%",
    maxWidth: "500px",
    boxShadow: "0 24px 60px rgba(0,0,0,0.2)",
    border: "1.5px solid var(--border-color)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "24px",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  title: {
    fontSize: "24px",
    fontWeight: 700,
    color: "var(--text-primary)",
    margin: 0,
  },
  closeBtn: {
    background: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
    borderRadius: "12px",
    cursor: "pointer",
    padding: "8px",
    display: "flex",
    alignItems: "center",
    color: "var(--text-secondary)",
  },
  successMessage: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "rgba(52, 199, 89, 0.1)",
    border: "1px solid #34C759",
    borderRadius: "12px",
    padding: "12px 16px",
    color: "#34C759",
    marginBottom: "20px",
    fontSize: "14px",
    fontWeight: 500,
  },
  errorMessage: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "rgba(255, 59, 48, 0.1)",
    border: "1px solid #FF3B30",
    borderRadius: "12px",
    padding: "12px 16px",
    color: "#FF3B30",
    marginBottom: "20px",
    fontSize: "14px",
    fontWeight: 500,
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginBottom: "20px",
  },
  label: {
    fontSize: "13px",
    fontWeight: 700,
    color: "var(--text-primary)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  input: {
    width: "100%",
    padding: "14px 16px",
    backgroundColor: "var(--bg-secondary)",
    border: "1.5px solid var(--border-color)",
    borderRadius: "12px",
    fontSize: "15px",
    color: "var(--text-primary)",
    outline: "none",
    transition: "all 0.2s ease",
  },
  inputWrap: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  eyeBtn: {
    position: "absolute",
    right: "14px",
    border: "none",
    backgroundColor: "transparent",
    color: "var(--text-secondary)",
    cursor: "pointer",
    display: "flex",
  },
  hint: {
    fontSize: "12px",
    color: "var(--text-secondary)",
    margin: "4px 0 0 0",
  },
  checklist: {
    display: "grid",
    gap: "8px",
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
    borderRadius: "14px",
    padding: "14px",
  },
  checklistItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontSize: "13px",
    color: "var(--text-primary)",
  },
  checkDot: {
    width: "10px",
    height: "10px",
    borderRadius: "999px",
    flexShrink: 0,
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    marginTop: "24px",
  },
  cancelBtn: {
    padding: "12px 24px",
    backgroundColor: "transparent",
    border: "1.5px solid var(--border-color)",
    borderRadius: "12px",
    fontSize: "15px",
    fontWeight: 600,
    color: "var(--text-secondary)",
    cursor: "pointer",
  },
  submitBtn: {
    padding: "12px 28px",
    backgroundColor: "#007AFF",
    border: "none",
    borderRadius: "12px",
    fontSize: "15px",
    fontWeight: 600,
    color: "#ffffff",
    cursor: "pointer",
    boxShadow: "0 8px 16px rgba(0,122,255,0.2)",
  },
};
