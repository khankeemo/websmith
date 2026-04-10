"use client";

import { useState, useEffect } from "react";
import { User, Mail, Phone, Building, Edit3, Calendar } from "lucide-react";
import { AuthUser, getStoredUser } from "../../lib/auth";

export default function ProfilePageContent() {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const storedUser = getStoredUser();
    setUser(storedUser);

    const handleUpdate = () => {
      setUser(getStoredUser());
    };

    window.addEventListener("userProfileUpdated", handleUpdate);
    return () => window.removeEventListener("userProfileUpdated", handleUpdate);
  }, []);

  if (!user) return null;

  return (
    <div style={styles.container}>
      {/* Profile Header Card */}
      <div style={styles.headerCard}>
        <div style={styles.banner} />
        <div style={styles.profileHeaderInfo}>
          <div style={styles.avatarWrapper}>
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} style={styles.avatarImg} />
            ) : (
              <div style={styles.avatarPlaceholder}>
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div style={styles.headerText}>
            <h1 style={styles.name}>{user.name}</h1>
            <p style={styles.roleBadge}>{user.role.toUpperCase()}</p>
          </div>

        </div>
      </div>

      {/* Profile Details Grid */}
      <div style={styles.detailsGrid}>
        <div style={styles.detailCard}>
          <h3 style={styles.cardTitle}>Personal Information</h3>
          <div style={styles.infoList}>
            <div style={styles.infoItem}>
              <div style={styles.iconBox}><Mail size={20} /></div>
              <div style={styles.infoContent}>
                <label style={styles.infoLabel}>Email Address</label>
                <p style={styles.infoValue}>{user.email}</p>
              </div>
            </div>
            
            <div style={styles.infoItem}>
              <div style={styles.iconBox}><Phone size={20} /></div>
              <div style={styles.infoContent}>
                <label style={styles.infoLabel}>Phone Number</label>
                <p style={styles.infoValue}>{user.phone || "Not provided"}</p>
              </div>
            </div>

            <div style={styles.infoItem}>
              <div style={styles.iconBox}><Building size={20} /></div>
              <div style={styles.infoContent}>
                <label style={styles.infoLabel}>Company</label>
                <p style={styles.infoValue}>{user.company || "Not provided"}</p>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.detailCard}>
          <h3 style={styles.cardTitle}>Account Statistics</h3>
          <div style={styles.infoList}>
            <div style={styles.infoItem}>
              <div style={styles.iconBox}><Calendar size={20} /></div>
              <div style={styles.infoContent}>
                <label style={styles.infoLabel}>Member Since</label>
                <p style={styles.infoValue}>
                  {user.id ? new Date(parseInt(user.id.substring(0, 8), 16) * 1000).toLocaleDateString() : "Active Member"}
                </p>
              </div>
            </div>

            <div style={styles.infoItem}>
              <div style={styles.iconBox}><User size={20} /></div>
              <div style={styles.infoContent}>
                <label style={styles.infoLabel}>Account Status</label>
                <p style={{...styles.infoValue, color: "#34C759"}}>Fully Verified</p>
              </div>
            </div>
          </div>
        </div>
      </div>



      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .profile-edit-btn {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .profile-edit-btn:hover {
          background-color: #0056b3 !important;
          transform: translateY(-2px);
          box-shadow: 0 4px 15px rgba(0, 122, 255, 0.3);
        }
      `}</style>
    </div>
  );
}

const styles: any = {
  container: {
    padding: "20px",
    maxWidth: "1000px",
    margin: "0 auto",
    animation: "slideUp 0.6s ease-out",
  },
  headerCard: {
    backgroundColor: "var(--bg-primary)",
    borderRadius: "24px",
    overflow: "hidden",
    boxShadow: "0 10px 30px rgba(0,0,0,0.05)",
    border: "1px solid var(--border-color)",
    marginBottom: "32px",
  },
  banner: {
    height: "120px",
    background: "linear-gradient(135deg, #007AFF 0%, #00C7BE 100%)",
  },
  profileHeaderInfo: {
    padding: "0 32px 32px",
    display: "flex",
    alignItems: "flex-end",
    gap: "24px",
    marginTop: "-45px",
    flexWrap: "wrap",
  },
  avatarWrapper: {
    width: "120px",
    height: "120px",
    borderRadius: "32px",
    border: "6px solid var(--bg-primary)",
    overflow: "hidden",
    backgroundColor: "var(--bg-secondary)",
    boxShadow: "0 8px 20px rgba(0,0,0,0.1)",
  },
  avatarImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "48px",
    fontWeight: 700,
    color: "#007AFF",
    backgroundColor: "#F2F2F7",
  },
  headerText: {
    flex: 1,
    minWidth: "200px",
    paddingBottom: "10px",
  },
  name: {
    fontSize: "28px",
    fontWeight: 700,
    color: "var(--text-primary)",
    margin: "0 0 4px 0",
    letterSpacing: "-0.5px",
  },
  roleBadge: {
    display: "inline-block",
    fontSize: "12px",
    fontWeight: 700,
    color: "#007AFF",
    backgroundColor: "rgba(0,122,255,0.1)",
    padding: "4px 12px",
    borderRadius: "100px",
    letterSpacing: "1px",
  },
  editButton: {
    backgroundColor: "#007AFF",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "14px",
    padding: "12px 24px",
    fontSize: "15px",
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    gap: "10px",
    cursor: "pointer",
    marginBottom: "10px",
  },
  detailsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "24px",
  },
  detailCard: {
    backgroundColor: "var(--bg-primary)",
    borderRadius: "24px",
    padding: "24px",
    border: "1px solid var(--border-color)",
    boxShadow: "0 4px 20px rgba(0,0,0,0.02)",
  },
  cardTitle: {
    fontSize: "18px",
    fontWeight: 600,
    color: "var(--text-primary)",
    marginBottom: "20px",
  },
  infoList: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  infoItem: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  iconBox: {
    width: "44px",
    height: "44px",
    borderRadius: "12px",
    backgroundColor: "var(--bg-secondary)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#007AFF",
  },
  infoContent: {
    display: "flex",
    flexDirection: "column",
  },
  infoLabel: {
    fontSize: "12px",
    fontWeight: 500,
    color: "var(--text-secondary)",
    marginBottom: "2px",
  },
  infoValue: {
    fontSize: "15px",
    fontWeight: 600,
    color: "var(--text-primary)",
    margin: 0,
  },
};
