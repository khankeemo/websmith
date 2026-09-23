"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import {
  defaultNavbarVisibility,
  getNavbarVisibility,
  NavbarSectionKey,
  NavbarVisibility,
  updateNavbarVisibility,
} from "../../core/services/publicSettingsService";

type NavbarVisibilityToggleProps = {
  sectionKey: NavbarSectionKey;
  label: string;
  description?: string;
  variant?: "card" | "compact";
};

export default function NavbarVisibilityToggle({
  sectionKey,
  label,
  description = "Control whether this section appears in the public website navigation menu.",
  variant = "card",
}: NavbarVisibilityToggleProps) {
  const [visibility, setVisibility] = useState<NavbarVisibility>(defaultNavbarVisibility);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    getNavbarVisibility()
      .then((value) => {
        if (mounted) setVisibility(value);
      })
      .catch(() => {
        if (mounted) setMessage("Unable to load navbar visibility.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleChange = useCallback(
    async (checked: boolean) => {
      const nextVisibility = { ...visibility, [sectionKey]: checked };
      setVisibility(nextVisibility);
      setSaving(true);
      setMessage(null);

      try {
        const saved = await updateNavbarVisibility(nextVisibility);
        setVisibility(saved);
        setMessage(checked ? "Visible in navbar." : "Hidden from navbar.");
      } catch {
        setVisibility(visibility);
        setMessage("Failed to save visibility.");
      } finally {
        setSaving(false);
      }
    },
    [sectionKey, visibility]
  );

  const checked = visibility[sectionKey];

  if (variant === "compact") {
    return (
      <div style={styles.compactWrap} title={description} className="wsd-navbar-toggle-compact">
        <span style={styles.compactLabel}>Public Navbar</span>
        <label style={{ ...styles.compactSwitchWrap, opacity: loading ? 0.55 : 1 }}>
          <input
            type="checkbox"
            checked={checked}
            disabled={loading || saving}
            onChange={(event) => handleChange(event.target.checked)}
            style={styles.checkbox}
          />
          <span style={{ ...styles.compactSwitchTrack, ...(checked ? styles.compactSwitchTrackActive : {}) }}>
            <span style={{ ...styles.compactSwitchThumb, ...(checked ? styles.compactSwitchThumbActive : {}) }} />
          </span>
          <span style={styles.compactSwitchText}>{checked ? "Visible" : "Hidden"}</span>
        </label>
      </div>
    );
  }

  return (
    <div style={styles.card}>
      <div style={styles.copy}>
        <span style={styles.kicker}>Navbar Visibility</span>
        <h3 style={styles.title}>{label}</h3>
        <p style={styles.description}>{description}</p>
        {message ? <p style={styles.message}>{message}</p> : null}
      </div>
      <label style={{ ...styles.switchWrap, opacity: loading ? 0.55 : 1 }}>
        <input
          type="checkbox"
          checked={checked}
          disabled={loading || saving}
          onChange={(event) => handleChange(event.target.checked)}
          style={styles.checkbox}
        />
        <span style={{ ...styles.switchTrack, ...(checked ? styles.switchTrackActive : {}) }}>
          <span style={{ ...styles.switchThumb, ...(checked ? styles.switchThumbActive : {}) }} />
        </span>
        <span style={styles.switchLabel}>{checked ? "Show" : "Hide"}</span>
      </label>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "18px",
    padding: "18px 20px",
    borderRadius: "16px",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-secondary)",
    marginBottom: "18px",
    flexWrap: "wrap",
  },
  copy: {
    display: "grid",
    gap: "4px",
    minWidth: "220px",
    flex: "1 1 360px",
  },
  kicker: {
    color: "#007AFF",
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  title: {
    margin: 0,
    color: "var(--text-primary)",
    fontSize: "17px",
    fontWeight: 800,
  },
  description: {
    margin: 0,
    color: "var(--text-secondary)",
    fontSize: "13px",
    lineHeight: 1.5,
  },
  message: {
    margin: "6px 0 0",
    color: "var(--text-secondary)",
    fontSize: "12px",
    fontWeight: 700,
  },
  switchWrap: {
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    cursor: "pointer",
    userSelect: "none",
  },
  checkbox: {
    position: "absolute",
    opacity: 0,
    pointerEvents: "none",
  },
  switchTrack: {
    width: "52px",
    height: "30px",
    borderRadius: "999px",
    backgroundColor: "#8E8E93",
    position: "relative",
    transition: "background-color 0.2s ease",
    flexShrink: 0,
  },
  switchTrackActive: {
    backgroundColor: "#34C759",
  },
  switchThumb: {
    position: "absolute",
    top: "4px",
    left: "4px",
    width: "22px",
    height: "22px",
    borderRadius: "50%",
    backgroundColor: "#FFFFFF",
    boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
    transition: "transform 0.2s ease",
  },
  switchThumbActive: {
    transform: "translateX(22px)",
  },
  switchLabel: {
    minWidth: "38px",
    color: "var(--text-primary)",
    fontSize: "13px",
    fontWeight: 800,
  },
  compactWrap: {
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    padding: "7px 12px",
    borderRadius: "12px",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-secondary)",
  },
  compactLabel: {
    color: "var(--text-secondary)",
    fontWeight: 600,
    fontSize: "12px",
    whiteSpace: "nowrap",
  },
  compactSwitchWrap: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    cursor: "pointer",
    userSelect: "none",
  },
  compactSwitchTrack: {
    width: "36px",
    height: "20px",
    borderRadius: "999px",
    backgroundColor: "rgba(142, 142, 147, 0.4)",
    position: "relative",
    transition: "background-color 0.2s ease",
    flexShrink: 0,
  },
  compactSwitchTrackActive: {
    backgroundColor: "#34C759",
  },
  compactSwitchThumb: {
    position: "absolute",
    top: "2px",
    left: "2px",
    width: "16px",
    height: "16px",
    borderRadius: "50%",
    backgroundColor: "#FFFFFF",
    boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
    transition: "transform 0.2s ease",
  },
  compactSwitchThumbActive: {
    transform: "translateX(16px)",
  },
  compactSwitchText: {
    color: "var(--text-primary)",
    fontSize: "12px",
    fontWeight: 700,
    minWidth: "44px",
  },
};
