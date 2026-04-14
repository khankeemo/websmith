"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { X, Camera, Loader2, Eye, EyeOff } from "lucide-react";
import { AuthUser, setAuthSession, getToken } from "../../lib/auth";
import API from "../../core/services/apiService";
import {
  getPasswordChecklistItems,
  getPasswordValidationMessage,
  validatePhone,
  validateStrongPassword,
} from "../../core/utils/validation";

type PanelMode = "view" | "edit-profile" | "edit-password";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AuthUser | null;
  onUpdate: (updatedUser: AuthUser) => void;
}

export default function ProfileModal({
  isOpen,
  onClose,
  user,
  onUpdate,
}: ProfileModalProps) {
  const [panelMode, setPanelMode] = useState<PanelMode>("view");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    avatar: "",
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const passwordChecklist = useMemo(
    () => getPasswordChecklistItems(passwordData.newPassword),
    [passwordData.newPassword]
  );

  useEffect(() => {
    if (!isOpen) return;
    setPanelMode("view");
    setError(null);
    if (user) {
      setFormData({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        company: user.company || "",
        avatar: user.avatar || "",
      });
      setPreviewUrl(user.avatar || "");
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    }
  }, [user, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const syncCurrentProfile = async () => {
      try {
        const response = await API.get("/users/profile");
        const liveUser = response.data.user || response.data.data;
        if (!liveUser) return;
        const token = getToken();
        if (token) {
          setAuthSession(token, liveUser);
        }
        onUpdate(liveUser);
        setFormData({
          name: liveUser.name || "",
          email: liveUser.email || "",
          phone: liveUser.phone || "",
          company: liveUser.company || "",
          avatar: liveUser.avatar || "",
        });
        setPreviewUrl(liveUser.avatar || "");
      } catch (err) {
        console.error("Failed to refresh profile modal data:", err);
      }
    };

    syncCurrentProfile();
  }, [isOpen, onUpdate]);

  const handleClose = () => {
    setPanelMode("view");
    setError(null);
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (panelMode !== "edit-profile") return;
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        setError("Image size should be less than 1MB");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setPreviewUrl(base64);
        setFormData((prev) => ({ ...prev, avatar: base64 }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    setError(null);

    if (formData.phone && !validatePhone(formData.phone)) {
      setError("Please enter a valid phone number");
      setIsSaving(false);
      return;
    }

    try {
      const response = await API.put("/users/update", {
        name: formData.name,
        phone: formData.phone,
        company: formData.company,
        avatar: formData.avatar,
      });

      if (response.data.success) {
        const updatedUserRaw = response.data.user;
        const updatedUser: AuthUser = {
          ...user,
          name: updatedUserRaw.name,
          phone: updatedUserRaw.phone,
          company: updatedUserRaw.company,
          avatar: updatedUserRaw.avatar,
        };

        const token = getToken();
        if (token) {
          setAuthSession(token, updatedUser);
        }

        onUpdate(updatedUser);
        setPanelMode("view");
        window.dispatchEvent(new Event("userProfileUpdated"));
      } else {
        setError(response.data.message || "Failed to update profile");
      }
    } catch (err: any) {
      console.error("Profile update error:", err);
      setError(err.response?.data?.message || "An error occurred while updating profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError("New passwords do not match");
      return;
    }
    if (!validateStrongPassword(passwordData.newPassword)) {
      setError(getPasswordValidationMessage());
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await API.post("/users/change-password", {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPanelMode("view");
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to change password");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const readOnlyField = (label: string, value: string) => (
    <div style={styles.formGroup}>
      <span style={styles.readLabel}>{label}</span>
      <div style={styles.readValue}>{value || "—"}</div>
    </div>
  );

  return (
    <div style={styles.overlay} onClick={handleClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>
            {panelMode === "view" && "Profile"}
            {panelMode === "edit-profile" && "Update profile"}
            {panelMode === "edit-password" && "Update password"}
          </h2>
          <button type="button" onClick={handleClose} style={styles.closeBtn} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {panelMode === "view" && user && (
          <div style={styles.viewBody}>
            <div style={styles.avatarSection}>
              <div style={styles.avatarWrapper}>
                {previewUrl ? (
                  <img src={previewUrl} alt="" style={styles.avatarImage} />
                ) : (
                  <div style={styles.avatarPlaceholder}>
                    {(user.name || "U").charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
            {readOnlyField("Full name", user.name)}
            {readOnlyField("Email", user.email)}
            {readOnlyField("Phone", user.phone || "")}
            {readOnlyField("Company", user.company || "")}

            <div style={styles.actionRow}>
              <button type="button" style={styles.primaryOutlineBtn} onClick={() => setPanelMode("edit-profile")}>
                Update Profile
              </button>
              <button type="button" style={styles.primaryOutlineBtn} onClick={() => setPanelMode("edit-password")}>
                Update Password
              </button>
            </div>
          </div>
        )}

        {panelMode === "edit-profile" && user && (
          <form onSubmit={handleSaveProfile} style={styles.form}>
            <div style={styles.avatarSection}>
              <div style={styles.avatarWrapper}>
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" style={styles.avatarImage} />
                ) : (
                  <div style={styles.avatarPlaceholder}>
                    {formData.name.charAt(0).toUpperCase() || "?"}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={styles.uploadBtn}
                  title="Change photo"
                >
                  <Camera size={16} />
                </button>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                style={{ display: "none" }}
              />
              <p style={styles.avatarHint}>Camera icon to change picture</p>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Full Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                style={styles.input}
                required
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Email</label>
              <input
                type="email"
                value={formData.email}
                style={{ ...styles.input, opacity: 0.85 }}
                readOnly
                title="Email cannot be changed here"
              />
            </div>

            <div style={styles.row}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  style={styles.input}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Company</label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  style={styles.input}
                />
              </div>
            </div>

            {error && <p style={styles.errorText}>{error}</p>}

            <div style={styles.footer}>
              <button type="button" onClick={() => { setError(null); setPanelMode("view"); }} style={styles.cancelBtn} disabled={isSaving}>
                Cancel
              </button>
              <button type="submit" style={styles.saveBtn} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 size={16} className="spinner" style={{ marginRight: 8 }} />
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </button>
            </div>
          </form>
        )}

        {panelMode === "edit-password" && (
          <form onSubmit={handleSavePassword} style={styles.form}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Current password</label>
              <div style={styles.inputWrap}>
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  style={styles.input}
                  required
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowCurrentPassword((value) => !value)} style={styles.inputEyeBtn}>
                  {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>New password</label>
              <div style={styles.inputWrap}>
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  style={styles.input}
                  required
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowNewPassword((value) => !value)} style={styles.inputEyeBtn}>
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Confirm new password</label>
              <div style={styles.inputWrap}>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  style={styles.input}
                  required
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowConfirmPassword((value) => !value)} style={styles.inputEyeBtn}>
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p style={styles.helperText}>{getPasswordValidationMessage()}</p>
            </div>

            <div style={styles.passwordChecklist}>
              {passwordChecklist.map((item) => (
                <div key={item.key} style={styles.passwordChecklistRow}>
                  <span style={{ ...styles.passwordChecklistDot, backgroundColor: item.met ? "#34C759" : "#D1D5DB" }} />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>

            {error && <p style={styles.errorText}>{error}</p>}

            <div style={styles.footer}>
              <button type="button" onClick={() => { setError(null); setPanelMode("view"); }} style={styles.cancelBtn} disabled={isSaving}>
                Cancel
              </button>
              <button type="submit" style={styles.saveBtn} disabled={isSaving}>
                {isSaving ? "Updating..." : "Update password"}
              </button>
            </div>
          </form>
        )}

        <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .spinner { animation: spin 1s linear infinite; }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      </div>
    </div>
  );
}

const styles: any = {
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2000,
  },
  modal: {
    backgroundColor: "var(--bg-primary)",
    borderRadius: "24px",
    width: "90%",
    maxWidth: "500px",
    padding: "28px",
    boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
    animation: "fadeIn 0.3s ease-out",
    border: "1px solid var(--border-color)",
    color: "var(--text-primary)",
    maxHeight: "90vh",
    overflowY: "auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
  },
  title: {
    fontSize: "20px",
    fontWeight: 700,
    margin: 0,
  },
  closeBtn: {
    background: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
    cursor: "pointer",
    color: "var(--text-secondary)",
    padding: "6px",
    borderRadius: "10px",
    display: "flex",
  },
  viewBody: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  readLabel: {
    fontSize: "11px",
    fontWeight: 600,
    color: "var(--text-secondary)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
  },
  readValue: {
    fontSize: "15px",
    fontWeight: 500,
    padding: "10px 12px",
    borderRadius: "10px",
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
    marginTop: "4px",
  },
  actionRow: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "10px",
    marginTop: "8px",
  },
  primaryOutlineBtn: {
    padding: "12px 16px",
    borderRadius: "12px",
    border: "1px solid #007AFF",
    background: "transparent",
    color: "#007AFF",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  avatarSection: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    marginBottom: "4px",
  },
  avatarWrapper: {
    position: "relative",
    width: "88px",
    height: "88px",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: "50%",
    objectFit: "cover",
    border: "3px solid var(--border-color)",
  },
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: "50%",
    backgroundColor: "#007AFF",
    color: "#FFFFFF",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "28px",
    fontWeight: 600,
  },
  uploadBtn: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#007AFF",
    color: "#FFFFFF",
    width: "30px",
    height: "30px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "2px solid var(--bg-primary)",
    cursor: "pointer",
  },
  avatarHint: {
    fontSize: "11px",
    color: "var(--text-secondary)",
    marginTop: "8px",
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    flex: 1,
  },
  label: {
    fontSize: "13px",
    fontWeight: 600,
  },
  input: {
    padding: "11px 14px",
    borderRadius: "10px",
    border: "1.5px solid var(--border-color)",
    fontSize: "14px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-primary)",
  },
  row: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap" as const,
  },
  inputWrap: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  inputEyeBtn: {
    position: "absolute",
    right: "12px",
    background: "transparent",
    border: "none",
    color: "var(--text-secondary)",
    cursor: "pointer",
    display: "flex",
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    marginTop: "12px",
    paddingTop: "16px",
    borderTop: "1px solid var(--border-color)",
  },
  cancelBtn: {
    padding: "10px 18px",
    borderRadius: "10px",
    border: "none",
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-primary)",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  saveBtn: {
    padding: "10px 20px",
    borderRadius: "10px",
    border: "none",
    backgroundColor: "#007AFF",
    color: "#FFFFFF",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "120px",
  },
  errorText: {
    color: "#FF3B30",
    fontSize: "13px",
    margin: 0,
    textAlign: "center",
  },
  helperText: {
    color: "var(--text-secondary)",
    fontSize: "12px",
    margin: "4px 0 0 0",
    lineHeight: 1.4,
  },
  passwordChecklist: {
    display: "grid",
    gap: "8px",
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
    borderRadius: "12px",
    padding: "12px 14px",
  },
  passwordChecklistRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontSize: "13px",
    color: "var(--text-primary)",
  },
  passwordChecklistDot: {
    width: "10px",
    height: "10px",
    borderRadius: "999px",
    flexShrink: 0,
  },
};
