// FILE: app/internal/api/auth/profile/page.tsx
// PURPOSE: API Center Profile Page - User profile management
// FEATURES: View/Edit profile, change password, theme preference, avatar upload

"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Mail,
  Lock,
  Camera,
  Save,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Shield,
  Sparkles,
  Moon,
  Sun,
  Monitor,
} from "lucide-react";

export default function ProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Profile state
  const [profile, setProfile] = useState({
    id: "",
    name: "",
    email: "",
    avatar: "",
    role: "admin",
  });

  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    avatar: "",
  });

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordData, setPasswordData] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Theme
  const [theme, setTheme] = useState<"dark" | "light" | "system">("dark");

  // Load profile
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("api_center_token");
      if (!token) {
        router.push("/internal/api/auth/login");
        return;
      }

      const response = await fetch("/internal/backend/api/auth/verify", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (data.valid) {
        setProfile({
          id: data.user.id,
          name: data.user.name || "Admin User",
          email: data.user.email || "admin@websmith.com",
          avatar: data.user.avatar || "",
          role: data.user.role || "admin",
        });
        setFormData({
          name: data.user.name || "Admin User",
          email: data.user.email || "admin@websmith.com",
          avatar: data.user.avatar || "",
        });
        setTheme("dark");
      } else {
        router.push("/internal/api/auth/login");
      }
    } catch (err) {
      setError("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const token = localStorage.getItem("api_center_token");
      const response = await fetch("/internal/backend/users/update", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: profile.id,
          name: formData.name,
          email: formData.email,
          avatar: formData.avatar,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSuccess("Profile updated successfully");
        setProfile({ ...profile, name: formData.name, email: formData.email, avatar: formData.avatar });
        setEditMode(false);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || "Failed to update profile");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.new_password.length < 4) {
      setError("Password must be at least 4 characters");
      return;
    }
    if (passwordData.new_password !== passwordData.confirm_password) {
      setError("Passwords do not match");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const token = localStorage.getItem("api_center_token");
      const response = await fetch("/internal/backend/users/update", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: profile.id,
          password: passwordData.new_password,
          current_password: passwordData.current_password,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSuccess("Password changed successfully");
        setShowPasswordForm(false);
        setPasswordData({
          current_password: "",
          new_password: "",
          confirm_password: "",
        });
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || "Failed to change password");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleThemeChange = async (newTheme: "dark" | "light" | "system") => {
    setTheme(newTheme);
    try {
      const token = localStorage.getItem("api_center_token");
      await fetch("/internal/backend/users/update", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: profile.id,
          preferences: { theme: newTheme },
        }),
      });
    } catch (err) {
      console.error("Failed to save theme preference:", err);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setFormData({ ...formData, avatar: base64 });
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        <span className="ml-3 text-slate-400">Loading profile...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/internal/api/analytics")}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Dashboard
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
            {profile.role}
          </span>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-start gap-2">
          <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
          <p className="text-green-400 text-sm">{success}</p>
        </div>
      )}

      {/* Main Card */}
      <div className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-2xl shadow-black/40">
        <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-blue-500/20 blur-sm -z-10" />

        {/* Profile Header */}
        <div className="px-6 py-6 border-b border-white/10">
          <div className="flex items-center gap-6">
            {/* Avatar */}
            <div className="relative">
              <div
                className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-blue-500/50 transition-all overflow-hidden"
                onClick={handleAvatarClick}
              >
                {formData.avatar ? (
                  <img
                    src={formData.avatar}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-2xl font-bold text-white">
                    {profile.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="w-5 h-5 text-white" />
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>

            <div className="flex-1">
              <h1 className="text-xl font-bold text-white">
                {profile.name}
              </h1>
              <p className="text-sm text-slate-400">{profile.email}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {profile.role}
                </span>
                <span className="text-xs text-slate-500">
                  ID: {profile.id}
                </span>
              </div>
            </div>

            <button
              onClick={() => setEditMode(!editMode)}
              className="px-3 py-1.5 text-sm rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 transition-all"
            >
              {editMode ? "Cancel" : "Edit Profile"}
            </button>
          </div>
        </div>

        {/* Profile Content */}
        <div className="p-6 space-y-6">
          {/* Profile Information */}
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-blue-400" />
              Profile Information
            </h3>

            {editMode ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                  <span className="text-xs text-slate-400">Full Name</span>
                  <span className="text-sm text-white">{profile.name}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                  <span className="text-xs text-slate-400">Email Address</span>
                  <span className="text-sm text-white">{profile.email}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                  <span className="text-xs text-slate-400">Role</span>
                  <span className="text-sm text-blue-400">{profile.role}</span>
                </div>
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-xs text-slate-400">User ID</span>
                  <span className="text-xs text-slate-300 font-mono">{profile.id}</span>
                </div>
              </div>
            )}
          </div>

          {/* Password Change */}
          <div className="border-t border-white/10 pt-4">
            <button
              onClick={() => setShowPasswordForm(!showPasswordForm)}
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              <Lock className="w-4 h-4" />
              <span>Change Password</span>
              <span className="text-xs text-slate-500">
                {showPasswordForm ? "(hide)" : "(click to change)"}
              </span>
            </button>

            {showPasswordForm && (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      value={passwordData.current_password}
                      onChange={(e) =>
                        setPasswordData({ ...passwordData, current_password: e.target.value })
                      }
                      className="w-full px-3 py-1.5 text-sm bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 pr-8"
                      placeholder="Enter current password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={passwordData.new_password}
                      onChange={(e) =>
                        setPasswordData({ ...passwordData, new_password: e.target.value })
                      }
                      className="w-full px-3 py-1.5 text-sm bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 pr-8"
                      placeholder="Enter new password (min 4 characters)"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={passwordData.confirm_password}
                      onChange={(e) =>
                        setPasswordData({ ...passwordData, confirm_password: e.target.value })
                      }
                      className="w-full px-3 py-1.5 text-sm bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 pr-8"
                      placeholder="Confirm new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleChangePassword}
                  disabled={saving || !passwordData.current_password || !passwordData.new_password}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg hover:from-emerald-600 hover:to-teal-700 transition-all disabled:opacity-50"
                >
                  <Lock className="w-3.5 h-3.5" />
                  {saving ? "Changing..." : "Change Password"}
                </button>
              </div>
            )}
          </div>

          {/* Theme Preference */}
          <div className="border-t border-white/10 pt-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-purple-400" />
              Theme Preference
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => handleThemeChange("dark")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all ${
                  theme === "dark"
                    ? "bg-blue-500/20 border-blue-500/30 text-blue-400"
                    : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                Dark
              </button>
              <button
                onClick={() => handleThemeChange("light")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all ${
                  theme === "light"
                    ? "bg-blue-500/20 border-blue-500/30 text-blue-400"
                    : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                Light
              </button>
              <button
                onClick={() => handleThemeChange("system")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all ${
                  theme === "system"
                    ? "bg-blue-500/20 border-blue-500/30 text-blue-400"
                    : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                System
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}