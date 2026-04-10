"use client";

import { useState, useEffect, useRef } from "react";
import { X, Camera, Loader2 } from "lucide-react";
import { AuthUser, setAuthSession, getToken } from "../../lib/auth";
import API from "../../core/services/apiService";

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
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    avatar: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user && isOpen) {
      setFormData({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        company: user.company || "",
        avatar: user.avatar || "",
      });
      setPreviewUrl(user.avatar || "");
      setError(null);
    }
  }, [user, isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    setError(null);

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
        onClose();
        
        // Dispatch custom event to notify other components (like Sidebar)
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

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Edit Profile</h2>
          <button onClick={onClose} style={styles.closeBtn}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} style={styles.form}>
          {/* Avatar Upload */}
          <div style={styles.avatarSection}>
            <div style={styles.avatarWrapper}>
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" style={styles.avatarImage} />
              ) : (
                <div style={styles.avatarPlaceholder}>
                  {formData.name.charAt(0).toUpperCase()}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={styles.uploadBtn}
                title="Change Photo"
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
            <p style={styles.avatarHint}>Click camera to upload a new profile picture</p>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Full Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              style={styles.input}
              placeholder="Your Name"
              required
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Email Address</label>
            <input
              type="email"
              value={formData.email}
              style={{ ...styles.input, backgroundColor: "#f9f9f9", cursor: "not-allowed" }}
              readOnly
              title="Email cannot be changed"
            />
          </div>

          <div style={styles.row}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Phone Number</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                style={styles.input}
                placeholder="+1 234 567 890"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Company</label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                style={styles.input}
                placeholder="Company Name"
              />
            </div>
          </div>

          {error && <p style={styles.errorText}>{error}</p>}

          <div style={styles.footer}>
            <button
              type="button"
              onClick={onClose}
              style={styles.cancelBtn}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={styles.saveBtn}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="spinner" style={{ marginRight: 8 }} />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .spinner {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
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
    backgroundColor: "#FFFFFF",
    borderRadius: "24px",
    width: "90%",
    maxWidth: "500px",
    padding: "32px",
    boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
    animation: "fadeIn 0.3s ease-out",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "24px",
  },
  title: {
    fontSize: "22px",
    fontWeight: 700,
    color: "#1d1d1f",
    margin: 0,
  },
  closeBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#8e8e93",
    padding: "4px",
    borderRadius: "50%",
    display: "flex",
    transition: "background 0.2s",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  avatarSection: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    marginBottom: "8px",
  },
  avatarWrapper: {
    position: "relative",
    width: "90px",
    height: "90px",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: "50%",
    objectFit: "cover",
    border: "3px solid #f2f2f7",
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
    fontSize: "32px",
    fontWeight: 600,
  },
  uploadBtn: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#007AFF",
    color: "#FFFFFF",
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "2px solid #FFFFFF",
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
    transition: "transform 0.2s",
  },
  avatarHint: {
    fontSize: "12px",
    color: "#8e8e93",
    marginTop: "12px",
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    flex: 1,
  },
  label: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#1d1d1f",
  },
  input: {
    padding: "12px 16px",
    borderRadius: "12px",
    border: "1.5px solid #e5e5ea",
    fontSize: "15px",
    outline: "none",
    transition: "border-color 0.2s",
    width: "100%",
  },
  row: {
    display: "flex",
    gap: "16px",
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    marginTop: "24px",
    paddingTop: "24px",
    borderTop: "1px solid #f2f2f7",
  },
  cancelBtn: {
    padding: "12px 20px",
    borderRadius: "12px",
    border: "none",
    backgroundColor: "#f2f2f7",
    color: "#1d1d1f",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  saveBtn: {
    padding: "12px 24px",
    borderRadius: "12px",
    border: "none",
    backgroundColor: "#007AFF",
    color: "#FFFFFF",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "140px",
  },
  errorText: {
    color: "#FF3B30",
    fontSize: "13px",
    margin: "0 0 16px 0",
    textAlign: "center",
  },
};
