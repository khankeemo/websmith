// PATH: C:\websmith\app\settings\page.tsx
// Settings Page - User profile, password, preferences
// Features: Profile management, password change, notification preferences

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  User, 
  Lock, 
  Bell, 
  CreditCard, 
  Shield, 
  ChevronRight,
  Camera,
  Save,
  Moon,
  Sun,
  Globe,
  Mail,
  Phone,
  Edit3
} from "lucide-react";
import API from "@/core/services/apiService";
import { AuthUser, getStoredUser } from "../../lib/auth";
import ProfileModal from "../../components/layout/ProfileModal";

export default function SettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("profile");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  
  // Password State
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  
  // Preferences State
  const [preferences, setPreferences] = useState({
    theme: "light",
    notifications: {
      email: true,
      push: true,
      taskUpdates: true,
      invoiceAlerts: true
    },
    language: "en"
  });

  // Fetch user data on load
  useEffect(() => {
    const storedUser = getStoredUser();
    setUser(storedUser);
    if (storedUser?.preferences) {
      setPreferences(prev => ({
        ...prev,
        ...storedUser.preferences,
        notifications: {
          ...prev.notifications,
          ...(storedUser.preferences.notifications || {})
        }
      }) as any);
    }
  }, []);

  // Update effect for storage changes
  useEffect(() => {
    const handleUpdate = () => {
      const updatedUser = getStoredUser();
      setUser(updatedUser);
      if (updatedUser?.preferences) {
        setPreferences(prev => ({
          ...prev,
          ...updatedUser.preferences,
          notifications: {
            ...prev.notifications,
            ...(updatedUser.preferences.notifications || {})
          }
        }) as any);
      }
    };
    window.addEventListener("userProfileUpdated", handleUpdate);
    return () => window.removeEventListener("userProfileUpdated", handleUpdate);
  }, []);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError("New passwords do not match");
      return;
    }
    
    if (passwordData.newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await API.post("/users/change-password", {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });

      if (response.status === 200) {
        setSuccess("Password changed successfully!");
        setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(response.data.message || "Failed to change password");
      }
    } catch (err) {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleThemeUpdate = async (newTheme: "light" | "dark") => {
    if (!user) return;
    
    try {
      const updatedPreferences = { ...preferences, theme: newTheme };
      setPreferences(updatedPreferences);
      
      const response = await API.put("/users/update", {
        preferences: updatedPreferences
      });

      if (response.status === 200) {
        // Update local storage
        const stored = JSON.parse(localStorage.getItem("user") || "{}");
        stored.preferences = updatedPreferences;
        localStorage.setItem("user", JSON.stringify(stored));
        
        // Apply theme immediately
        document.documentElement.classList.toggle('dark-theme', newTheme === 'dark');
        
        setSuccess("Theme updated!");
        setTimeout(() => setSuccess(""), 2000);
        window.dispatchEvent(new Event("userProfileUpdated"));
      }
    } catch (err) {
      setError("Failed to update theme");
    }
  };

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "password", label: "Password", icon: Lock },
    { id: "preferences", label: "Preferences", icon: Bell },
    { id: "billing", label: "Billing", icon: CreditCard }
  ];

  if (!user) return null;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Settings</h1>
        <p style={styles.subtitle}>Manage your account and preferences</p>
      </div>

      {/* Tabs */}
      <div style={styles.tabsContainer}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              ...styles.tab,
              ...(activeTab === tab.id ? styles.tabActive : {})
            }}
            className="tab-hover"
          >
            <tab.icon size={18} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div style={styles.successMessage}>
          {success}
        </div>
      )}
      {error && (
        <div style={styles.errorMessage}>
          {error}
        </div>
      )}

      {/* Tab Content */}
      <div style={styles.content}>
        {/* Profile Tab */}
        {activeTab === "profile" && (
          <div style={styles.profileTab}>
            <div style={styles.profileSummaryCard}>
              <div style={styles.avatarLarge}>
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} style={styles.avatarImg} />
                ) : (
                  <User size={40} color="#8e8e93" />
                )}
              </div>
              <div style={styles.profileText}>
                <h2 style={styles.profileName}>{user.name}</h2>
                <p style={styles.profileEmail}>{user.email}</p>
                <p style={styles.profileRole}>{user.role.toUpperCase()}</p>
              </div>
            </div>
            
            <div style={styles.actionSection}>
              <h3 style={styles.sectionTitle}>Account Actions</h3>
              <p style={styles.sectionHint}>Update your personal information, contact details, and profile picture.</p>
              <button 
                onClick={() => setIsProfileModalOpen(true)}
                style={styles.updateButton}
                className="save-btn"
              >
                <Edit3 size={18} />
                <span>Update Profile Details</span>
              </button>
            </div>
          </div>
        )}

        {/* Password Tab */}
        {activeTab === "password" && (
          <form onSubmit={handlePasswordChange} style={styles.form}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Current Password</label>
              <input
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                style={styles.input}
                required
                className="input-focus"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>New Password</label>
              <input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                style={styles.input}
                required
                className="input-focus"
              />
              <p style={styles.hint}>Minimum 6 characters</p>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Confirm New Password</label>
              <input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                style={styles.input}
                required
                className="input-focus"
              />
            </div>

            <button type="submit" disabled={loading} style={styles.saveButton} className="save-btn">
              {loading ? "Changing..." : "Change Password"}
            </button>
          </form>
        )}

        {/* Preferences Tab */}
        {activeTab === "preferences" && (
          <div style={styles.form}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>Theme Preference</h3>
              <p style={styles.sectionHint}>Choose how Websmith looks for you.</p>
            </div>
            <div style={styles.themeOptions}>
              <button
                type="button"
                onClick={() => handleThemeUpdate("light")}
                style={{
                  ...styles.themeOption,
                  ...(preferences.theme === "light" ? styles.themeOptionActive : {})
                }}
                className="theme-opt"
              >
                <Sun size={20} /> Light
              </button>
              <button
                type="button"
                onClick={() => handleThemeUpdate("dark")}
                style={{
                  ...styles.themeOption,
                  ...(preferences.theme === "dark" ? styles.themeOptionActive : {})
                }}
                className="theme-opt"
              >
                <Moon size={20} /> Dark
              </button>
            </div>

            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>Notifications</h3>
              <p style={styles.sectionHint}>Control which emails and alerts you receive.</p>
            </div>
            <div style={styles.notificationOptions}>
              {Object.entries(preferences.notifications).map(([key, val]) => (
                <label key={key} style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={val as boolean}
                    onChange={(e) => setPreferences({
                      ...preferences,
                      notifications: { ...preferences.notifications, [key]: e.target.checked }
                    })}
                    style={styles.checkbox}
                  />
                  <span style={{textTransform: 'capitalize'}}>{key.replace(/([A-Z])/g, ' $1')}</span>
                </label>
              ))}
            </div>

            <button onClick={() => setSuccess("Preferences saved!")} style={styles.saveButton} className="save-btn">
              Save All Preferences
            </button>
          </div>
        )}

        {/* Billing Tab */}
        {activeTab === "billing" && (
          <div style={styles.form}>
            <div style={styles.billingInfo}>
              <Shield size={48} color="#007AFF" />
              <h3 style={styles.billingTitle}>Billing Information</h3>
              <p style={styles.billingText}>
                Manage your subscription and payment methods
              </p>
              <button style={styles.billingButton} className="billing-btn">
                Manage Billing <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      <ProfileModal 
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        user={user}
        onUpdate={(updated) => setUser(updated)}
      />

      <style>{`
        .tab-hover { transition: all 0.25s ease; }
        .tab-hover:hover { background-color: var(--bg-secondary); transform: translateY(-1px); }
        .input-focus:focus { border-color: #007AFF !important; box-shadow: 0 0 0 4px rgba(0,122,255,0.1) !important; }
        .save-btn { transition: all 0.25s ease; cursor: pointer; }
        .save-btn:hover { background-color: #0055CC !important; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,122,255,0.3); }
        .theme-opt { transition: all 0.2s ease; }
        .theme-opt:hover { border-color: #007AFF; transform: translateY(-1px); }
      `}</style>
    </div>
  );
}

const styles: any = {
  container: {
    maxWidth: "800px",
    margin: "0 auto",
    padding: "40px 24px",
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
    minHeight: "100vh",
  },
  header: { marginBottom: "32px" },
  title: { fontSize: "34px", fontWeight: 700, marginBottom: "8px", letterSpacing: "-1px" },
  subtitle: { fontSize: "16px", color: "var(--text-secondary)" },
  tabsContainer: {
    display: "flex",
    gap: "8px",
    borderBottom: "1px solid var(--border-color)",
    marginBottom: "32px",
    paddingBottom: "4px",
  },
  tab: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 16px",
    fontSize: "14px",
    fontWeight: 600,
    color: "var(--text-secondary)",
    backgroundColor: "transparent",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
  },
  tabActive: { color: "#007AFF", backgroundColor: "rgba(0, 122, 255, 0.1)" },
  successMessage: { backgroundColor: "rgba(52, 199, 89, 0.1)", border: "1px solid #34C759", borderRadius: "12px", padding: "12px 16px", color: "#34C759", marginBottom: "24px" },
  errorMessage: { backgroundColor: "rgba(255, 59, 48, 0.1)", border: "1px solid #FF3B30", borderRadius: "12px", padding: "12px 16px", color: "#FF3B30", marginBottom: "24px" },
  content: {
    backgroundColor: "var(--bg-primary)",
    borderRadius: "24px",
    border: "1px solid var(--border-color)",
    padding: "32px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.04)",
  },
  profileTab: { display: "flex", flexDirection: "column", gap: "32px" },
  profileSummaryCard: {
    display: "flex",
    alignItems: "center",
    gap: "24px",
    padding: "24px",
    backgroundColor: "var(--bg-secondary)",
    borderRadius: "20px",
    border: "1px solid var(--border-color)",
  },
  avatarLarge: {
    width: "80px",
    height: "80px",
    borderRadius: "24px",
    backgroundColor: "var(--bg-primary)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    border: "1px solid var(--border-color)",
  },
  profileText: { display: "flex", flexDirection: "column", gap: "4px" },
  profileName: { fontSize: "20px", fontWeight: 700, margin: 0 },
  profileEmail: { fontSize: "14px", color: "var(--text-secondary)", margin: 0 },
  profileRole: { fontSize: "12px", fontWeight: 700, color: "#007AFF", margin: 0, opacity: 0.8 },
  actionSection: { display: "flex", flexDirection: "column", gap: "12px" },
  sectionTitle: { fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", margin: 0 },
  sectionHint: { fontSize: "14px", color: "var(--text-secondary)", margin: 0 },
  updateButton: {
    alignSelf: "flex-start",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 20px",
    backgroundColor: "#007AFF",
    color: "#fff",
    border: "none",
    borderRadius: "14px",
    fontSize: "14px",
    fontWeight: 600,
    marginTop: "8px",
  },
  form: { display: "flex", flexDirection: "column", gap: "24px" },
  formGroup: { display: "flex", flexDirection: "column", gap: "8px" },
  label: { fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" },
  input: { padding: "12px 16px", fontSize: "15px", border: "1.5px solid var(--border-color)", borderRadius: "12px", outline: "none", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" },
  hint: { fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" },
  saveButton: { padding: "14px", fontSize: "15px", fontWeight: 700, color: "#FFFFFF", backgroundColor: "#007AFF", border: "none", borderRadius: "14px", marginTop: "8px" },
  themeOptions: { display: "flex", gap: "12px" },
  themeOption: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "14px", backgroundColor: "var(--bg-secondary)", borderWidth: "1.5px", borderStyle: "solid", borderColor: "var(--border-color)", borderRadius: "14px", cursor: "pointer", color: "var(--text-primary)", fontSize: "14px", fontWeight: 600 },
  themeOptionActive: { borderColor: "#007AFF", backgroundColor: "rgba(0,122,255,0.08)", color: "#007AFF" },
  notificationOptions: { display: "flex", flexDirection: "column", gap: "12px" },
  checkboxLabel: { display: "flex", alignItems: "center", gap: "12px", fontSize: "14px", fontWeight: 500, cursor: "pointer" },
  checkbox: { width: "18px", height: "18px", cursor: "pointer", accentColor: "#007AFF" },
  billingInfo: { textAlign: "center", padding: "40px" },
  billingTitle: { fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", marginTop: "16px" },
  billingText: { fontSize: "14px", color: "var(--text-secondary)", marginBottom: "24px" },
  billingButton: { display: "inline-flex", alignItems: "center", gap: "8px", padding: "12px 24px", backgroundColor: "#007AFF", color: "#FFFFFF", border: "none", borderRadius: "12px", cursor: "pointer", fontSize: "14px", fontWeight: 600 },
};