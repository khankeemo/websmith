"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Mail, Phone, Code, Calendar, Shield, Key, Briefcase } from "lucide-react";
import API from "../../../core/services/apiService";
import Card from "../../../components/ui/Card";

export default function DeveloperProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    headline: "",
    bio: "",
    skills: [] as string[],
    experienceYears: 0,
    timezone: "UTC",
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [skillInput, setSkillInput] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    fetchProfile();
  }, [router]);

  const fetchProfile = async () => {
    try {
      const response = await API.get("/users/me");
      setProfile(response.data.user);
      setFormData({
        name: response.data.user.name || "",
        email: response.data.user.email || "",
        phone: response.data.user.phone || "",
        headline: response.data.user.headline || "",
        bio: response.data.user.bio || "",
        skills: response.data.user.skills || [],
        experienceYears: response.data.user.experienceYears || 0,
        timezone: response.data.user.timezone || "UTC",
      });
      setLoading(false);
    } catch (error) {
      console.error("Error:", error);
      router.push("/login");
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      await API.put("/users/me", formData);
      setSuccessMessage("Profile updated successfully");
      setEditing(false);
      fetchProfile();
    } catch (error: any) {
      setError(error.response?.data?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccessMessage("");

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError("New passwords do not match");
      setSaving(false);
      return;
    }

    try {
      await API.post("/auth/change-password", {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      setSuccessMessage("Password changed successfully");
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (error: any) {
      setError(error.response?.data?.message || "Failed to change password");
    } finally {
      setSaving(false);
    }
  };

  const addSkill = () => {
    if (skillInput.trim() && !formData.skills.includes(skillInput.trim())) {
      setFormData({ ...formData, skills: [...formData.skills, skillInput.trim()] });
      setSkillInput("");
    }
  };

  const removeSkill = (skill: string) => {
    setFormData({ ...formData, skills: formData.skills.filter((s) => s !== skill) });
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p>Loading profile...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>My Profile</h1>
          <p style={styles.subtitle}>Manage your developer profile and settings</p>
        </div>
      </div>

      {successMessage && (
        <div style={styles.successContainer}>
          <p style={styles.successText}>{successMessage}</p>
        </div>
      )}

      {error && (
        <div style={styles.errorContainer}>
          <p style={styles.errorText}>{error}</p>
        </div>
      )}

      {/* Profile Info */}
      <div style={styles.grid}>
        {/* Personal Information */}
        <Card>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>Personal Information</h3>
            <button onClick={() => setEditing(!editing)} style={styles.editBtn}>
              {editing ? "Cancel" : "Edit"}
            </button>
          </div>
          <form onSubmit={handleUpdateProfile}>
            <div style={styles.formGrid}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Full Name</label>
                <div style={styles.inputWrapper}>
                  <User size={18} color="#8E8E93" />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={!editing}
                    style={{ ...styles.input, ...(!editing ? styles.disabled : {}) }}
                  />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Email</label>
                <div style={styles.inputWrapper}>
                  <Mail size={18} color="#8E8E93" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    disabled={!editing}
                    style={{ ...styles.input, ...(!editing ? styles.disabled : {}) }}
                  />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Phone</label>
                <div style={styles.inputWrapper}>
                  <Phone size={18} color="#8E8E93" />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    disabled={!editing}
                    style={{ ...styles.input, ...(!editing ? styles.disabled : {}) }}
                  />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Experience (Years)</label>
                <div style={styles.inputWrapper}>
                  <Briefcase size={18} color="#8E8E93" />
                  <input
                    type="number"
                    value={formData.experienceYears}
                    onChange={(e) => setFormData({ ...formData, experienceYears: parseInt(e.target.value) || 0 })}
                    disabled={!editing}
                    style={{ ...styles.input, ...(!editing ? styles.disabled : {}) }}
                  />
                </div>
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Headline</label>
              <div style={styles.inputWrapper}>
                <Code size={18} color="#8E8E93" />
                <input
                  type="text"
                  value={formData.headline}
                  onChange={(e) => setFormData({ ...formData, headline: e.target.value })}
                  disabled={!editing}
                  placeholder="e.g., Senior Full-Stack Developer"
                  style={{ ...styles.input, ...(!editing ? styles.disabled : {}) }}
                />
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Bio</label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                disabled={!editing}
                rows={3}
                style={{ ...styles.textarea, ...(!editing ? styles.disabled : {}) }}
                placeholder="Tell us about yourself..."
              />
            </div>

            {editing && (
              <>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Skills</label>
                  <div style={styles.skillInputWrap}>
                    <input
                      type="text"
                      value={skillInput}
                      onChange={(e) => setSkillInput(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
                      placeholder="Add skill and press Enter"
                      style={styles.input}
                    />
                    <button type="button" onClick={addSkill} style={styles.addSkillBtn}>
                      Add
                    </button>
                  </div>
                  {formData.skills.length > 0 && (
                    <div style={styles.skillsList}>
                      {formData.skills.map((skill, index) => (
                        <span key={index} style={styles.skillTag}>
                          {skill}
                          <button type="button" onClick={() => removeSkill(skill)} style={styles.removeSkillBtn}>
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <button type="submit" style={styles.saveBtn} disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </>
            )}
          </form>
        </Card>

        {/* Account Details */}
        <Card>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>Account Details</h3>
          </div>
          <div style={styles.detailsList}>
            <div style={styles.detailItem}>
              <Shield size={20} color="#007AFF" />
              <div>
                <p style={styles.detailLabel}>Role</p>
                <p style={styles.detailValue}>{profile?.role?.toUpperCase()}</p>
              </div>
            </div>
            {profile?.customId && (
              <div style={styles.detailItem}>
                <Code size={20} color="#007AFF" />
                <div>
                  <p style={styles.detailLabel}>Developer ID</p>
                  <p style={styles.detailValue}>{profile.customId}</p>
                </div>
              </div>
            )}
            <div style={styles.detailItem}>
              <Calendar size={20} color="#007AFF" />
              <div>
                <p style={styles.detailLabel}>Joined</p>
                <p style={styles.detailValue}>
                  {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "N/A"}
                </p>
              </div>
            </div>
            <div style={styles.detailItem}>
              <Calendar size={20} color="#007AFF" />
              <div>
                <p style={styles.detailLabel}>Timezone</p>
                <p style={styles.detailValue}>{profile?.timezone || "UTC"}</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Change Password */}
      <Card>
        <div style={styles.cardHeader}>
          <h3 style={styles.cardTitle}>Change Password</h3>
        </div>
        <form onSubmit={handleChangePassword} style={styles.passwordForm}>
          <div style={styles.formGrid}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Current Password</label>
              <div style={styles.inputWrapper}>
                <Key size={18} color="#8E8E93" />
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  required
                  style={styles.input}
                />
              </div>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>New Password</label>
              <div style={styles.inputWrapper}>
                <Key size={18} color="#8E8E93" />
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  required
                  style={styles.input}
                />
              </div>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Confirm New Password</label>
              <div style={styles.inputWrapper}>
                <Key size={18} color="#8E8E93" />
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  required
                  style={styles.input}
                />
              </div>
            </div>
          </div>
          <button type="submit" style={styles.saveBtn} disabled={saving}>
            {saving ? "Saving..." : "Change Password"}
          </button>
        </form>
      </Card>
    </div>
  );
}

const styles: Record<string, any> = {
  container: { padding: "24px" },
  header: { marginBottom: "24px" },
  title: { margin: 0, fontSize: "34px", fontWeight: 700, color: "#1C1C1E" },
  subtitle: { margin: "8px 0 0", color: "#8E8E93" },
  successContainer: { marginBottom: "20px", padding: "14px 16px", backgroundColor: "#E8F5E9", border: "1px solid #34C759", borderRadius: "12px" },
  successText: { color: "#1C1C1E", margin: 0, fontSize: "14px", fontWeight: 500 },
  errorContainer: { marginBottom: "20px", padding: "14px 16px", backgroundColor: "#FFE5E5", border: "1px solid #FF3B30", borderRadius: "12px" },
  errorText: { color: "#FF3B30", margin: 0, fontSize: "14px", fontWeight: 500 },
  grid: { display: "grid", gap: "20px", marginBottom: "20px" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" },
  cardTitle: { margin: 0, fontSize: "18px", fontWeight: 600, color: "#1C1C1E" },
  editBtn: { padding: "8px 16px", background: "#007AFF", color: "#fff", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" },
  formGroup: { marginBottom: "16px" },
  label: { display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: 500, color: "#3A3A3C" },
  inputWrapper: { display: "flex", alignItems: "center", gap: "12px", padding: "12px", border: "1px solid #E5E5EA", borderRadius: "10px", backgroundColor: "#fff" },
  input: { border: "none", outline: "none", width: "100%", fontSize: "15px", backgroundColor: "transparent" },
  disabled: { backgroundColor: "#F2F2F7", color: "#8E8E93" },
  textarea: { width: "100%", padding: "12px", border: "1px solid #E5E5EA", borderRadius: "10px", fontSize: "15px", fontFamily: "inherit", resize: "vertical" },
  saveBtn: { width: "100%", padding: "14px", background: "#007AFF", color: "#fff", border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: 600, cursor: "pointer", marginTop: "8px" },
  detailsList: { display: "flex", flexDirection: "column", gap: "20px" },
  detailItem: { display: "flex", alignItems: "center", gap: "16px" },
  detailLabel: { margin: 0, fontSize: "13px", color: "#8E8E93" },
  detailValue: { margin: "4px 0 0", fontSize: "15px", fontWeight: 500, color: "#1C1C1E" },
  skillInputWrap: { display: "flex", gap: "8px" },
  addSkillBtn: { padding: "12px 20px", background: "#007AFF", color: "#fff", border: "none", borderRadius: "10px", cursor: "pointer" },
  skillsList: { display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "12px" },
  skillTag: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", background: "#F2F2F7", borderRadius: "12px", fontSize: "13px" },
  removeSkillBtn: { background: "none", border: "none", cursor: "pointer", fontSize: "16px", color: "#8E8E93" },
  passwordForm: { maxWidth: "100%" },
  loadingContainer: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px", gap: "16px" },
  spinner: { width: "40px", height: "40px", border: "3px solid #E5E5EA", borderTopColor: "#007AFF", borderRadius: "50%", animation: "spin 0.8s linear infinite" },
};
