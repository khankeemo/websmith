"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Building,
  Camera,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Phone,
  Save,
  ShieldCheck,
  User,
} from "lucide-react";
import { AuthUser, getStoredUser, getToken, setAuthSession } from "../../lib/auth";
import API from "../../core/services/apiService";
import {
  getPasswordChecklistItems,
  getPasswordValidationMessage,
  validatePhone,
  validateStrongPassword,
} from "../../core/utils/validation";

type ProfileUser = AuthUser & {
  _id?: string;
  createdAt?: string;
  updatedAt?: string;
  customId?: string;
  adminLevel?: "super" | "sub" | null;
  headline?: string;
  bio?: string;
  skills?: string[];
  status?: string;
  experienceYears?: number;
  published?: boolean;
};

const emptyPasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export default function ProfilePageContent() {
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    avatar: "",
  });
  const [isEditMode, setIsEditMode] = useState(false);
  const isEditModeRef = useRef(isEditMode);
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activePanel = useMemo(() => {
    const role = user?.role?.toLowerCase() || "";
    if (role.includes("admin")) return "Admin";
    if (role.includes("client")) return "Client";
    if (role.includes("developer") || role.includes("dev")) return "Developer";
    return "User";
  }, [user?.role]);

  const passwordChecklist = useMemo(
    () => getPasswordChecklistItems(passwordForm.newPassword),
    [passwordForm.newPassword]
  );

  const panelDetails = useMemo(() => {
    if (!user) return [];

    if (activePanel === "Admin") {
      return [{ label: "Admin Level", value: user.adminLevel ? `${user.adminLevel} admin` : "Admin" }];
    }

    if (activePanel === "Developer") {
      return [
        { label: "Status", value: user.status || "active" },
        { label: "Experience", value: `${user.experienceYears || 0} years` },
        { label: "Published", value: user.published ? "Yes" : "No" },
      ];
    }

    return [{ label: "Client Status", value: user.createdAt ? "Active client" : "Active" }];
  }, [activePanel, user]);

  const syncLocalUser = (nextUser: ProfileUser) => {
    const token = getToken();
    if (token) {
      setAuthSession(token, nextUser);
    } else if (typeof window !== "undefined") {
      localStorage.setItem("user", JSON.stringify(nextUser));
    }
    setUser(nextUser);
    window.dispatchEvent(new Event("userProfileUpdated"));
  };

  const hydrateForm = (nextUser: ProfileUser) => {
    setProfileForm({
      name: nextUser.name || "",
      email: nextUser.email || "",
      phone: nextUser.phone || "",
      company: nextUser.company || "",
      avatar: nextUser.avatar || "",
    });
  };

  const setEditMode = (nextValue: boolean) => {
    isEditModeRef.current = nextValue;
    setIsEditMode(nextValue);
  };

  const handleEnterEditMode = (event?: React.MouseEvent<HTMLButtonElement>) => {
    event?.preventDefault();
    event?.stopPropagation();
    clearFeedback();
    setEditMode(true);
  };

  const fetchUserProfile = async () => {
    try {
      const response = await API.get("/users/profile");
      const liveUser = (response.data.user || response.data.data) as ProfileUser | undefined;
      if (!liveUser) {
        throw new Error("Profile data missing");
      }
      syncLocalUser(liveUser);
      if (!isEditModeRef.current) {
        hydrateForm(liveUser);
      }
      setError("");
    } catch (err) {
      console.error("Failed to fetch profile:", err);
      setError("Failed to load profile data");
      const storedUser = getStoredUser() as ProfileUser | null;
      if (storedUser) {
        setUser(storedUser);
        if (!isEditModeRef.current) {
          hydrateForm(storedUser);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    isEditModeRef.current = isEditMode;
  }, [isEditMode]);

  useEffect(() => {
    const storedUser = getStoredUser() as ProfileUser | null;
    if (storedUser) {
      setUser(storedUser);
      hydrateForm(storedUser);
    }
    fetchUserProfile();
  }, []);

  const clearFeedback = () => {
    setMessage("");
    setError("");
  };

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      setError("Image size should be less than 1MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setProfileForm((prev) => ({ ...prev, avatar: base64 }));
      clearFeedback();
    };
    reader.readAsDataURL(file);
  };

  const handleProfileUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    clearFeedback();

    if (profileForm.phone && !validatePhone(profileForm.phone)) {
      setError("Please enter a valid phone number");
      return;
    }

    setProfileSaving(true);
    try {
      const response = await API.put("/users/update", {
        name: profileForm.name.trim(),
        phone: profileForm.phone.trim(),
        company: profileForm.company.trim(),
        avatar: profileForm.avatar,
      });
      const updatedUser = (response.data.user || response.data.data) as ProfileUser | undefined;
      if (!updatedUser) {
        throw new Error("Updated profile missing");
      }
      syncLocalUser(updatedUser);
      hydrateForm(updatedUser);
      setMessage("Profile updated successfully");
      setEditMode(false);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to update profile");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleCancelEdit = () => {
    clearFeedback();
    if (user) hydrateForm(user);
    setEditMode(false);
  };

  const handleShowPasswordForm = (event?: React.MouseEvent<HTMLButtonElement>) => {
    event?.preventDefault();
    event?.stopPropagation();
    clearFeedback();
    setShowPasswordForm(true);
  };

  const handleClosePasswordForm = () => {
    setShowPasswordForm(false);
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setPasswordForm(emptyPasswordForm);
  };

  const handlePasswordChange = async (event: React.FormEvent) => {
    event.preventDefault();
    clearFeedback();

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setError("Please complete all password fields");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("New passwords do not match");
      return;
    }
    if (passwordForm.currentPassword === passwordForm.newPassword) {
      setError("New password must be different from your current password");
      return;
    }
    if (!validateStrongPassword(passwordForm.newPassword)) {
      setError(getPasswordValidationMessage());
      return;
    }

    setPasswordSaving(true);
    try {
      await API.post("/users/change-password", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm(emptyPasswordForm);
      setMessage("Password changed successfully");
      handleClosePasswordForm();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to change password");
    } finally {
      setPasswordSaving(false);
    }
  };

  if (loading && !user) {
    return (
      <div style={styles.loadingState}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading your profile...</p>
      </div>
    );
  }

  if (!user) return null;

  const initials = (profileForm.name || user.name || "U").charAt(0).toUpperCase();
  const avatarSrc = profileForm.avatar || user.avatar || "";
  const joinedLabel = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Not available";
  const accountId = user.customId || user.id || user._id || "Not available";
  const isDeveloperPanel = activePanel === "Developer";

  return (
    <div style={styles.page} className="wsd-page">
      <div style={styles.heroCard}>
        <div style={styles.heroGradient} />
        <div style={styles.heroContent}>
          <div style={styles.heroAvatarWrap}>
            {avatarSrc ? (
              <img src={avatarSrc} alt={user.name} style={styles.heroAvatar} />
            ) : (
              <div style={styles.heroAvatarFallback}>{initials}</div>
            )}
            <button
              type="button"
              style={{
                ...styles.avatarAction,
                opacity: isEditMode ? 1 : 0.4,
                cursor: isEditMode ? "pointer" : "not-allowed",
              }}
              onClick={() => fileInputRef.current?.click()}
              disabled={!isEditMode}
            >
              <Camera size={16} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              style={{ display: "none" }}
            />
          </div>

          <div style={styles.heroText}>
            <h1 style={styles.title}>{user.name}</h1>
            <p style={styles.subtitle}>{user.email}</p>
            <div style={styles.heroMetaRow}>
              <span style={styles.roleBadge}>{user.role.toUpperCase()}</span>
              <span style={styles.metaPill}>Member since {joinedLabel}</span>
              <span style={styles.metaPill}>Account ID {accountId}</span>
            </div>
          </div>
        </div>
      </div>

      {message ? <div style={styles.successBanner}>{message}</div> : null}
      {error ? <div style={styles.errorBanner}>{error}</div> : null}

      <div style={styles.grid}>
        <section style={styles.primaryColumn}>
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div style={styles.cardHeaderTitle}>
                <User size={18} />
                <h2 style={styles.cardTitle}>Profile Information</h2>
              </div>
              <p style={styles.cardDescription}>
                Manage your {activePanel.toLowerCase()} profile details. Fields stay read-only until you choose Edit.
              </p>
            </div>

            <form onSubmit={handleProfileUpdate} style={styles.form}>
              <div style={styles.summaryList}>
                {panelDetails.map((detail) => (
                  <div key={detail.label} style={styles.summaryRow}>
                    <span style={styles.summaryLabel}>{detail.label}</span>
                    <span style={styles.summaryValue}>{detail.value}</span>
                  </div>
                ))}
              </div>

              <div style={styles.formGrid}>
                <label style={styles.field}>
                  <span style={styles.label}>Full Name</span>
                  <div style={styles.inputWrap}>
                    <User size={16} color="var(--text-secondary)" />
                    <input
                      type="text"
                      value={profileForm.name}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, name: event.target.value }))}
                      style={styles.input}
                      readOnly={!isEditMode}
                      required
                      aria-readonly={!isEditMode}
                    />
                  </div>
                </label>

                <label style={styles.field}>
                  <span style={styles.label}>Email Address</span>
                  <div style={{ ...styles.inputWrap, ...styles.readOnlyWrap }}>
                    <Mail size={16} color="var(--text-secondary)" />
                    <input type="email" value={profileForm.email} style={styles.input} readOnly />
                  </div>
                  <span style={styles.helperText}>Email is read-only for account security.</span>
                </label>

                <label style={styles.field}>
                  <span style={styles.label}>Phone Number</span>
                  <div style={styles.inputWrap}>
                    <Phone size={16} color="var(--text-secondary)" />
                    <input
                      type="tel"
                      value={profileForm.phone}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, phone: event.target.value }))}
                      style={styles.input}
                      placeholder="+1 (555) 000-0000"
                      readOnly={!isEditMode}
                      aria-readonly={!isEditMode}
                    />
                  </div>
                </label>

                <label style={styles.field}>
                  <span style={styles.label}>Company</span>
                  <div style={styles.inputWrap}>
                    <Building size={16} color="var(--text-secondary)" />
                    <input
                      type="text"
                      value={profileForm.company}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, company: event.target.value }))}
                      style={styles.input}
                      placeholder="Your company"
                      readOnly={!isEditMode}
                      aria-readonly={!isEditMode}
                    />
                  </div>
                </label>
              </div>

              {isDeveloperPanel && (
                <div style={styles.developerPanelNote}>
                  <strong>Developer profile:</strong> Public portfolio fields such as skills, headline, and availability are managed by the admin team section. Personal contact details can be edited here.
                </div>
              )}

              <div style={styles.actionRow}>
                {!isEditMode ? (
                  <>
                    <button type="button" style={styles.primaryButton} onClick={handleEnterEditMode}>
                      <User size={16} />
                      Edit
                    </button>
                    <button
                      type="button"
                      style={styles.secondaryButton}
                      onClick={handleShowPasswordForm}
                    >
                      <Lock size={16} />
                      Change Password
                    </button>
                  </>
                ) : (
                  <>
                    <button type="submit" style={styles.primaryButton} disabled={profileSaving}>
                      <Save size={16} />
                      {profileSaving ? "Saving..." : "Save Changes"}
                    </button>
                    <button
                      type="button"
                      style={styles.secondaryButton}
                      onClick={handleCancelEdit}
                      disabled={profileSaving}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      style={styles.secondaryButton}
                      onClick={handleShowPasswordForm}
                    >
                      <Lock size={16} />
                      Change Password
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>

          {showPasswordForm && (
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <div style={styles.cardHeaderTitle}>
                  <Lock size={18} />
                  <h2 style={styles.cardTitle}>Change Password</h2>
                </div>
                <p style={styles.cardDescription}>Use a strong password and confirm it before saving.</p>
              </div>

              <form onSubmit={handlePasswordChange} style={styles.form}>
                <label style={styles.field}>
                  <span style={styles.label}>Current Password</span>
                  <div style={styles.passwordWrap}>
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      value={passwordForm.currentPassword}
                      onChange={(event) =>
                        setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))
                      }
                      style={styles.passwordInput}
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword((value) => !value)}
                      style={styles.eyeButton}
                      aria-label="Toggle current password visibility"
                    >
                      {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>

                <label style={styles.field}>
                  <span style={styles.label}>New Password</span>
                  <div style={styles.passwordWrap}>
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={passwordForm.newPassword}
                      onChange={(event) => setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))}
                      style={styles.passwordInput}
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((value) => !value)}
                      style={styles.eyeButton}
                      aria-label="Toggle new password visibility"
                    >
                      {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>

                <label style={styles.field}>
                  <span style={styles.label}>Confirm New Password</span>
                  <div style={styles.passwordWrap}>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={passwordForm.confirmPassword}
                      onChange={(event) =>
                        setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
                      }
                      style={styles.passwordInput}
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((value) => !value)}
                      style={styles.eyeButton}
                      aria-label="Toggle confirm password visibility"
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <p style={styles.helperText}>{getPasswordValidationMessage()}</p>
                </label>

                <div style={styles.checklist}>
                  {passwordChecklist.map((item) => (
                    <div key={item.key} style={styles.checklistRow}>
                      <span
                        style={{
                          ...styles.checklistDot,
                          backgroundColor: item.met ? "#22C55E" : "rgba(148, 163, 184, 0.5)",
                        }}
                      />
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>

                <div style={styles.actionRow}>
                  <button type="submit" style={styles.secondaryButton} disabled={passwordSaving}>
                    <ShieldCheck size={16} />
                    {passwordSaving ? "Updating..." : "Update Password"}
                  </button>
                  <button
                    type="button"
                    style={styles.secondaryButton}
                    onClick={handleClosePasswordForm}
                    disabled={passwordSaving}
                  >
                    Close
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const styles: Record<string, any> = {
  page: {
    padding: 0,
    width: "100%",
    maxWidth: "100%",
    margin: 0,
    color: "var(--text-primary)",
  },
  heroCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: "28px",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-primary)",
    boxShadow: "0 18px 48px rgba(15, 23, 42, 0.06)",
    marginBottom: "24px",
  },
  heroGradient: {
    height: "140px",
    background: "linear-gradient(135deg, #007AFF 0%, #22C55E 100%)",
  },
  heroContent: {
    display: "flex",
    gap: "24px",
    alignItems: "flex-end",
    padding: "0 28px 28px",
    marginTop: "-52px",
    flexWrap: "wrap",
  },
  heroAvatarWrap: {
    position: "relative",
    width: "120px",
    height: "120px",
  },
  heroAvatar: {
    width: "100%",
    height: "100%",
    borderRadius: "28px",
    objectFit: "cover",
    border: "5px solid var(--bg-primary)",
    backgroundColor: "var(--bg-secondary)",
  },
  heroAvatarFallback: {
    width: "100%",
    height: "100%",
    borderRadius: "28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "40px",
    fontWeight: 700,
    color: "#FFFFFF",
    border: "5px solid var(--bg-primary)",
    background: "linear-gradient(135deg, #2563EB 0%, #14B8A6 100%)",
  },
  avatarAction: {
    position: "absolute",
    right: "-4px",
    bottom: "-4px",
    width: "36px",
    height: "36px",
    borderRadius: "999px",
    border: "2px solid var(--bg-primary)",
    backgroundColor: "#0F172A",
    color: "#FFFFFF",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  heroText: {
    flex: 1,
    minWidth: "260px",
  },
  title: {
    margin: 0,
    fontSize: "32px",
    fontWeight: 700,
    letterSpacing: "-0.04em",
  },
  subtitle: {
    margin: "8px 0 14px",
    color: "var(--text-secondary)",
    fontSize: "15px",
  },
  heroMetaRow: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },
  roleBadge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: "999px",
    padding: "7px 12px",
    backgroundColor: "rgba(0, 122, 255, 0.12)",
    color: "#007AFF",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.06em",
  },
  metaPill: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: "999px",
    padding: "7px 12px",
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-secondary)",
    fontSize: "12px",
    fontWeight: 600,
  },
  successBanner: {
    marginBottom: "16px",
    padding: "14px 16px",
    borderRadius: "16px",
    border: "1px solid rgba(34, 197, 94, 0.35)",
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    color: "#15803D",
    fontSize: "14px",
    fontWeight: 600,
  },
  errorBanner: {
    marginBottom: "16px",
    padding: "14px 16px",
    borderRadius: "16px",
    border: "1px solid rgba(239, 68, 68, 0.35)",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    color: "#DC2626",
    fontSize: "14px",
    fontWeight: 600,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: "24px",
    alignItems: "start",
    width: "100%",
  },
  primaryColumn: {
    display: "grid",
    gap: "24px",
    width: "100%",
  },
  secondaryColumn: {
    display: "grid",
    gap: "24px",
  },
  card: {
    backgroundColor: "var(--bg-primary)",
    borderRadius: "24px",
    border: "1px solid var(--border-color)",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
    padding: "clamp(20px, 3vw, 32px)",
    width: "100%",
  },
  cardHeader: {
    marginBottom: "20px",
  },
  cardHeaderTitle: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "8px",
    color: "#007AFF",
  },
  cardTitle: {
    margin: 0,
    color: "var(--text-primary)",
    fontSize: "18px",
    fontWeight: 700,
  },
  cardDescription: {
    margin: 0,
    color: "var(--text-secondary)",
    fontSize: "14px",
    lineHeight: 1.5,
  },
  form: {
    display: "grid",
    gap: "18px",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "18px",
    width: "100%",
  },
  field: {
    display: "grid",
    gap: "8px",
  },
  label: {
    fontSize: "13px",
    fontWeight: 700,
    color: "var(--text-primary)",
  },
  inputWrap: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minHeight: "50px",
    padding: "0 14px",
    borderRadius: "14px",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-secondary)",
  },
  readOnlyWrap: {
    opacity: 0.8,
  },
  input: {
    flex: 1,
    border: "none",
    outline: "none",
    backgroundColor: "transparent",
    color: "var(--text-primary)",
    fontSize: "14px",
    minWidth: 0,
  },
  passwordWrap: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    minHeight: "50px",
    borderRadius: "14px",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-secondary)",
    paddingLeft: "14px",
  },
  passwordInput: {
    flex: 1,
    border: "none",
    outline: "none",
    backgroundColor: "transparent",
    color: "var(--text-primary)",
    fontSize: "14px",
    paddingRight: "44px",
  },
  eyeButton: {
    position: "absolute",
    right: "12px",
    border: "none",
    background: "transparent",
    color: "var(--text-secondary)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  helperText: {
    margin: "2px 0 0",
    color: "var(--text-secondary)",
    fontSize: "12px",
    lineHeight: 1.5,
  },
  checklist: {
    display: "grid",
    gap: "10px",
    padding: "16px",
    borderRadius: "16px",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-secondary)",
  },
  checklistRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontSize: "13px",
    color: "var(--text-primary)",
  },
  checklistDot: {
    width: "10px",
    height: "10px",
    borderRadius: "999px",
    flexShrink: 0,
  },
  actionRow: {
    display: "flex",
    justifyContent: "flex-start",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "12px",
    width: "100%",
  },
  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    minWidth: "160px",
    minHeight: "46px",
    padding: "0 18px",
    borderRadius: "14px",
    border: "none",
    backgroundColor: "#007AFF",
    color: "#FFFFFF",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    minWidth: "180px",
    minHeight: "46px",
    padding: "0 18px",
    borderRadius: "14px",
    border: "none",
    backgroundColor: "#0F766E",
    color: "#FFFFFF",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  preferenceList: {
    display: "grid",
    gap: "14px",
  },
  preferenceRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    padding: "14px 0",
    borderBottom: "1px solid var(--border-color)",
  },
  preferenceTitle: {
    margin: 0,
    fontSize: "14px",
    fontWeight: 700,
    color: "var(--text-primary)",
  },
  preferenceDescription: {
    margin: "4px 0 0",
    fontSize: "12px",
    color: "var(--text-secondary)",
    lineHeight: 1.5,
  },
  switch: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    cursor: "pointer",
  },
  switchTrack: {
    width: "46px",
    height: "24px",
    borderRadius: "999px",
    padding: "2px",
    transition: "all 0.2s ease",
    display: "flex",
    alignItems: "center",
  },
  switchThumb: {
    width: "20px",
    height: "20px",
    borderRadius: "999px",
    backgroundColor: "#FFFFFF",
    boxShadow: "0 2px 6px rgba(15, 23, 42, 0.25)",
    transition: "transform 0.2s ease",
  },
  summaryList: {
    display: "grid",
    gap: "14px",
  },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    paddingBottom: "14px",
    borderBottom: "1px solid var(--border-color)",
  },
  summaryLabel: {
    fontSize: "13px",
    color: "var(--text-secondary)",
    fontWeight: 600,
  },
  summaryValue: {
    fontSize: "13px",
    color: "var(--text-primary)",
    fontWeight: 700,
    textAlign: "right",
  },
  developerPanelNote: {
    padding: "14px 16px",
    borderRadius: "16px",
    border: "1px solid rgba(0, 122, 255, 0.22)",
    backgroundColor: "rgba(0, 122, 255, 0.08)",
    color: "var(--text-primary)",
    fontSize: "13px",
    lineHeight: 1.5,
  },
  loadingState: {
    minHeight: "50vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "16px",
  },
  spinner: {
    width: "34px",
    height: "34px",
    borderRadius: "999px",
    border: "3px solid var(--border-color)",
    borderTopColor: "#007AFF",
    animation: "spin 0.8s linear infinite",
  },
  loadingText: {
    margin: 0,
    color: "var(--text-secondary)",
    fontSize: "14px",
  },
};
