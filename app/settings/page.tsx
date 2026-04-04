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
  Phone
} from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("profile");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  
  // User Profile State
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    role: "",
    avatar: ""
  });
  
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
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const response = await fetch("http://localhost:5000/api/users/me", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setProfile({
          name: data.user?.name || "",
          email: data.user?.email || "",
          phone: data.user?.phone || "",
          company: data.user?.company || "",
          role: data.user?.role || "user",
          avatar: data.user?.avatar || ""
        });
      }
    } catch (err) {
      console.error("Fetch profile error:", err);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const token = localStorage.getItem("token");
    try {
      const response = await fetch("http://localhost:5000/api/users/update", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: profile.name,
          phone: profile.phone,
          company: profile.company
        })
      });

      if (response.ok) {
        setSuccess("Profile updated successfully!");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError("Failed to update profile");
      }
    } catch (err) {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

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

    const token = localStorage.getItem("token");
    try {
      const response = await fetch("http://localhost:5000/api/users/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      });

      if (response.ok) {
        setSuccess("Password changed successfully!");
        setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
        setTimeout(() => setSuccess(""), 3000);
      } else {
        const data = await response.json();
        setError(data.message || "Failed to change password");
      }
    } catch (err) {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "password", label: "Password", icon: Lock },
    { id: "preferences", label: "Preferences", icon: Bell },
    { id: "billing", label: "Billing", icon: CreditCard }
  ];

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Settings</h1>
        <p style={styles.subtitle}>Manage your account preferences</p>
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
          <form onSubmit={handleProfileUpdate} style={styles.form}>
            {/* Avatar Section */}
            <div style={styles.avatarSection}>
              <div style={styles.avatar}>
                {profile.avatar ? (
                  <img src={profile.avatar} alt="Avatar" style={styles.avatarImage} />
                ) : (
                  <span style={styles.avatarText}>{profile.name.charAt(0) || "U"}</span>
                )}
              </div>
              <button type="button" style={styles.avatarButton} className="avatar-btn">
                <Camera size={16} /> Change Avatar
              </button>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Full Name</label>
              <input
                type="text"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                style={styles.input}
                className="input-focus"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Email Address</label>
              <input
                type="email"
                value={profile.email}
                disabled
                style={{ ...styles.input, ...styles.disabledInput }}
              />
              <p style={styles.hint}>Email cannot be changed</p>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Phone Number</label>
              <input
                type="tel"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                style={styles.input}
                className="input-focus"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Company</label>
              <input
                type="text"
                value={profile.company}
                onChange={(e) => setProfile({ ...profile, company: e.target.value })}
                style={styles.input}
                className="input-focus"
              />
            </div>

            <button type="submit" disabled={loading} style={styles.saveButton} className="save-btn">
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </form>
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
            </div>
            <div style={styles.themeOptions}>
              <button
                type="button"
                onClick={() => setPreferences({ ...preferences, theme: "light" })}
                style={{
                  ...styles.themeOption,
                  ...(preferences.theme === "light" ? styles.themeOptionActive : {})
                }}
              >
                <Sun size={20} /> Light
              </button>
              <button
                type="button"
                onClick={() => setPreferences({ ...preferences, theme: "dark" })}
                style={{
                  ...styles.themeOption,
                  ...(preferences.theme === "dark" ? styles.themeOptionActive : {})
                }}
              >
                <Moon size={20} /> Dark
              </button>
            </div>

            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>Notifications</h3>
            </div>
            <div style={styles.notificationOptions}>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={preferences.notifications.email}
                  onChange={(e) => setPreferences({
                    ...preferences,
                    notifications: { ...preferences.notifications, email: e.target.checked }
                  })}
                  style={styles.checkbox}
                />
                Email Notifications
              </label>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={preferences.notifications.push}
                  onChange={(e) => setPreferences({
                    ...preferences,
                    notifications: { ...preferences.notifications, push: e.target.checked }
                  })}
                  style={styles.checkbox}
                />
                Push Notifications
              </label>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={preferences.notifications.taskUpdates}
                  onChange={(e) => setPreferences({
                    ...preferences,
                    notifications: { ...preferences.notifications, taskUpdates: e.target.checked }
                  })}
                  style={styles.checkbox}
                />
                Task Updates
              </label>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={preferences.notifications.invoiceAlerts}
                  onChange={(e) => setPreferences({
                    ...preferences,
                    notifications: { ...preferences.notifications, invoiceAlerts: e.target.checked }
                  })}
                  style={styles.checkbox}
                />
                Invoice Alerts
              </label>
            </div>

            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>Language</h3>
            </div>
            <select
              value={preferences.language}
              onChange={(e) => setPreferences({ ...preferences, language: e.target.value })}
              style={styles.select}
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
            </select>

            <button onClick={() => setSuccess("Preferences saved!")} style={styles.saveButton} className="save-btn">
              Save Preferences
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

      <style>{`
        .tab-hover {
          transition: all 0.25s ease;
        }
        .tab-hover:hover {
          background-color: #F2F2F7;
          transform: translateY(-2px);
        }
        .input-focus:focus {
          border-color: #007AFF !important;
          box-shadow: 0 0 0 4px rgba(0,122,255,0.1) !important;
        }
        .save-btn {
          transition: all 0.25s ease;
        }
        .save-btn:hover {
          background-color: #0055CC !important;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,122,255,0.3);
        }
        .avatar-btn {
          transition: all 0.25s ease;
        }
        .avatar-btn:hover {
          background-color: #0055CC !important;
          transform: scale(1.02);
        }
        .billing-btn {
          transition: all 0.25s ease;
        }
        .billing-btn:hover {
          background-color: #0055CC !important;
          transform: translateY(-2px);
        }
      `}</style>
    </div>
  );
}

const styles: any = {
  container: {
    maxWidth: "800px",
    margin: "0 auto",
    padding: "40px 24px",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  header: {
    marginBottom: "32px",
  },
  title: {
    fontSize: "34px",
    fontWeight: 600,
    color: "#1C1C1E",
    marginBottom: "8px",
    letterSpacing: "-0.5px",
  },
  subtitle: {
    fontSize: "16px",
    color: "#8E8E93",
  },
  tabsContainer: {
    display: "flex",
    gap: "8px",
    borderBottom: "1px solid #E5E5EA",
    marginBottom: "32px",
    overflowX: "auto" as const,
  },
  tab: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 20px",
    fontSize: "15px",
    fontWeight: 500,
    color: "#8E8E93",
    background: "none",
    border: "none",
    cursor: "pointer",
    borderRadius: "12px",
    transition: "all 0.25s ease",
  },
  tabActive: {
    color: "#007AFF",
    backgroundColor: "#E3F2FF",
  },
  successMessage: {
    backgroundColor: "#E8F5E9",
    border: "1px solid #34C759",
    borderRadius: "12px",
    padding: "12px 16px",
    color: "#34C759",
    marginBottom: "24px",
  },
  errorMessage: {
    backgroundColor: "#FFE5E5",
    border: "1px solid #FF3B30",
    borderRadius: "12px",
    padding: "12px 16px",
    color: "#FF3B30",
    marginBottom: "24px",
  },
  content: {
    backgroundColor: "#FFFFFF",
    borderRadius: "20px",
    border: "1px solid #E5E5EA",
    padding: "32px",
  },
  form: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "24px",
  },
  avatarSection: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: "16px",
    marginBottom: "8px",
  },
  avatar: {
    width: "100px",
    height: "100px",
    backgroundColor: "#007AFF",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: "50%",
    objectFit: "cover" as const,
  },
  avatarText: {
    fontSize: "40px",
    fontWeight: 600,
    color: "#FFFFFF",
  },
  avatarButton: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 16px",
    backgroundColor: "#007AFF",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "20px",
    cursor: "pointer",
    fontSize: "14px",
  },
  formGroup: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
  },
  label: {
    fontSize: "14px",
    fontWeight: 500,
    color: "#1C1C1E",
  },
  input: {
    padding: "12px 16px",
    fontSize: "16px",
    border: "1.5px solid #E5E5EA",
    borderRadius: "12px",
    outline: "none",
    transition: "all 0.2s ease",
    fontFamily: "inherit",
  },
  disabledInput: {
    backgroundColor: "#F9F9FB",
    color: "#8E8E93",
  },
  hint: {
    fontSize: "12px",
    color: "#8E8E93",
    marginTop: "4px",
  },
  saveButton: {
    padding: "14px",
    fontSize: "16px",
    fontWeight: 600,
    color: "#FFFFFF",
    backgroundColor: "#007AFF",
    border: "none",
    borderRadius: "12px",
    cursor: "pointer",
    marginTop: "8px",
  },
  sectionHeader: {
    marginBottom: "16px",
  },
  sectionTitle: {
    fontSize: "18px",
    fontWeight: 600,
    color: "#1C1C1E",
  },
  themeOptions: {
    display: "flex",
    gap: "12px",
    marginBottom: "24px",
  },
  themeOption: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "12px",
    backgroundColor: "#F9F9FB",
    border: "1px solid #E5E5EA",
    borderRadius: "12px",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  themeOptionActive: {
    borderColor: "#007AFF",
    backgroundColor: "#E3F2FF",
    color: "#007AFF",
  },
  notificationOptions: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "12px",
    marginBottom: "24px",
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    fontSize: "15px",
    color: "#1C1C1E",
    cursor: "pointer",
  },
  checkbox: {
    width: "18px",
    height: "18px",
    cursor: "pointer",
  },
  select: {
    padding: "12px 16px",
    fontSize: "16px",
    border: "1.5px solid #E5E5EA",
    borderRadius: "12px",
    backgroundColor: "#FFFFFF",
    marginBottom: "24px",
  },
  billingInfo: {
    textAlign: "center" as const,
    padding: "40px",
  },
  billingTitle: {
    fontSize: "20px",
    fontWeight: 600,
    color: "#1C1C1E",
    marginTop: "16px",
    marginBottom: "8px",
  },
  billingText: {
    fontSize: "14px",
    color: "#8E8E93",
    marginBottom: "24px",
  },
  billingButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 24px",
    backgroundColor: "#007AFF",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "12px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: 500,
  },
};