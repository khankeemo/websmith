"use client";

import { useEffect, useState } from "react";
import { User, Mail, Phone, Building, Lock, Bell, Save, Eye, EyeOff } from "lucide-react";
import API from "../../../core/services/apiService";
import {
  getPasswordValidationMessage,
  validatePhone,
  validateStrongPassword,
} from "../../../core/utils/validation";

export default function ClientProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  
  // Profile editing
  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
  });

  // Password change
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Notification preferences
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    projectUpdates: true,
    queryResponses: true,
  });

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const response = await API.get("/users/profile");
      const userData = response.data.data || response.data.user;
      setUser(userData);
      setProfileForm({
        name: userData.name || "",
        email: userData.email || "",
        phone: userData.phone || "",
        company: userData.company || "",
      });
      setNotifications({
        email: userData.preferences?.notifications?.email ?? true,
        push: userData.preferences?.notifications?.push ?? true,
        projectUpdates: userData.preferences?.notifications?.projectUpdates ?? true,
        queryResponses: userData.preferences?.notifications?.queryResponses ?? true,
      });
    } catch (err) {
      console.error("Failed to fetch profile:", err);
      setError("Failed to load profile data");
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    if (profileForm.phone && !validatePhone(profileForm.phone)) {
      setError("Please enter a valid phone number");
      setSaving(false);
      return;
    }

    try {
      await API.put("/users/update", profileForm);
      setMessage("Profile updated successfully");
      await fetchUserProfile();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    if (!validateStrongPassword(passwordForm.newPassword)) {
      setError(getPasswordValidationMessage());
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await API.post("/users/change-password", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setMessage("Password changed successfully");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setShowPasswordFields(false);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to change password");
    } finally {
      setSaving(false);
    }
  };

  const handleNotificationUpdate = async (key: string, value: boolean) => {
    const updatedNotifications = { ...notifications, [key]: value };
    setNotifications(updatedNotifications);

    try {
      await API.put("/users/update", {
        preferences: {
          notifications: {
            email: updatedNotifications.email,
            push: updatedNotifications.push,
            projectUpdates: updatedNotifications.projectUpdates,
            queryResponses: updatedNotifications.queryResponses,
          },
        },
      });
      setMessage("Notification preferences updated");
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      console.error("Failed to update notifications:", err);
    }
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p style={{ color: "var(--text-secondary)" }}>Loading profile...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Profile Settings</h1>
        <p style={styles.subtitle}>Manage your account information and preferences</p>
      </div>

      {message && <div style={styles.successMessage}>{message}</div>}
      {error && <div style={styles.errorMessage}>{error}</div>}

      <div style={styles.grid}>
        {/* Personal Information */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <User size={20} color="#007AFF" />
            <h2 style={styles.cardTitle}>Personal Information</h2>
          </div>
          <form onSubmit={handleProfileUpdate} style={styles.form}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Full Name</label>
              <div style={styles.inputWrapper}>
                <User size={16} color="var(--text-secondary)" />
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  style={styles.input}
                  required
                />
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Email Address</label>
              <div style={styles.inputWrapper}>
                <Mail size={16} color="var(--text-secondary)" />
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  style={styles.input}
                  required
                  readOnly
                />
              </div>
              <p style={styles.hint}>Email cannot be changed</p>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Phone Number</label>
              <div style={styles.inputWrapper}>
                <Phone size={16} color="var(--text-secondary)" />
                <input
                  type="tel"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  style={styles.input}
                  placeholder="+1 (555) 000-0000"
                />
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Company</label>
              <div style={styles.inputWrapper}>
                <Building size={16} color="var(--text-secondary)" />
                <input
                  type="text"
                  value={profileForm.company}
                  onChange={(e) => setProfileForm({ ...profileForm, company: e.target.value })}
                  style={styles.input}
                  placeholder="Your company name"
                />
              </div>
            </div>

            <button type="submit" style={styles.primaryBtn} disabled={saving}>
              <Save size={16} />
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </form>
        </div>

        {/* Security */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <Lock size={20} color="#10B981" />
            <h2 style={styles.cardTitle}>Security</h2>
          </div>
          
          {!showPasswordFields ? (
            <button 
              onClick={() => setShowPasswordFields(true)} 
              style={styles.secondaryBtn}
            >
              <Lock size={16} />
              Change Password
            </button>
          ) : (
            <form onSubmit={handlePasswordChange} style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Current Password</label>
                <div style={styles.inputWrapper}>
                  <Lock size={16} color="var(--text-secondary)" />
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    style={styles.input}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    style={styles.eyeBtn}
                  >
                    {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>New Password</label>
                <div style={styles.inputWrapper}>
                  <Lock size={16} color="var(--text-secondary)" />
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    style={styles.input}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    style={styles.eyeBtn}
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Confirm New Password</label>
                <div style={styles.inputWrapper}>
                  <Lock size={16} color="var(--text-secondary)" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    style={styles.input}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeBtn}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p style={styles.hint}>{getPasswordValidationMessage()}</p>
              </div>

              <div style={styles.buttonGroup}>
                <button 
                  type="button"
                  onClick={() => {
                    setShowPasswordFields(false);
                    setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
                  }} 
                  style={styles.cancelBtn}
                >
                  Cancel
                </button>
                <button type="submit" style={styles.primaryBtn} disabled={saving}>
                  <Lock size={16} />
                  {saving ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Notification Preferences */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <Bell size={20} color="#FF9500" />
            <h2 style={styles.cardTitle}>Notification Preferences</h2>
          </div>
          
          <div style={styles.notificationList}>
            <div style={styles.notificationItem}>
              <div style={styles.notificationInfo}>
                <Mail size={16} color="#007AFF" />
                <div>
                  <p style={styles.notificationTitle}>Email Notifications</p>
                  <p style={styles.notificationDesc}>Receive notifications via email</p>
                </div>
              </div>
              <label style={styles.toggle}>
                <input
                  type="checkbox"
                  checked={notifications.email}
                  onChange={(e) => handleNotificationUpdate("email", e.target.checked)}
                  style={styles.toggleInput}
                />
                <span style={{
                  ...styles.toggleSlider,
                  backgroundColor: notifications.email ? "#007AFF" : "var(--border-color)"
                }}></span>
              </label>
            </div>

            <div style={styles.notificationItem}>
              <div style={styles.notificationInfo}>
                <Bell size={16} color="#10B981" />
                <div>
                  <p style={styles.notificationTitle}>Push Notifications</p>
                  <p style={styles.notificationDesc}>Browser push notifications</p>
                </div>
              </div>
              <label style={styles.toggle}>
                <input
                  type="checkbox"
                  checked={notifications.push}
                  onChange={(e) => handleNotificationUpdate("push", e.target.checked)}
                  style={styles.toggleInput}
                />
                <span style={{
                  ...styles.toggleSlider,
                  backgroundColor: notifications.push ? "#10B981" : "var(--border-color)"
                }}></span>
              </label>
            </div>

            <div style={styles.notificationItem}>
              <div style={styles.notificationInfo}>
                <User size={16} color="#FF9500" />
                <div>
                  <p style={styles.notificationTitle}>Project Updates</p>
                  <p style={styles.notificationDesc}>Get notified about project status changes</p>
                </div>
              </div>
              <label style={styles.toggle}>
                <input
                  type="checkbox"
                  checked={notifications.projectUpdates}
                  onChange={(e) => handleNotificationUpdate("projectUpdates", e.target.checked)}
                  style={styles.toggleInput}
                />
                <span style={{
                  ...styles.toggleSlider,
                  backgroundColor: notifications.projectUpdates ? "#FF9500" : "var(--border-color)"
                }}></span>
              </label>
            </div>

            <div style={styles.notificationItem}>
              <div style={styles.notificationInfo}>
                <Mail size={16} color="#8B5CF6" />
                <div>
                  <p style={styles.notificationTitle}>Query Responses</p>
                  <p style={styles.notificationDesc}>Get notified when queries are answered</p>
                </div>
              </div>
              <label style={styles.toggle}>
                <input
                  type="checkbox"
                  checked={notifications.queryResponses}
                  onChange={(e) => handleNotificationUpdate("queryResponses", e.target.checked)}
                  style={styles.toggleInput}
                />
                <span style={{
                  ...styles.toggleSlider,
                  backgroundColor: notifications.queryResponses ? "#8B5CF6" : "var(--border-color)"
                }}></span>
              </label>
            </div>
          </div>
        </div>

        {/* Account Information */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <User size={20} color="#8B5CF6" />
            <h2 style={styles.cardTitle}>Account Information</h2>
          </div>
          
          <div style={styles.infoList}>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Role:</span>
              <span style={styles.infoValue}>{user?.role?.toUpperCase() || "CLIENT"}</span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Account Created:</span>
              <span style={styles.infoValue}>
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }) : 'N/A'}
              </span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Client ID:</span>
              <span style={styles.infoValue}>{user?._id || 'N/A'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: any = {
  container: {
    padding: "8px 4px",
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
    minHeight: "100vh",
  },
  header: { marginBottom: "32px" },
  title: { fontSize: "34px", fontWeight: 700, color: "var(--text-primary)", margin: 0, marginBottom: "8px", letterSpacing: "-1px" },
  subtitle: { fontSize: "15px", color: "var(--text-secondary)", margin: 0 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "24px" },
  card: { backgroundColor: "var(--bg-primary)", borderRadius: "20px", border: "1.5px solid var(--border-color)", padding: "24px", boxShadow: "0 4px 12px rgba(0,0,0,0.03)" },
  cardHeader: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px", paddingBottom: "16px", borderBottom: "1px solid var(--border-color)" },
  cardTitle: { fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", margin: 0 },
  form: { display: "flex", flexDirection: "column", gap: "20px" },
  formGroup: { display: "flex", flexDirection: "column", gap: "8px" },
  label: { fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" },
  inputWrapper: { display: "flex", alignItems: "center", gap: "10px", border: "1.5px solid var(--border-color)", borderRadius: "12px", padding: "10px 14px", backgroundColor: "var(--bg-secondary)" },
  input: { flex: 1, border: "none", outline: "none", fontSize: "14px", backgroundColor: "transparent", color: "var(--text-primary)" },
  hint: { fontSize: "12px", color: "var(--text-secondary)", margin: "4px 0 0 0" },
  primaryBtn: { padding: "12px 20px", backgroundColor: "#007AFF", color: "#FFFFFF", border: "none", borderRadius: "12px", fontSize: "14px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" },
  secondaryBtn: { padding: "12px 20px", backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)", border: "1.5px solid var(--border-color)", borderRadius: "12px", fontSize: "14px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" },
  cancelBtn: { padding: "12px 20px", backgroundColor: "transparent", color: "var(--text-primary)", border: "1.5px solid var(--border-color)", borderRadius: "12px", fontSize: "14px", fontWeight: 600, cursor: "pointer" },
  buttonGroup: { display: "flex", gap: "12px", marginTop: "8px" },
  eyeBtn: { border: "none", backgroundColor: "transparent", cursor: "pointer", color: "var(--text-secondary)", padding: "4px" },
  notificationList: { display: "flex", flexDirection: "column", gap: "16px" },
  notificationItem: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", backgroundColor: "var(--bg-secondary)", borderRadius: "12px", border: "1px solid var(--border-color)" },
  notificationInfo: { display: "flex", alignItems: "center", gap: "12px", flex: 1 },
  notificationTitle: { fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", margin: 0 },
  notificationDesc: { fontSize: "12px", color: "var(--text-secondary)", margin: "4px 0 0 0" },
  toggle: { position: "relative" as const, width: "48px", height: "24px", cursor: "pointer" },
  toggleInput: { display: "none" },
  toggleSlider: { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0, borderRadius: "12px", transition: "all 0.3s ease" },
  infoList: { display: "flex", flexDirection: "column", gap: "12px" },
  infoRow: { display: "flex", justifyContent: "space-between", paddingBottom: "12px", borderBottom: "1px solid var(--border-color)" },
  infoLabel: { fontSize: "13px", color: "var(--text-secondary)", fontWeight: 600 },
  infoValue: { fontSize: "13px", color: "var(--text-primary)", fontWeight: 600 },
  loadingContainer: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "400px", gap: "16px" },
  spinner: { width: "32px", height: "32px", border: "3px solid var(--border-color)", borderTopColor: "#007AFF", borderRadius: "50%", animation: "spin 0.8s linear infinite" },
  successMessage: { padding: "12px 16px", backgroundColor: "rgba(52, 199, 89, 0.1)", border: "1px solid #34C759", borderRadius: "12px", fontSize: "14px", color: "#34C759", marginBottom: "24px" },
  errorMessage: { padding: "12px 16px", backgroundColor: "rgba(255, 59, 48, 0.1)", border: "1px solid #FF3B30", borderRadius: "12px", fontSize: "14px", color: "#FF3B30", marginBottom: "24px" },
};
