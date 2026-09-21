"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";
import { publicFooterConfig } from "../../core/config/publicSite";
import { SOCIAL_PLATFORM_META, type SocialPlatformMeta } from "../../lib/social-platforms";
import API from "../../core/services/apiService";
import { usePublicTheme } from "../../app/providers/PublicThemeProvider";

type SocialItem = SocialPlatformMeta & { href: string };

export default function PublicFooter() {
  const pathname = usePathname();
  const { publicTheme } = usePublicTheme();
  const isDark = publicTheme === "dark";
  const year = new Date().getFullYear();
  const [socials, setSocials] = useState<SocialItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    API.get("/settings/public/contact_info")
      .then((res) => {
        if (cancelled || !res.data?.success || !res.data?.data) return;
        const data = res.data.data;
        setSocials(
          SOCIAL_PLATFORM_META.map((platform) => ({
            ...platform,
            href: data[platform.key] || "",
          })).filter((item) => Boolean(item.href))
        );
      })
      .catch(() => {
        // Footer keeps brand/sections; socials stay hidden when settings cannot load.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <footer
      style={{
        ...styles.footer,
        backgroundColor: isDark ? "#070B14" : "var(--bg-secondary)",
        borderTop: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid var(--border-color)",
      }}
    >
      <div style={styles.content} className="landing-footer-content">
        <div style={styles.section}>
          <div style={styles.brandRow}>
            <span
              style={{
                ...styles.footerLogoShell,
                backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "var(--bg-primary)",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid var(--border-color)",
              }}
            >
              <Image src="/images/websmith_1x1.jpg" alt="Websmith Digital logo" width={42} height={42} style={styles.footerLogo} />
            </span>
            <h3 style={styles.brandName}>{publicFooterConfig.brand.name}</h3>
          </div>
          <p style={styles.tagline}>{publicFooterConfig.brand.tagline}</p>
          <p style={styles.aboutSummary}>
            We design smart solutions and build powerful digital ecosystems that help businesses grow and automate through innovation and practicality.
          </p>
          {socials.length > 0 && (
            <div style={styles.socialRow}>
              {socials.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.key}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.label}
                    title={social.label}
                    style={styles.socialLink}
                    className="public-footer-social"
                  >
                    <Icon size={18} />
                  </a>
                );
              })}
            </div>
          )}
        </div>

        {publicFooterConfig.sections.map((section) => (
          <div key={section.title} style={styles.section}>
            <h4 style={styles.sectionTitle}>{section.title}</h4>
            {section.links.map((link) => (
              <Link key={`${section.title}-${link.href}`} href={link.href} style={styles.link} className="public-footer-link">
                {link.label}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div style={styles.bottomBar}>
        <p style={styles.bottomText}>© {year} Websmith Digital. All Rights Reserved. Developed with care by the Websmith Digital Team.</p>
      </div>
      <style>{`
        .public-footer-link,
        .public-footer-social {
          transition: all 0.24s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .public-footer-link:hover {
          color: #007AFF !important;
          transform: translateX(4px);
        }
        .public-footer-social:hover {
          border-color: rgba(0, 122, 255, 0.35) !important;
          color: #007AFF !important;
          transform: translateY(-3px);
          box-shadow: 0 12px 24px rgba(0, 122, 255, 0.14);
        }
        @media (max-width: 600px) {
          .landing-footer-content {
            grid-template-columns: 1fr !important;
            gap: 32px !important;
          }
        }
      `}</style>
    </footer>
  );
}

const styles: Record<string, CSSProperties> = {
  footer: {
    backgroundColor: "var(--bg-secondary)",
    borderTop: "1px solid var(--border-color)",
    padding: "48px 0 24px",
  },
  content: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "40px",
    width: "100%",
    maxWidth: "100%",
    margin: 0,
    padding: "0 clamp(16px, 4vw, 48px)",
    marginBottom: "40px",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  brandRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  footerLogoShell: {
    width: "42px",
    height: "42px",
    borderRadius: "50%",
    overflow: "hidden",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "var(--bg-primary)",
    border: "1px solid var(--border-color)",
    flexShrink: 0,
  },
  footerLogo: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  brandName: {
    margin: 0,
    fontSize: "20px",
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  tagline: {
    margin: 0,
    fontSize: "14px",
    color: "var(--text-secondary)",
    lineHeight: 1.6,
  },
  aboutSummary: {
    margin: "8px 0 0",
    fontSize: "13px",
    color: "var(--text-secondary)",
    lineHeight: 1.6,
    opacity: 0.8,
  },
  socialRow: {
    display: "flex",
    gap: "16px",
    marginTop: "8px",
  },
  socialLink: {
    width: "36px",
    height: "36px",
    borderRadius: "999px",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    fontSize: "11px",
    fontWeight: 700,
  },
  sectionTitle: {
    margin: 0,
    fontSize: "16px",
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  link: {
    fontSize: "14px",
    color: "var(--text-secondary)",
    textDecoration: "none",
  },
  bottomBar: {
    textAlign: "center",
    paddingTop: "24px",
    borderTop: "1px solid var(--border-color)",
    margin: "0 clamp(16px, 4vw, 48px)",
  },
  bottomText: {
    margin: 0,
    color: "var(--text-secondary)",
    fontSize: "12px",
  },
};
