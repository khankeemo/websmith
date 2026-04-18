"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Lock, ShieldAlert } from "lucide-react";
import API from "../../core/services/apiService";
import {
  getPasswordChecklistItems,
  getPasswordValidationMessage,
  validateStrongPassword,
} from "../../core/utils/validation";

interface ForcedPasswordResetModalProps {
  isOpen: boolean;
  onCompleted: () => void;
  onLogout: () => void;
}

export default function ForcedPasswordResetModal({ isOpen, onCompleted, onLogout }: ForcedPasswordResetModalProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const checklistItems = useMemo(() => getPasswordChecklistItems(newPassword), [newPassword]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (!validateStrongPassword(newPassword)) {
      setError(getPasswordValidationMessage());
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await API.post("/auth/change-password", { newPassword });
      onCompleted();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to update password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <ShieldAlert size={22} color="#007AFF" />
          <h2 style={styles.title}>Reset Your Password</h2>
        </div>
        <p style={styles.subtitle}>For security, please update your password now.</p>

        {error ? (
          <div style={styles.errorBox}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>New Password</label>
          <div style={styles.inputWrap}>
            <Lock size={16} style={styles.inputIcon} />
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              style={styles.input}
              placeholder="Enter a strong password"
              disabled={loading}
            />
          </div>

          <label style={styles.label}>Confirm Password</label>
          <div style={styles.inputWrap}>
            <Lock size={16} style={styles.inputIcon} />
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              style={styles.input}
              placeholder="Re-enter password"
              disabled={loading}
            />
          </div>

          <div style={styles.checklist}>
            {checklistItems.map((item) => (
              <div key={item.key} style={styles.checklistItem}>
                <span style={{ ...styles.checkDot, backgroundColor: item.met ? "#10B981" : "#D1D5DB" }} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>

          <div style={styles.footer}>
            <button type="button" onClick={onLogout} style={styles.cancelButton} disabled={loading}>
              Logout
            </button>
            <button type="submit" style={styles.submitButton} disabled={loading}>
              {loading ? "Updating..." : "Update Password"}
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
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 2500,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.52)",
    backdropFilter: "blur(4px)",
    padding: "20px",
  },
  modal: {
    width: "100%",
    maxWidth: "520px",
    borderRadius: "18px",
    backgroundColor: "#FFFFFF",
    border: "1px solid #E5E7EB",
    padding: "24px",
    boxShadow: "0 28px 54px rgba(0, 0, 0, 0.16)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  title: {
    margin: 0,
    fontSize: "24px",
    fontWeight: 700,
    color: "#111827",
  },
  subtitle: {
    margin: "10px 0 18px 0",
    color: "#4B5563",
    fontSize: "14px",
  },
  errorBox: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    borderRadius: "12px",
    border: "1px solid rgba(239, 68, 68, 0.24)",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    color: "#B91C1C",
    fontSize: "13px",
    padding: "10px 12px",
    marginBottom: "14px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  label: {
    color: "#1F2937",
    fontSize: "13px",
    fontWeight: 600,
    marginTop: "4px",
  },
  inputWrap: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  inputIcon: {
    position: "absolute",
    left: "12px",
    color: "#6B7280",
  },
  input: {
    width: "100%",
    borderRadius: "12px",
    border: "1px solid #D1D5DB",
    fontSize: "14px",
    padding: "12px 12px 12px 38px",
    outline: "none",
  },
  checklist: {
    marginTop: "10px",
    border: "1px solid #E5E7EB",
    borderRadius: "12px",
    backgroundColor: "#F9FAFB",
    padding: "12px",
    display: "grid",
    gap: "8px",
  },
  checklistItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "#374151",
    fontSize: "13px",
  },
  checkDot: {
    width: "10px",
    height: "10px",
    borderRadius: "999px",
    flexShrink: 0,
  },
  footer: {
    marginTop: "12px",
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
  },
  cancelButton: {
    border: "1px solid #D1D5DB",
    borderRadius: "10px",
    backgroundColor: "#FFFFFF",
    color: "#374151",
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 600,
  },
  submitButton: {
    border: "none",
    borderRadius: "10px",
    backgroundColor: "#007AFF",
    color: "#FFFFFF",
    padding: "10px 16px",
    cursor: "pointer",
    fontWeight: 700,
  },
};
