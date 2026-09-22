"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useLayoutEffect, useState, useRef, type CSSProperties } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { 
  Menu, 
  X, 
  Search, 
  ShoppingCart, 
  Heart, 
  History as HistoryIcon, 
  Mail, 
  ChevronDown, 
  ChevronRight,
  ExternalLink 
} from "lucide-react";
import { getStoredUser, getToken } from "../../lib/auth";
import { usePublicTheme } from "../../app/providers/PublicThemeProvider";
import { useLeadFunnel } from "../../app/providers/LeadFunnelProvider";
import { useStoreUI } from "../../app/software-store/StoreUIContext";
import MegaMenuServices from "./MegaMenuServices";
import DropdownIndustries from "./DropdownIndustries";
import DropdownCompany from "./DropdownCompany";

const brandLogo = "/images/websmith_1x1.jpg";

type PublicSiteNavProps = {
  /** Minimal bar (logo + Home + CTA) for sign-in pages — avoids the full marketing menu on /login */
  variant?: "full" | "auth";
};

export default function PublicSiteNav({ variant = "full" }: PublicSiteNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navMounted, setNavMounted] = useState(false);
  const { publicTheme, togglePublicTheme } = usePublicTheme();
  const { openLeadServicesModal } = useLeadFunnel();
  const isLogin = pathname === "/login";
  const isAuthLayout = variant === "auth";
  const isStoreRoute = Boolean(pathname?.startsWith("/software-store"));
  const storeUI = useStoreUI();
  const isDark = publicTheme === "dark";

  // DreamX Dropdown state
  const [activeDropdown, setActiveDropdown] = useState<"services" | "industries" | "company" | null>(null);
  const dropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Mobile accordion state
  const [mobileExpandedSection, setMobileExpandedSection] = useState<"services" | "industries" | "company" | null>(null);

  useLayoutEffect(() => {
    setNavMounted(true);
  }, []);

  const showGuestThemeToggle = navMounted;

  const handleMouseEnter = (menu: "services" | "industries" | "company") => {
    if (dropdownTimeoutRef.current) clearTimeout(dropdownTimeoutRef.current);
    setActiveDropdown(menu);
  };

  const handleMouseLeave = () => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setActiveDropdown(null);
    }, 150);
  };

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        setActiveDropdown(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  // Close dropdowns on route change
  useEffect(() => {
    setActiveDropdown(null);
    setMobileOpen(false);
  }, [pathname]);

  if (isAuthLayout) {
    return (
      <nav style={styles.navAuth} className="landing-nav-shell public-site-nav public-site-nav--auth">
        <div style={styles.navAuthInner} className="landing-nav-content">
          <Link href="/" style={styles.logo} className="logo-hover" onClick={() => setMobileOpen(false)}>
            <div style={styles.logoCircle}>
              <Image src={brandLogo} alt="Websmith Digital logo" width={36} height={36} style={styles.logoImage} priority />
            </div>
            <span style={styles.logoText}>Websmith</span>
          </Link>
          <div style={styles.authNavRight}>
            <Link href="/" style={styles.authTextLink}>
              Home
            </Link>
            {showGuestThemeToggle && (
              <button
                type="button"
                onClick={togglePublicTheme}
                style={styles.themeToggleBtn}
                aria-label={`Switch to ${publicTheme === "light" ? "dark" : "light"} mode`}
              >
                <span aria-hidden="true" style={styles.themeEmoji}>{publicTheme === "light" ? "🌙" : "☀️"}</span>
              </button>
            )}
            <button type="button" onClick={() => openLeadServicesModal()} style={styles.ctaBtn} className="cta-hover public-nav-cta">
              Get Started
            </button>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav
      style={{
        ...styles.nav,
        backgroundColor: isDark
          ? "rgba(10, 15, 29, 0.88)"
          : "rgba(255, 255, 255, 0.9)",
        borderBottom: isDark
          ? "1px solid rgba(255, 255, 255, 0.08)"
          : "1px solid #e2e8f0",
        backdropFilter: "blur(16px)",
      }}
      className="landing-nav-shell public-site-nav"
    >
      <div style={styles.navContent} className="landing-nav-content">
        <div style={styles.leftNavGroup}>
          {/* Brand Logo */}
          <Link href="/" style={styles.logo} className="logo-hover" onClick={() => setMobileOpen(false)}>
            <div
              style={{
                ...styles.logoCircle,
                backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "var(--bg-secondary)",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid var(--border-color)",
              }}
            >
              <Image src={brandLogo} alt="Websmith Digital logo" width={36} height={36} style={styles.logoImage} priority />
            </div>
            <span style={{ ...styles.logoText, color: isDark ? "#FFFFFF" : "#1d1d1f" }}>Websmith</span>
          </Link>

          {/* DreamX-Style Desktop Navigation */}
          <div style={styles.desktopMenu} className="desktop-menu">
            {/* 1. Home */}
            <Link
              href="/"
              style={{
                ...styles.menuItem,
                color: pathname === "/" ? "#007AFF" : (isDark ? "#E2E8F0" : "#1d1d1f"),
                fontWeight: pathname === "/" ? 600 : 500,
              }}
              className={`menu-item-hover ${pathname === "/" ? "active-nav-link" : ""}`}
            >
              Home
            </Link>

            {/* 2. Services ▾ (DreamX Interactive Mega-Menu) */}
            <div
              style={{ position: "relative" }}
              onMouseEnter={() => handleMouseEnter("services")}
              onMouseLeave={handleMouseLeave}
            >
              <button
                type="button"
                onClick={() => setActiveDropdown(activeDropdown === "services" ? null : "services")}
                style={{
                  ...styles.menuItem,
                  color: pathname === "/services" || activeDropdown === "services" ? "#007AFF" : (isDark ? "#E2E8F0" : "#1d1d1f"),
                  fontWeight: pathname === "/services" || activeDropdown === "services" ? 600 : 500,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "8px 10px",
                }}
                className="menu-item-hover"
                aria-expanded={activeDropdown === "services"}
              >
                <span>Services</span>
                <ChevronDown
                  size={14}
                  style={{
                    transform: activeDropdown === "services" ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s ease",
                  }}
                />
              </button>
            </div>

            {/* 3. Industries ▾ */}
            <div
              style={{ position: "relative" }}
              onMouseEnter={() => handleMouseEnter("industries")}
              onMouseLeave={handleMouseLeave}
            >
              <button
                type="button"
                onClick={() => setActiveDropdown(activeDropdown === "industries" ? null : "industries")}
                style={{
                  ...styles.menuItem,
                  color: activeDropdown === "industries" ? "#007AFF" : (isDark ? "#E2E8F0" : "#1d1d1f"),
                  fontWeight: activeDropdown === "industries" ? 600 : 500,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "8px 10px",
                }}
                className="menu-item-hover"
                aria-expanded={activeDropdown === "industries"}
              >
                <span>Industries</span>
                <ChevronDown
                  size={14}
                  style={{
                    transform: activeDropdown === "industries" ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s ease",
                  }}
                />
              </button>
              {activeDropdown === "industries" && (
                <DropdownIndustries isDark={isDark} onClose={() => setActiveDropdown(null)} />
              )}
            </div>

            {/* 4. Portfolio (Direct Link) */}
            <Link
              href="/portfolio"
              style={{
                ...styles.menuItem,
                color: pathname === "/portfolio" ? "#007AFF" : (isDark ? "#E2E8F0" : "#1d1d1f"),
                fontWeight: pathname === "/portfolio" ? 600 : 500,
              }}
              className={`menu-item-hover ${pathname === "/portfolio" ? "active-nav-link" : ""}`}
            >
              Portfolio
            </Link>

            {/* 5. Company ▾ */}
            <div
              style={{ position: "relative" }}
              onMouseEnter={() => handleMouseEnter("company")}
              onMouseLeave={handleMouseLeave}
            >
              <button
                type="button"
                onClick={() => setActiveDropdown(activeDropdown === "company" ? null : "company")}
                style={{
                  ...styles.menuItem,
                  color: pathname === "/about" || pathname === "/careers" || activeDropdown === "company" ? "#007AFF" : (isDark ? "#E2E8F0" : "#1d1d1f"),
                  fontWeight: pathname === "/about" || pathname === "/careers" || activeDropdown === "company" ? 600 : 500,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "8px 10px",
                }}
                className="menu-item-hover"
                aria-expanded={activeDropdown === "company"}
              >
                <span>Company</span>
                <ChevronDown
                  size={14}
                  style={{
                    transform: activeDropdown === "company" ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s ease",
                  }}
                />
              </button>
              {activeDropdown === "company" && (
                <DropdownCompany isDark={isDark} onClose={() => setActiveDropdown(null)} />
              )}
            </div>

            {/* 6. Software Store */}
            <Link
              href="/software-store"
              style={{
                ...styles.menuItem,
                color: pathname?.startsWith("/software-store") ? "#007AFF" : (isDark ? "#E2E8F0" : "#1d1d1f"),
                fontWeight: pathname?.startsWith("/software-store") ? 600 : 500,
              }}
              className={`menu-item-hover ${pathname?.startsWith("/software-store") ? "active-nav-link" : ""}`}
            >
              Software Store
            </Link>

            {/* 7. Contact Us */}
            <Link
              href="/#contact"
              style={{
                ...styles.menuItem,
                color: isDark ? "#E2E8F0" : "#1d1d1f",
              }}
              className="menu-item-hover"
            >
              Contact Us
            </Link>
          </div>
        </div>

        {/* Integrated Store Search in Main Top Navigation */}
        {isStoreRoute && (
          <div className="flex-1 max-w-[180px] md:max-w-xs lg:max-w-sm mx-2 relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              value={storeUI?.searchQuery || ""}
              onChange={(e) => storeUI?.setSearchQuery(e.target.value)}
              placeholder="Search software..."
              aria-label="Search software"
              className={`w-full pl-9 pr-3 py-1.5 rounded-xl text-xs sm:text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${
                isDark
                  ? "bg-white/[0.06] border border-white/10 text-white placeholder-slate-400 focus:border-indigo-400/50"
                  : "bg-slate-100 border border-slate-200 text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:bg-white"
              }`}
            />
          </div>
        )}

        <div style={styles.navButtons} className="nav-buttons">
          {/* Integrated Store Actions in Main Top Navigation */}
          {isStoreRoute && (
            <div className="flex items-center gap-1.5 mr-1">
              <motion.button
                onClick={() => storeUI?.openHistory()}
                className={`relative flex items-center justify-center w-8 h-8 rounded-xl border transition-all ${
                  isDark
                    ? "border-white/10 bg-white/[0.04] text-emerald-300 hover:bg-white/[0.08]"
                    : "border-slate-200 bg-slate-100 text-emerald-600 hover:bg-slate-200"
                }`}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                aria-label="Purchase History"
                title="Purchase History"
              >
                <HistoryIcon className="w-3.5 h-3.5" />
              </motion.button>
              <motion.button
                onClick={() => storeUI?.openWishlist()}
                className={`relative flex items-center justify-center w-8 h-8 rounded-xl border transition-all ${
                  isDark
                    ? "border-white/10 bg-white/[0.04] text-rose-300 hover:bg-white/[0.08]"
                    : "border-slate-200 bg-slate-100 text-rose-600 hover:bg-slate-200"
                }`}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                aria-label={`Wishlist (${storeUI?.wishlistCount || 0} items)`}
                title={`Wishlist (${storeUI?.wishlistCount || 0} items)`}
              >
                <Heart className="w-3.5 h-3.5" />
                {(storeUI?.wishlistCount ?? 0) > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center leading-none shadow-sm">
                    {storeUI?.wishlistCount}
                  </span>
                )}
              </motion.button>
              <motion.button
                onClick={() => storeUI?.openCart()}
                className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-sm hover:brightness-110 transition-all"
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                aria-label={`Cart (${storeUI?.cartCount || 0} items)`}
                title={`Cart (${storeUI?.cartCount || 0} items)`}
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                {(storeUI?.cartCount ?? 0) > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-amber-400 text-amber-950 text-[9px] font-bold flex items-center justify-center leading-none shadow-sm">
                    {storeUI?.cartCount}
                  </span>
                )}
              </motion.button>
              <motion.button
                onClick={() => storeUI?.openEmailCenter()}
                className={`relative flex items-center justify-center w-8 h-8 rounded-xl border transition-all ${
                  isDark
                    ? "border-white/10 bg-white/[0.04] text-indigo-300 hover:bg-white/[0.08]"
                    : "border-slate-200 bg-slate-100 text-indigo-600 hover:bg-slate-200"
                }`}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                aria-label="Store Email Center"
                title="Store Email Center"
              >
                <Mail className="w-3.5 h-3.5" />
              </motion.button>
            </div>
          )}

          {showGuestThemeToggle && (
            <button
              type="button"
              onClick={togglePublicTheme}
              style={{
                ...styles.themeToggleBtn,
                backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#f1f5f9",
                borderColor: isDark ? "rgba(255, 255, 255, 0.12)" : "#e2e8f0",
                color: isDark ? "#FFFFFF" : "#1d1d1f",
              }}
              aria-label={`Switch to ${publicTheme === "light" ? "dark" : "light"} mode`}
            >
              <span aria-hidden="true" style={styles.themeEmoji}>{publicTheme === "light" ? "🌙" : "☀️"}</span>
            </button>
          )}
          {!isLogin && (
            <button
              type="button"
              onClick={() => router.push("/login")}
              style={{
                ...styles.loginBtn,
                backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "transparent",
                borderColor: isDark ? "rgba(255, 255, 255, 0.12)" : "#e2e8f0",
                color: isDark ? "#F1F5F9" : "#1d1d1f",
              }}
              className="login-btn-hover"
            >
              Log in
            </button>
          )}
          <button 
            type="button" 
            onClick={() => openLeadServicesModal()} 
            style={{
              ...styles.ctaBtn,
              background: "linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)",
              color: "#ffffff",
              border: "none",
              boxShadow: "0 4px 14px rgba(37, 99, 235, 0.35)",
            }} 
            className="cta-hover public-nav-cta"
          >
            Get Started
          </button>
        </div>

        {/* Global Centered Services Mega-Menu */}
        {activeDropdown === "services" && (
          <div
            onMouseEnter={() => handleMouseEnter("services")}
            onMouseLeave={handleMouseLeave}
          >
            <MegaMenuServices isDark={isDark} onClose={() => setActiveDropdown(null)} />
          </div>
        )}

        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          style={{
            ...styles.mobileMenuBtn,
            color: isDark ? "#FFFFFF" : "#1d1d1f",
          }}
          className="mobile-menu-btn"
          aria-expanded={mobileOpen}
          aria-controls="public-site-navigation"
          aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu Panel */}
      {mobileOpen && (
        <>
          <button
            type="button"
            style={styles.mobileMenuOverlay}
            className="public-mobile-menu-overlay"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation menu"
          />
          <div
            id="public-site-navigation"
            style={{
              ...styles.mobileMenu,
              backgroundColor: isDark ? "#070B14" : "#ffffff",
              borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#e2e8f0",
              overflowY: "auto",
              maxHeight: "85vh",
            }}
            className="public-mobile-menu-panel"
          >
            {isStoreRoute && (
              <div className={`pb-3 mb-3 border-b ${isDark ? "border-white/10" : "border-slate-200"} flex flex-col gap-2`}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    value={storeUI?.searchQuery || ""}
                    onChange={(e) => storeUI?.setSearchQuery(e.target.value)}
                    placeholder="Search software..."
                    aria-label="Search software"
                    className={`w-full pl-9 pr-3 py-2 rounded-xl text-sm transition-all focus:outline-none ${
                      isDark
                        ? "bg-white/[0.06] border border-white/10 text-white placeholder-slate-400"
                        : "bg-slate-100 border border-slate-200 text-slate-900 placeholder-slate-400"
                    }`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => { setMobileOpen(false); storeUI?.openHistory(); }}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border ${
                      isDark ? "border-white/10 bg-white/[0.04] text-emerald-300" : "border-slate-200 bg-slate-100 text-emerald-700"
                    }`}
                  >
                    <HistoryIcon className="w-3.5 h-3.5" /> History
                  </button>
                  <button
                    onClick={() => { setMobileOpen(false); storeUI?.openWishlist(); }}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border ${
                      isDark ? "border-white/10 bg-white/[0.04] text-rose-300" : "border-slate-200 bg-slate-100 text-rose-700"
                    }`}
                  >
                    <Heart className="w-3.5 h-3.5" /> Wishlist ({storeUI?.wishlistCount || 0})
                  </button>
                  <button
                    onClick={() => { setMobileOpen(false); storeUI?.openCart(); }}
                    className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-sm"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" /> Cart ({storeUI?.cartCount || 0})
                  </button>
                  <button
                    onClick={() => { setMobileOpen(false); storeUI?.openEmailCenter(); }}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border ${
                      isDark ? "border-white/10 bg-white/[0.04] text-indigo-300" : "border-slate-200 bg-slate-100 text-indigo-700"
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5" /> Email Center
                  </button>
                </div>
              </div>
            )}

            {/* Mobile Nav Links */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <Link
                href="/"
                style={{
                  ...styles.mobileMenuItem,
                  color: pathname === "/" ? "#007AFF" : (isDark ? "#E2E8F0" : "#1d1d1f"),
                  fontWeight: pathname === "/" ? 600 : 500,
                }}
                className={`mobile-menu-item ${pathname === "/" ? "active-mobile-link" : ""}`}
                onClick={() => setMobileOpen(false)}
              >
                Home
              </Link>

              {/* Mobile Services Accordion */}
              <div>
                <button
                  type="button"
                  onClick={() => setMobileExpandedSection(mobileExpandedSection === "services" ? null : "services")}
                  style={{
                    ...styles.mobileMenuItem,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: isDark ? "#E2E8F0" : "#1d1d1f",
                  }}
                >
                  <span>Services</span>
                  <ChevronDown
                    size={16}
                    style={{
                      transform: mobileExpandedSection === "services" ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.2s ease",
                    }}
                  />
                </button>
                {mobileExpandedSection === "services" && (
                  <div style={{ paddingLeft: "16px", display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
                    <Link
                      href="/services"
                      onClick={() => setMobileOpen(false)}
                      style={{ fontSize: "13px", color: "#3b82f6", fontWeight: 600, padding: "4px 0" }}
                    >
                      View All Services ➔
                    </Link>
                    <Link href="/services" onClick={() => setMobileOpen(false)} style={{ fontSize: "13px", color: isDark ? "#94a3b8" : "#475569" }}>
                      Software Engineering
                    </Link>
                    <Link href="/services" onClick={() => setMobileOpen(false)} style={{ fontSize: "13px", color: isDark ? "#94a3b8" : "#475569" }}>
                      Enterprise ERP & CRM
                    </Link>
                    <Link href="/services" onClick={() => setMobileOpen(false)} style={{ fontSize: "13px", color: isDark ? "#94a3b8" : "#475569" }}>
                      Universal Licensing (ULP)
                    </Link>
                    <Link href="/services" onClick={() => setMobileOpen(false)} style={{ fontSize: "13px", color: isDark ? "#94a3b8" : "#475569" }}>
                      AI Solutions
                    </Link>
                  </div>
                )}
              </div>

              {/* Mobile Industries Accordion */}
              <div>
                <button
                  type="button"
                  onClick={() => setMobileExpandedSection(mobileExpandedSection === "industries" ? null : "industries")}
                  style={{
                    ...styles.mobileMenuItem,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: isDark ? "#E2E8F0" : "#1d1d1f",
                  }}
                >
                  <span>Industries</span>
                  <ChevronDown
                    size={16}
                    style={{
                      transform: mobileExpandedSection === "industries" ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.2s ease",
                    }}
                  />
                </button>
                {mobileExpandedSection === "industries" && (
                  <div style={{ paddingLeft: "16px", display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
                    <span style={{ fontSize: "13px", color: isDark ? "#94a3b8" : "#475569" }}>FinTech & Banking</span>
                    <span style={{ fontSize: "13px", color: isDark ? "#94a3b8" : "#475569" }}>E-Commerce & Retail</span>
                    <span style={{ fontSize: "13px", color: isDark ? "#94a3b8" : "#475569" }}>Healthcare & MedTech</span>
                    <span style={{ fontSize: "13px", color: isDark ? "#94a3b8" : "#475569" }}>Enterprise SaaS</span>
                    <span style={{ fontSize: "13px", color: isDark ? "#94a3b8" : "#475569" }}>Logistics & Supply Chain</span>
                  </div>
                )}
              </div>

              {/* Portfolio */}
              <Link
                href="/portfolio"
                style={{
                  ...styles.mobileMenuItem,
                  color: pathname === "/portfolio" ? "#007AFF" : (isDark ? "#E2E8F0" : "#1d1d1f"),
                  fontWeight: pathname === "/portfolio" ? 600 : 500,
                }}
                className={`mobile-menu-item ${pathname === "/portfolio" ? "active-mobile-link" : ""}`}
                onClick={() => setMobileOpen(false)}
              >
                Portfolio
              </Link>

              {/* Mobile Company Accordion */}
              <div>
                <button
                  type="button"
                  onClick={() => setMobileExpandedSection(mobileExpandedSection === "company" ? null : "company")}
                  style={{
                    ...styles.mobileMenuItem,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: isDark ? "#E2E8F0" : "#1d1d1f",
                  }}
                >
                  <span>Company</span>
                  <ChevronDown
                    size={16}
                    style={{
                      transform: mobileExpandedSection === "company" ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.2s ease",
                    }}
                  />
                </button>
                {mobileExpandedSection === "company" && (
                  <div style={{ paddingLeft: "16px", display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
                    <Link href="/about" onClick={() => setMobileOpen(false)} style={{ fontSize: "13px", color: isDark ? "#94a3b8" : "#475569" }}>
                      About Us
                    </Link>
                    <Link href="/careers" onClick={() => setMobileOpen(false)} style={{ fontSize: "13px", color: isDark ? "#94a3b8" : "#475569" }}>
                      Careers (Hiring)
                    </Link>
                    <Link href="/#developers" onClick={() => setMobileOpen(false)} style={{ fontSize: "13px", color: isDark ? "#94a3b8" : "#475569" }}>
                      Core Team
                    </Link>
                    <Link href="/blog" onClick={() => setMobileOpen(false)} style={{ fontSize: "13px", color: isDark ? "#94a3b8" : "#475569" }}>
                      Blog
                    </Link>
                    <Link href="/documentation" onClick={() => setMobileOpen(false)} style={{ fontSize: "13px", color: isDark ? "#94a3b8" : "#475569" }}>
                      Documentation
                    </Link>
                  </div>
                )}
              </div>

              {/* Software Store */}
              <Link
                href="/software-store"
                style={{
                  ...styles.mobileMenuItem,
                  color: pathname?.startsWith("/software-store") ? "#007AFF" : (isDark ? "#E2E8F0" : "#1d1d1f"),
                  fontWeight: pathname?.startsWith("/software-store") ? 600 : 500,
                }}
                className={`mobile-menu-item ${pathname?.startsWith("/software-store") ? "active-mobile-link" : ""}`}
                onClick={() => setMobileOpen(false)}
              >
                Software Store
              </Link>

              {/* Contact Us */}
              <Link
                href="/#contact"
                style={{
                  ...styles.mobileMenuItem,
                  color: isDark ? "#E2E8F0" : "#1d1d1f",
                }}
                className="mobile-menu-item"
                onClick={() => setMobileOpen(false)}
              >
                Contact Us
              </Link>
            </div>

            <div style={styles.mobileMenuDivider} />

            {showGuestThemeToggle && (
              <button type="button" onClick={togglePublicTheme} style={styles.mobileThemeBtn} className="mobile-theme-btn">
                {publicTheme === "light" ? (
                  <>
                    <span aria-hidden="true" style={styles.mobileThemeEmoji}>🌙</span>
                    Dark mode
                  </>
                ) : (
                  <>
                    <span aria-hidden="true" style={styles.mobileThemeEmoji}>☀️</span>
                    Light mode
                  </>
                )}
              </button>
            )}

            {!isLogin && (
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  router.push("/login");
                }}
                style={styles.mobileLoginBtn}
                className="mobile-login-btn"
              >
                Log in
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                openLeadServicesModal();
              }}
              style={{
                ...styles.mobileCtaBtn,
                background: "linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)",
                color: "#ffffff",
                border: "none",
              }}
              className="cta-hover"
            >
              Get Started
            </button>
          </div>
        </>
      )}

      <style>{`
        @media (max-width: 980px) {
          .public-site-nav .desktop-menu,
          .public-site-nav .nav-buttons {
            display: none !important;
          }
          .public-site-nav .mobile-menu-btn {
            display: flex !important;
            align-items: center;
            justify-content: center;
            margin-right: 16px;
          }
          .public-site-nav .landing-nav-content {
            padding-right: 8px;
          }
        }

        /* Keep mobile nav behavior consistent with the home page */
        @media (max-width: 768px) {
          .landing-nav-shell {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0;
            width: 100%;
          }
          .landing-nav-content {
            padding: 10px 16px !important;
          }
        }
      `}</style>
    </nav>
  );
}

const styles: Record<string, CSSProperties> = {
  navAuth: {
    position: "sticky",
    top: 0,
    zIndex: 1300,
    width: "100%",
    backgroundColor: "var(--bg-primary)",
    borderBottom: "1px solid var(--border-color)",
    boxShadow: "var(--card-shadow)",
  },
  navAuthInner: {
    width: "100%",
    maxWidth: "100%",
    margin: 0,
    padding: "14px clamp(16px, 4vw, 40px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
  },
  authNavRight: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  authTextLink: {
    fontSize: "15px",
    fontWeight: 500,
    color: "var(--text-secondary)",
    textDecoration: "none",
  },
  nav: {
    position: "sticky",
    top: 0,
    backgroundColor: "color-mix(in srgb, var(--bg-primary) 92%, transparent)",
    backdropFilter: "blur(10px)",
    borderBottom: "1px solid var(--border-color)",
    zIndex: 1300,
    width: "100%",
  },
  navContent: {
    width: "100%",
    maxWidth: "100%",
    margin: 0,
    padding: "12px clamp(16px, 4vw, 40px)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  leftNavGroup: {
    display: "flex",
    alignItems: "center",
    gap: "32px",
    minWidth: 0,
    paddingLeft: 0,
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    cursor: "pointer",
    textDecoration: "none",
  },
  logoCircle: {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "var(--bg-secondary)",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    flexShrink: 0,
  },
  logoImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  themeEmoji: {
    fontSize: "18px",
    lineHeight: 1,
  },
  mobileThemeEmoji: {
    marginRight: "8px",
    fontSize: "18px",
    lineHeight: 1,
  },
  logoText: {
    fontSize: "20px",
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  desktopMenu: {
    display: "flex",
    gap: "32px",
    alignItems: "center",
    paddingRight: "24px",
  },
  menuItem: {
    fontSize: "15px",
    fontWeight: 500,
    color: "var(--text-primary)",
    cursor: "pointer",
    padding: "8px 0",
    fontFamily: "inherit",
    backgroundColor: "transparent",
    textDecoration: "none",
  },
  navButtons: {
    display: "flex",
    gap: "12px",
    paddingRight: 0,
    alignItems: "center",
  },
  themeToggleBtn: {
    width: "40px",
    height: "40px",
    borderRadius: "10px",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-primary)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
    transition: "background-color 0.2s ease, border-color 0.2s ease",
  },
  loginBtn: {
    padding: "8px 20px",
    fontSize: "14px",
    fontWeight: 500,
    backgroundColor: "transparent",
    border: "1px solid var(--border-color)",
    borderRadius: "8px",
    cursor: "pointer",
    fontFamily: "inherit",
    color: "var(--text-primary)",
  },
  ctaBtn: {
    padding: "8px 18px",
    fontSize: "14px",
    fontWeight: 600,
    backgroundColor: "#007AFF",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  mobileMenuBtn: {
    display: "none",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "8px",
    borderRadius: "8px",
    color: "var(--text-primary)",
  },
  mobileMenu: {
    display: "flex",
    flexDirection: "column",
    padding: "16px",
    border: "1px solid var(--border-color)",
    borderRadius: "20px",
    backgroundColor: "var(--bg-primary)",
    position: "fixed",
    top: "64px",
    left: "16px",
    right: "16px",
    zIndex: 1302,
    boxShadow: "var(--card-shadow)",
    maxHeight: "calc(100dvh - 80px)",
    overflowY: "auto",
  },
  mobileMenuOverlay: {
    position: "fixed",
    top: "57px",
    left: 0,
    right: 0,
    bottom: 0,
    border: "none",
    backgroundColor: "rgba(0,0,0,0.22)",
    zIndex: 1301,
    cursor: "pointer",
  },
  mobileMenuItem: {
    padding: "12px 16px",
    fontSize: "16px",
    fontWeight: 500,
    background: "none",
    border: "none",
    textAlign: "left",
    cursor: "pointer",
    borderRadius: "8px",
    fontFamily: "inherit",
    color: "var(--text-primary)",
    textDecoration: "none",
    display: "block",
  },
  mobileMenuDivider: {
    height: "1px",
    backgroundColor: "var(--border-color)",
    margin: "12px 0",
  },
  mobileThemeBtn: {
    padding: "12px 16px",
    fontSize: "16px",
    fontWeight: 500,
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
    borderRadius: "8px",
    cursor: "pointer",
    marginBottom: "8px",
    fontFamily: "inherit",
    color: "var(--text-primary)",
    textAlign: "left",
    display: "flex",
    alignItems: "center",
  },
  mobileLoginBtn: {
    padding: "12px 16px",
    fontSize: "16px",
    fontWeight: 500,
    backgroundColor: "transparent",
    border: "1px solid var(--border-color)",
    borderRadius: "8px",
    cursor: "pointer",
    marginBottom: "8px",
    fontFamily: "inherit",
    color: "var(--text-primary)",
  },
  mobileCtaBtn: {
    padding: "12px 16px",
    fontSize: "16px",
    fontWeight: 600,
    backgroundColor: "#007AFF",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontFamily: "inherit",
  },
};
