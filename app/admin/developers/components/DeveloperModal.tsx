"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { DeveloperPayload, RoleUser } from "@/core/services/userService";

interface DeveloperModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: DeveloperPayload) => void;
  developer: RoleUser | null;
  isSaving: boolean;
  submitError: string | null;
}

export default function DeveloperModal({ isOpen, onClose, onSave, developer, isSaving, submitError }: DeveloperModalProps) {
  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    phone: string;
    headline: string;
    bio: string;
    skills: string[];
    experienceYears: number;
    status: "active" | "inactive" | "on-leave";
    published: boolean;
  }>({
    name: "",
    email: "",
    phone: "",
    headline: "",
    bio: "",
    skills: [] as string[],
    experienceYears: 0,
    status: "active" as const,
    published: false,
  });
  const [skillInput, setSkillInput] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (developer) {
      setFormData({
        name: developer.name,
        email: developer.email,
        phone: developer.phone || "",
        headline: developer.headline || "",
        bio: developer.bio || "",
        skills: developer.skills || [],
        experienceYears: developer.experienceYears || 0,
        status: developer.status || "active",
        published: developer.published || false,
      });
    } else {
      setFormData({
        name: "",
        email: "",
        phone: "",
        headline: "",
        bio: "",
        skills: [],
        experienceYears: 0,
        status: "active",
        published: false,
      });
    }
  }, [developer]);

  const addSkill = () => {
    if (skillInput.trim() && !formData.skills.includes(skillInput.trim())) {
      setFormData({ ...formData, skills: [...formData.skills, skillInput.trim()] });
      setSkillInput("");
    }
  };

  const removeSkill = (skill: string) => {
    setFormData({ ...formData, skills: formData.skills.filter((s) => s !== skill) });
  };

  const validateAndBuildPayload = (publish = false): DeveloperPayload | null => {
    setLocalError(null);
    const trimmedName = formData.name.trim();
    const trimmedEmail = formData.email.trim().toLowerCase();
    const trimmedPhone = formData.phone.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[+]?[0-9()\-\s]{7,20}$/;

    if (!trimmedName) {
      setLocalError("Developer name is required.");
      return null;
    }

    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      setLocalError("Please enter a valid email ID.");
      return null;
    }

    if (trimmedPhone && !phoneRegex.test(trimmedPhone)) {
      setLocalError("Please enter a valid phone number.");
      return null;
    }

    return {
      ...formData,
      name: trimmedName,
      email: trimmedEmail,
      phone: trimmedPhone,
      published: publish ? true : formData.published,
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = validateAndBuildPayload(false);
    if (!payload) return;
    onSave(payload);
  };

  const handlePublish = () => {
    const payload = validateAndBuildPayload(true);
    if (!payload) return;
    onSave(payload);
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>{developer ? "Edit Developer" : "Add Developer"}</h2>
          <button onClick={onClose} style={styles.closeBtn}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={styles.formGrid}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Developer Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                style={styles.input}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Email ID *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                style={styles.input}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Phone Number</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                style={styles.input}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Experience (years)</label>
              <input
                type="number"
                value={formData.experienceYears}
                onChange={(e) => setFormData({ ...formData, experienceYears: parseInt(e.target.value) || 0 })}
                style={styles.input}
              />
            </div>
          </div>

          <div style={styles.sectionTitle}>Role</div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Role</label>
            <input
              type="text"
              value={formData.headline}
              onChange={(e) => setFormData({ ...formData, headline: e.target.value })}
              placeholder="e.g., Senior Full-Stack Developer"
              style={styles.input}
            />
          </div>

          <div style={styles.sectionTitle}>Description</div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Description</label>
            <textarea
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              rows={3}
              style={styles.textarea}
            />
          </div>

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

          <div style={styles.sectionTitle}>Experience</div>
          <div style={styles.formGrid}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                style={styles.select}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="on-leave">On Leave</option>
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={formData.published}
                  onChange={(e) => setFormData({ ...formData, published: e.target.checked })}
                  style={styles.checkbox}
                />
                <span>Published on public page</span>
              </label>
            </div>
          </div>

          {(localError || submitError) && <p style={styles.errorText}>{localError || submitError}</p>}

          <div style={styles.actions}>
            <button type="button" onClick={onClose} style={styles.cancelBtn}>
              Cancel
            </button>
            <button type="button" onClick={handlePublish} style={styles.publishBtn} disabled={isSaving}>
              {isSaving ? "Saving..." : "Publish"}
            </button>
            <button type="submit" style={styles.submitBtn} disabled={isSaving}>
              {isSaving ? "Saving..." : developer ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, any> = {
  overlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modal: { background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: "20px", width: "90%", maxWidth: "700px", maxHeight: "90vh", overflow: "auto", padding: "24px", color: "var(--text-primary)" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" },
  title: { margin: 0, fontSize: "24px", fontWeight: 600, color: "var(--text-primary)" },
  closeBtn: { background: "none", border: "none", cursor: "pointer", padding: "8px", color: "var(--text-secondary)" },
  sectionTitle: { margin: "8px 0 10px", fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" },
  formGroup: { marginBottom: "16px" },
  label: { display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: 500, color: "var(--text-primary)" },
  input: { width: "100%", padding: "12px", border: "1px solid var(--border-color)", borderRadius: "10px", fontSize: "15px", backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)" },
  textarea: { width: "100%", padding: "12px", border: "1px solid var(--border-color)", borderRadius: "10px", fontSize: "15px", fontFamily: "inherit", resize: "vertical", backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)" },
  select: { width: "100%", padding: "12px", border: "1px solid var(--border-color)", borderRadius: "10px", fontSize: "15px", backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)" },
  skillInputWrap: { display: "flex", gap: "8px" },
  addSkillBtn: { padding: "12px 20px", background: "#007AFF", color: "#fff", border: "none", borderRadius: "10px", cursor: "pointer" },
  skillsList: { display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "12px" },
  skillTag: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", background: "var(--bg-secondary)", borderRadius: "12px", fontSize: "13px", color: "var(--text-primary)" },
  removeSkillBtn: { background: "none", border: "none", cursor: "pointer", fontSize: "16px", color: "var(--text-secondary)" },
  checkboxLabel: { display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" },
  checkbox: { width: "18px", height: "18px" },
  errorText: { color: "#FF3B30", fontSize: "14px", marginBottom: "16px" },
  actions: { display: "flex", gap: "12px", marginTop: "24px" },
  cancelBtn: { flex: 1, padding: "14px", background: "var(--bg-secondary)", color: "var(--text-primary)", border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: 600, cursor: "pointer" },
  publishBtn: { flex: 1, padding: "14px", background: "#34C759", color: "#fff", border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: 700, cursor: "pointer" },
  submitBtn: { flex: 1, padding: "14px", background: "#007AFF", color: "#fff", border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: 600, cursor: "pointer" },
};
