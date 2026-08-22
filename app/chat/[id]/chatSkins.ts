// app/chat/[id]/chatSkins.ts
// PURPOSE: ONE reusable, token-based skin system shared by BOTH chat surfaces —
//          the Direct Secure Client Messenger (`/chat/[id]`, `ClientChat.tsx`)
//          and the Admin Messenger (`/admin/messages`,
//          `AdminMessagesClient.tsx`). Presentation ONLY — every skin is a pure
//          set of `--sk-*` CSS custom properties applied to the existing chat
//          implementations. No second chat component exists; switching a skin
//          never touches messages, sending, polling, JWT, status, or composer
//          logic.
//
//          R04 REDESIGN: each of the 10 skins is a COMPLETE coordinated theme.
//          A `defineSkin()` builder derives every token from one compact
//          palette per skin (page / surface / header / accent / incoming /
//          outgoing / composer / states …), so no skin can ship a broken or
//          half-coordinated combination and font colors stay readable on every
//          background. New R04 tokens: flat center-stage base (`--sk-center-bg`
//          — the Direct Secure Chat's CENTER 34% keeps its default/base color,
//          decorative treatment removed), bubble text (`--sk-client-text` /
//          `--sk-outgoing-text`), placeholder, icons, dividers, hover /
//          selected states, typing + unread indicators, secondary buttons,
//          scroll thumb, ambient card glow, status dot colors.
//
//          Client-safe module: no imports, no side effects — safe to import
//          from server components and tests alike.

export interface ChatSkin {
  id: string;
  name: string;
  description: string;
  /** True when the skin renders a dark card (drives a few picker details). */
  dark: boolean;
  /**
   * Complete set of `--sk-*` CSS custom properties consumed by both chat
   * surfaces. Every skin supplies the FULL set (built by defineSkin), so an
   * incomplete definition can never half-skin a messenger.
   */
  vars: Record<string, string>;
}

/** #RGB/#RRGGBB hex -> rgba() string with the given alpha. */
function hexA(hex: string, alpha: number): string {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * One compact palette per skin — every visual role of the messenger. Fields
 * are required so TypeScript guarantees each skin defines ALL roles (a
 * missing role would be a compile error, never a runtime surprise).
 */
interface SkinPalette {
  dark: boolean;
  /** Page/backdrop behind everything (gradients allowed). */
  backdrop: string;
  /** Flat base color for the Direct Chat's CENTER 34% zone (no decoration). */
  centerBg: string;
  /** Messenger card surface. */
  surface: string;
  cardBorder: string;
  /** Deep shadow color under the card. */
  shadowColor: string;
  /** Ambient glow color around the card (soft halo). */
  glowColor: string;
  /** Header band background (gradients allowed). */
  headerBg: string;
  headerBorder: string;
  /** Brand pill gradient (from -> to). */
  brandFrom: string;
  brandTo: string;
  title: string;
  subtitle: string;
  muted: string;
  sender: string;
  /** Primary readable body text. */
  text: string;
  /** Message thread area background (gradients allowed). */
  bodyBg: string;
  /** Incoming (client) bubble. */
  inBg: string;
  inBorder: string;
  inText: string;
  /** Outgoing (admin) bubble. */
  outBg: string;
  outBorder: string;
  outText: string;
  sysBg: string;
  sysBorder: string;
  sysText: string;
  composerBg: string;
  composerBorder: string;
  inputBg: string;
  inputBorder: string;
  placeholder: string;
  focusBorder: string;
  focusRing: string;
  sendFrom: string;
  sendTo: string;
  link: string;
  icon: string;
  divider: string;
  hoverBg: string;
  selectedBg: string;
  selectedText: string;
  typingDot: string;
  unread: string;
  secondaryBg: string;
  secondaryBorder: string;
  secondaryText: string;
  secondaryBgHover: string;
  statusOpen: string;
  statusClosed: string;
  scrollThumb: string;
  tooltipBg: string;
  tooltipText: string;
  ghostText: string;
  pickerBg: string;
  pickerShadow: string;
}

/** Derive the FULL `--sk-*` token set from one palette. */
function defineSkin(p: SkinPalette): Record<string, string> {
  return {
    // Stage
    "--sk-backdrop": p.backdrop,
    "--sk-center-bg": p.centerBg,
    // Card
    "--sk-card-bg": p.surface,
    "--sk-card-border": p.cardBorder,
    "--sk-card-shadow": `0 24px 70px ${hexA(p.shadowColor, p.dark ? 0.55 : 0.28)}, 0 10px 30px ${hexA(p.glowColor, 0.16)}`,
    "--sk-card-glow": `0 0 0 1px ${hexA(p.glowColor, 0.10)}, 0 34px 110px ${hexA(p.glowColor, p.dark ? 0.30 : 0.20)}`,
    // Header
    "--sk-header-bg": p.headerBg,
    "--sk-header-border": p.headerBorder,
    "--sk-header-accent": hexA(p.brandFrom, 0.9),
    "--sk-brand-bg": `linear-gradient(135deg, ${p.brandFrom}, ${p.brandTo})`,
    "--sk-brand-shadow": `0 2px 8px ${hexA(p.brandFrom, 0.35)}`,
    // Type scale
    "--sk-title": p.title,
    "--sk-subtitle": p.subtitle,
    "--sk-time": p.muted,
    "--sk-sender": p.sender,
    "--sk-text": p.text,
    // Thread area
    "--sk-body-bg": p.bodyBg,
    // Bubbles
    "--sk-client-bg": p.inBg,
    "--sk-client-border": p.inBorder,
    "--sk-client-text": p.inText,
    "--sk-admin-bg": p.outBg,
    "--sk-admin-border": p.outBorder,
    "--sk-outgoing-text": p.outText,
    // System note
    "--sk-system-bg": p.sysBg,
    "--sk-system-border": p.sysBorder,
    "--sk-system-text": p.sysText,
    // Composer
    "--sk-composer-bg": p.composerBg,
    "--sk-composer-border": p.composerBorder,
    "--sk-input-bg": p.inputBg,
    "--sk-input-border": p.inputBorder,
    "--sk-placeholder": p.placeholder,
    "--sk-focus-border": p.focusBorder,
    "--sk-focus-ring": p.focusRing,
    "--sk-send-bg": `linear-gradient(135deg, ${p.sendFrom}, ${p.sendTo})`,
    "--sk-send-shadow": `0 4px 14px ${hexA(p.sendFrom, 0.35)}`,
    "--sk-send-hover": `0 6px 18px ${hexA(p.sendFrom, 0.48)}`,
    // States + chrome
    "--sk-link": p.link,
    "--sk-accent": p.brandFrom,
    "--sk-accent-strong": p.brandTo,
    "--sk-icon": p.icon,
    "--sk-divider": p.divider,
    "--sk-hover-bg": p.hoverBg,
    "--sk-selected-bg": p.selectedBg,
    "--sk-selected-text": p.selectedText,
    "--sk-typing-dot": p.typingDot,
    "--sk-unread": p.unread,
    "--sk-secondary-bg": p.secondaryBg,
    "--sk-secondary-border": p.secondaryBorder,
    "--sk-secondary-text": p.secondaryText,
    "--sk-secondary-bg-hover": p.secondaryBgHover,
    "--sk-status-open": p.statusOpen,
    "--sk-status-closed": p.statusClosed,
    "--sk-scroll-thumb": p.scrollThumb,
    // Avatar mask ring
    "--sk-mask-ring": hexA(p.brandTo, 0.5),
    "--sk-mask-glow": `0 0 0 3px ${hexA(p.brandTo, 0.12)}, 0 0 14px ${hexA(p.brandTo, 0.24)}`,
    // Tooltip
    "--sk-tooltip-border": hexA(p.brandTo, 0.35),
    "--sk-tooltip-bg": p.tooltipBg,
    "--sk-tooltip-text": p.tooltipText,
    // Ghost buttons (Client Login / Home slices)
    "--sk-ghost-border": hexA(p.brandFrom, 0.45),
    "--sk-ghost-bg": hexA(p.brandFrom, 0.08),
    "--sk-ghost-text": p.ghostText,
    // Picker panel
    "--sk-picker-bg": p.pickerBg,
    "--sk-picker-border": p.cardBorder,
    "--sk-picker-shadow": `0 18px 48px ${hexA(p.shadowColor, p.dark ? 0.6 : 0.25)}`,
  };
}

/**
 * THE 10 PRODUCTION SKINS (ids/names/order preserved).
 * Order defines the picker gallery order; the first entry is the default.
 * Each palette below is a complete coordinated combination designed against
 * the reference art direction (deep-navy stage, electric-blue gradients,
 * duotone accents) adapted to this platform's Websmith branding.
 */
export const CHAT_SKINS: ChatSkin[] = [
  {
    id: "websmith-classic",
    name: "Websmith Classic",
    description: "The signature Websmith blue — the production look.",
    dark: false,
    vars: defineSkin({
      dark: false,
      backdrop: "var(--bg-primary)",
      centerBg: "var(--bg-primary)",
      surface: "var(--bg-primary)",
      cardBorder: "rgba(20, 156, 234, 0.35)",
      shadowColor: "#0b2b40",
      glowColor: "#149CEA",
      headerBg:
        "linear-gradient(135deg, rgba(20, 156, 234, 0.16), rgba(20, 122, 234, 0.05) 55%, rgba(20, 156, 234, 0.10))",
      headerBorder: "rgba(20, 156, 234, 0.25)",
      brandFrom: "#149CEA",
      brandTo: "#1479EA",
      title: "var(--text-primary)",
      subtitle: "var(--text-secondary)",
      muted: "var(--text-muted)",
      sender: "#0f7fd0",
      text: "var(--text-primary)",
      bodyBg:
        "radial-gradient(1100px 480px at 50% -12%, rgba(20, 156, 234, 0.12), transparent 62%), var(--bg-secondary)",
      inBg: "rgba(20, 156, 234, 0.06)",
      inBorder: "rgba(20, 156, 234, 0.28)",
      inText: "var(--text-primary)",
      outBg: "linear-gradient(135deg, rgba(20, 156, 234, 0.16), rgba(20, 122, 234, 0.08))",
      outBorder: "rgba(20, 156, 234, 0.38)",
      outText: "var(--text-primary)",
      sysBg: "rgba(20, 156, 234, 0.04)",
      sysBorder: "rgba(20, 156, 234, 0.35)",
      sysText: "var(--text-secondary)",
      composerBg: "linear-gradient(180deg, rgba(20, 156, 234, 0.03), var(--bg-primary))",
      composerBorder: "rgba(20, 156, 234, 0.18)",
      inputBg: "var(--bg-secondary)",
      inputBorder: "rgba(20, 156, 234, 0.25)",
      placeholder: "var(--text-muted)",
      focusBorder: "rgba(20, 156, 234, 0.65)",
      focusRing: "0 0 0 3px rgba(20, 156, 234, 0.16)",
      sendFrom: "#149CEA",
      sendTo: "#1479EA",
      link: "#0f7fd0",
      icon: "#149CEA",
      divider: "rgba(20, 156, 234, 0.16)",
      hoverBg: "rgba(20, 156, 234, 0.08)",
      selectedBg: "rgba(20, 156, 234, 0.14)",
      selectedText: "#0b6fc4",
      typingDot: "#149CEA",
      unread: "#e93d3d",
      secondaryBg: "var(--bg-secondary)",
      secondaryBorder: "rgba(20, 156, 234, 0.28)",
      secondaryText: "#0f7fd0",
      secondaryBgHover: "rgba(20, 156, 234, 0.10)",
      statusOpen: "#34c759",
      statusClosed: "#ff3b30",
      scrollThumb: "rgba(20, 156, 234, 0.30)",
      tooltipBg: "rgba(12, 18, 28, 0.97)",
      tooltipText: "#ffffff",
      ghostText: "#007AFF",
      pickerBg: "var(--bg-primary)",
      pickerShadow: "#0b2b40",
    }),
  },
  {
    // Reference: "black tech and social.png" — black/charcoal stage, metallic
    // gold orbits, WSD teal mark (#005B96 -> #00A8C6).
    id: "midnight-gold",
    name: "Midnight Gold",
    description: "Black stage with metallic-gold orbits and the WSD teal mark.",
    dark: true,
    vars: defineSkin({
      dark: true,
      backdrop:
        "radial-gradient(1200px 600px at 50% -10%, rgba(255, 215, 0, 0.07), transparent 60%), #060606",
      centerBg: "#0B0B0C",
      surface: "#101010",
      cardBorder: "rgba(255, 215, 0, 0.38)",
      shadowColor: "#000000",
      glowColor: "#FFD700",
      headerBg:
        "linear-gradient(135deg, rgba(255, 215, 0, 0.14), rgba(0, 91, 150, 0.12) 55%, rgba(255, 215, 0, 0.06))",
      headerBorder: "rgba(255, 215, 0, 0.30)",
      brandFrom: "#005B96",
      brandTo: "#00A8C6",
      title: "#F5EFDC",
      subtitle: "#B8AC86",
      muted: "#8F866A",
      sender: "#FFD700",
      text: "#F1EAD2",
      bodyBg:
        "radial-gradient(1100px 480px at 50% -12%, rgba(255, 215, 0, 0.08), transparent 62%), #141210",
      inBg: "rgba(255, 215, 0, 0.07)",
      inBorder: "rgba(255, 215, 0, 0.30)",
      inText: "#F1EAD2",
      outBg: "linear-gradient(135deg, rgba(0, 168, 198, 0.22), rgba(0, 91, 150, 0.12))",
      outBorder: "rgba(0, 168, 198, 0.45)",
      outText: "#EAF7FA",
      sysBg: "rgba(255, 215, 0, 0.05)",
      sysBorder: "rgba(255, 215, 0, 0.32)",
      sysText: "#B8AC86",
      composerBg: "linear-gradient(180deg, rgba(255, 215, 0, 0.04), #101010)",
      composerBorder: "rgba(255, 215, 0, 0.22)",
      inputBg: "#181613",
      inputBorder: "rgba(255, 215, 0, 0.26)",
      placeholder: "#8F866A",
      focusBorder: "rgba(255, 215, 0, 0.70)",
      focusRing: "0 0 0 3px rgba(255, 215, 0, 0.15)",
      sendFrom: "#FFD700",
      sendTo: "#B8860B",
      link: "#FFD700",
      icon: "#FFD700",
      divider: "rgba(255, 215, 0, 0.16)",
      hoverBg: "rgba(255, 215, 0, 0.08)",
      selectedBg: "rgba(255, 215, 0, 0.14)",
      selectedText: "#FFD700",
      typingDot: "#FFD700",
      unread: "#00A8C6",
      secondaryBg: "#181613",
      secondaryBorder: "rgba(255, 215, 0, 0.30)",
      secondaryText: "#FFD700",
      secondaryBgHover: "rgba(255, 215, 0, 0.10)",
      statusOpen: "#34c759",
      statusClosed: "#ff453a",
      scrollThumb: "rgba(255, 215, 0, 0.30)",
      tooltipBg: "rgba(10, 10, 8, 0.97)",
      tooltipText: "#F5EFDC",
      ghostText: "#FFD700",
      pickerBg: "#151310",
      pickerShadow: "#000000",
    }),
  },
  {
    // Reference: "blue tech and social.png" — deep-blue window (#2C3E50),
    // lighter blue header/composer, warm orange gear/globe glow (#F39C12).
    id: "ocean-tech",
    name: "Ocean Tech",
    description: "Deep-ocean window with glowing orange tech accents.",
    dark: true,
    vars: defineSkin({
      dark: true,
      backdrop: "linear-gradient(180deg, #34495E, #2C3E50)",
      centerBg: "#2C3E50",
      surface: "#2C3E50",
      cardBorder: "rgba(52, 152, 219, 0.45)",
      shadowColor: "#000000",
      glowColor: "#3498DB",
      headerBg: "linear-gradient(135deg, #3498DB, #2980B9)",
      headerBorder: "rgba(52, 152, 219, 0.55)",
      brandFrom: "#F39C12",
      brandTo: "#E67E22",
      title: "#FFFFFF",
      subtitle: "rgba(236, 240, 241, 0.78)",
      muted: "rgba(236, 240, 241, 0.55)",
      sender: "#F8C471",
      text: "#ECF0F1",
      bodyBg:
        "radial-gradient(1100px 480px at 50% -12%, rgba(243, 156, 18, 0.08), transparent 62%), #273747",
      inBg: "rgba(149, 165, 166, 0.16)",
      inBorder: "rgba(149, 165, 166, 0.40)",
      inText: "#ECF0F1",
      outBg: "linear-gradient(135deg, rgba(231, 76, 60, 0.28), rgba(192, 57, 43, 0.16))",
      outBorder: "rgba(231, 76, 60, 0.50)",
      outText: "#FFF0ED",
      sysBg: "rgba(243, 156, 18, 0.06)",
      sysBorder: "rgba(243, 156, 18, 0.35)",
      sysText: "rgba(236, 240, 241, 0.78)",
      composerBg: "linear-gradient(180deg, rgba(41, 128, 185, 0.25), #2C3E50)",
      composerBorder: "rgba(52, 152, 219, 0.40)",
      inputBg: "#34495E",
      inputBorder: "rgba(52, 152, 219, 0.45)",
      placeholder: "rgba(236, 240, 241, 0.55)",
      focusBorder: "rgba(243, 156, 18, 0.75)",
      focusRing: "0 0 0 3px rgba(243, 156, 18, 0.18)",
      sendFrom: "#F39C12",
      sendTo: "#E67E22",
      link: "#F8C471",
      icon: "#F8C471",
      divider: "rgba(52, 152, 219, 0.25)",
      hoverBg: "rgba(52, 152, 219, 0.14)",
      selectedBg: "rgba(243, 156, 18, 0.16)",
      selectedText: "#F8C471",
      typingDot: "#F39C12",
      unread: "#F39C12",
      secondaryBg: "#34495E",
      secondaryBorder: "rgba(52, 152, 219, 0.45)",
      secondaryText: "#F8C471",
      secondaryBgHover: "rgba(52, 152, 219, 0.18)",
      statusOpen: "#2ecc71",
      statusClosed: "#e74c3c",
      scrollThumb: "rgba(52, 152, 219, 0.35)",
      tooltipBg: "rgba(15, 26, 36, 0.97)",
      tooltipText: "#ECF0F1",
      ghostText: "#F8C471",
      pickerBg: "#273747",
      pickerShadow: "#000000",
    }),
  },
  {
    // Reference: "Green tech and social.png" — light sage stage (#E0F3D3),
    // forest-green identity (#2E7D59), ocean-blue mic/accent (#40C4DD),
    // white bubbles with forest outlines.
    id: "emerald-sage",
    name: "Emerald Sage",
    description: "Sage-green garden with forest identity and ocean-blue pops.",
    dark: false,
    vars: defineSkin({
      dark: false,
      backdrop: "linear-gradient(180deg, #EAF6E0, #E0F3D3)",
      centerBg: "#EAF3DF",
      surface: "#FBFDF8",
      cardBorder: "rgba(46, 125, 89, 0.35)",
      shadowColor: "#1F5C43",
      glowColor: "#2E7D59",
      headerBg:
        "linear-gradient(135deg, rgba(46, 125, 89, 0.16), rgba(64, 196, 221, 0.06) 55%, rgba(46, 125, 89, 0.08))",
      headerBorder: "rgba(46, 125, 89, 0.28)",
      brandFrom: "#2E7D59",
      brandTo: "#40C4DD",
      title: "#1F5C43",
      subtitle: "#6B8F7E",
      muted: "#88A696",
      sender: "#2E7D59",
      text: "#254237",
      bodyBg:
        "radial-gradient(1100px 480px at 50% -12%, rgba(46, 125, 89, 0.10), transparent 62%), #EFF7E9",
      inBg: "#FFFFFF",
      inBorder: "rgba(46, 125, 89, 0.35)",
      inText: "#254237",
      outBg: "linear-gradient(135deg, rgba(64, 196, 221, 0.20), rgba(46, 125, 89, 0.12))",
      outBorder: "rgba(46, 125, 89, 0.45)",
      outText: "#1F4A3C",
      sysBg: "rgba(46, 125, 89, 0.05)",
      sysBorder: "rgba(46, 125, 89, 0.32)",
      sysText: "#6B8F7E",
      composerBg: "linear-gradient(180deg, rgba(46, 125, 89, 0.05), #FBFDF8)",
      composerBorder: "rgba(46, 125, 89, 0.22)",
      inputBg: "#FFFFFF",
      inputBorder: "rgba(46, 125, 89, 0.30)",
      placeholder: "#88A696",
      focusBorder: "rgba(64, 196, 221, 0.80)",
      focusRing: "0 0 0 3px rgba(64, 196, 221, 0.18)",
      sendFrom: "#2E7D59",
      sendTo: "#40C4DD",
      link: "#1F7E93",
      icon: "#2E7D59",
      divider: "rgba(46, 125, 89, 0.16)",
      hoverBg: "rgba(46, 125, 89, 0.08)",
      selectedBg: "rgba(46, 125, 89, 0.14)",
      selectedText: "#1F5C43",
      typingDot: "#2E7D59",
      unread: "#E0483C",
      secondaryBg: "#FFFFFF",
      secondaryBorder: "rgba(46, 125, 89, 0.30)",
      secondaryText: "#1F5C43",
      secondaryBgHover: "rgba(46, 125, 89, 0.08)",
      statusOpen: "#34c759",
      statusClosed: "#ff3b30",
      scrollThumb: "rgba(46, 125, 89, 0.30)",
      tooltipBg: "rgba(16, 42, 32, 0.96)",
      tooltipText: "#EFF7E9",
      ghostText: "#1F5C43",
      pickerBg: "#FBFDF8",
      pickerShadow: "#1F5C43",
    }),
  },
  {
    // Reference: "tech and social.png" — dark navy stage (#1a202c), slate
    // inputs (#374151), electric-cyan circuit lines (#00f3ff) with lime sparks.
    id: "circuit-navy",
    name: "Circuit Navy",
    description: "Navy circuit board alive with electric-cyan traces.",
    dark: true,
    vars: defineSkin({
      dark: true,
      backdrop:
        "radial-gradient(1200px 600px at 50% -10%, rgba(0, 243, 255, 0.08), transparent 60%), #12161D",
      centerBg: "#151A23",
      surface: "#1A202C",
      cardBorder: "rgba(0, 243, 255, 0.35)",
      shadowColor: "#000000",
      glowColor: "#00F3FF",
      headerBg:
        "linear-gradient(135deg, rgba(0, 243, 255, 0.14), rgba(55, 65, 81, 0.35) 55%, rgba(0, 243, 255, 0.07))",
      headerBorder: "rgba(0, 243, 255, 0.30)",
      brandFrom: "#00F3FF",
      brandTo: "#00FF9D",
      title: "#E6FBFF",
      subtitle: "#8FA3B8",
      muted: "#64748B",
      sender: "#00F3FF",
      text: "#E2E8F0",
      bodyBg:
        "radial-gradient(1100px 480px at 50% -12%, rgba(0, 243, 255, 0.09), transparent 62%), #202836",
      inBg: "rgba(0, 243, 255, 0.07)",
      inBorder: "rgba(0, 243, 255, 0.30)",
      inText: "#E2E8F0",
      outBg: "linear-gradient(135deg, rgba(0, 255, 157, 0.16), rgba(0, 243, 255, 0.08))",
      outBorder: "rgba(0, 255, 157, 0.40)",
      outText: "#E4FFF2",
      sysBg: "rgba(0, 243, 255, 0.05)",
      sysBorder: "rgba(0, 243, 255, 0.32)",
      sysText: "#8FA3B8",
      composerBg: "linear-gradient(180deg, rgba(0, 243, 255, 0.04), #1A202C)",
      composerBorder: "rgba(0, 243, 255, 0.22)",
      inputBg: "#374151",
      inputBorder: "rgba(0, 243, 255, 0.30)",
      placeholder: "#8FA3B8",
      focusBorder: "rgba(0, 243, 255, 0.70)",
      focusRing: "0 0 0 3px rgba(0, 243, 255, 0.15)",
      sendFrom: "#00F3FF",
      sendTo: "#0090FF",
      link: "#00F3FF",
      icon: "#00F3FF",
      divider: "rgba(0, 243, 255, 0.16)",
      hoverBg: "rgba(0, 243, 255, 0.08)",
      selectedBg: "rgba(0, 243, 255, 0.14)",
      selectedText: "#00F3FF",
      typingDot: "#00F3FF",
      unread: "#00FF9D",
      secondaryBg: "#374151",
      secondaryBorder: "rgba(0, 243, 255, 0.35)",
      secondaryText: "#00F3FF",
      secondaryBgHover: "rgba(0, 243, 255, 0.10)",
      statusOpen: "#00FF9D",
      statusClosed: "#ff5b52",
      scrollThumb: "rgba(0, 243, 255, 0.32)",
      tooltipBg: "rgba(8, 14, 20, 0.97)",
      tooltipText: "#E6FBFF",
      ghostText: "#00F3FF",
      pickerBg: "#202836",
      pickerShadow: "#000000",
    }),
  },
  {
    // Reference: "white tech and social.png" — clean white stage, teal sphere
    // emblem (#00B896 core / #25A4A6 ring), soft wave lines.
    id: "arctic-white",
    name: "Arctic White",
    description: "Clean white stage with the teal Websmith sphere.",
    dark: false,
    vars: defineSkin({
      dark: false,
      backdrop: "linear-gradient(180deg, #FDFEFE, #F0F9F9)",
      centerBg: "#F5FAFA",
      surface: "#FFFFFF",
      cardBorder: "rgba(37, 164, 166, 0.35)",
      shadowColor: "#175E63",
      glowColor: "#00B896",
      headerBg:
        "linear-gradient(135deg, rgba(0, 184, 150, 0.14), rgba(37, 164, 166, 0.05) 60%, rgba(0, 184, 150, 0.07))",
      headerBorder: "rgba(37, 164, 166, 0.28)",
      brandFrom: "#00B896",
      brandTo: "#25A4A6",
      title: "#175E63",
      subtitle: "#6E9295",
      muted: "#8AA8AB",
      sender: "#00A88F",
      text: "#1F3A3D",
      bodyBg:
        "radial-gradient(1100px 480px at 50% -12%, rgba(0, 184, 150, 0.08), transparent 62%), #F7FCFC",
      inBg: "#FFFFFF",
      inBorder: "rgba(37, 164, 166, 0.35)",
      inText: "#1F3A3D",
      outBg: "linear-gradient(135deg, rgba(0, 184, 150, 0.16), rgba(37, 164, 166, 0.08))",
      outBorder: "rgba(37, 164, 166, 0.45)",
      outText: "#134E51",
      sysBg: "rgba(0, 184, 150, 0.05)",
      sysBorder: "rgba(37, 164, 166, 0.32)",
      sysText: "#6E9295",
      composerBg: "linear-gradient(180deg, rgba(0, 184, 150, 0.04), #FFFFFF)",
      composerBorder: "rgba(37, 164, 166, 0.22)",
      inputBg: "#F7FCFC",
      inputBorder: "rgba(37, 164, 166, 0.30)",
      placeholder: "#8AA8AB",
      focusBorder: "rgba(0, 184, 150, 0.75)",
      focusRing: "0 0 0 3px rgba(0, 184, 150, 0.16)",
      sendFrom: "#00B896",
      sendTo: "#25A4A6",
      link: "#0E8C86",
      icon: "#00A88F",
      divider: "rgba(37, 164, 166, 0.16)",
      hoverBg: "rgba(0, 184, 150, 0.08)",
      selectedBg: "rgba(0, 184, 150, 0.14)",
      selectedText: "#175E63",
      typingDot: "#00B896",
      unread: "#E0483C",
      secondaryBg: "#FFFFFF",
      secondaryBorder: "rgba(37, 164, 166, 0.30)",
      secondaryText: "#175E63",
      secondaryBgHover: "rgba(0, 184, 150, 0.08)",
      statusOpen: "#34c759",
      statusClosed: "#ff3b30",
      scrollThumb: "rgba(37, 164, 166, 0.30)",
      tooltipBg: "rgba(9, 44, 46, 0.96)",
      tooltipText: "#F7FCFC",
      ghostText: "#175E63",
      pickerBg: "#FFFFFF",
      pickerShadow: "#175E63",
    }),
  },
  {
    // Primary mockup, tile 5 — calm aqua-to-light vertical gradient stage with
    // airy white bubbles.
    id: "aqua-mist",
    name: "Aqua Mist",
    description: "Calm aqua-to-light gradient with airy bubbles.",
    dark: false,
    vars: defineSkin({
      dark: false,
      backdrop: "linear-gradient(180deg, #E3F6FD 0%, #C9ECF9 55%, #BFE9F6 100%)",
      centerBg: "#DCF3FB",
      surface: "#FFFFFF",
      cardBorder: "rgba(14, 127, 166, 0.35)",
      shadowColor: "#0E4A5E",
      glowColor: "#0EA5C9",
      headerBg:
        "linear-gradient(135deg, rgba(14, 165, 201, 0.16), rgba(14, 127, 166, 0.05) 60%, rgba(14, 165, 201, 0.08))",
      headerBorder: "rgba(14, 127, 166, 0.28)",
      brandFrom: "#0EA5C9",
      brandTo: "#0B7FA6",
      title: "#0E4A5E",
      subtitle: "#5E8A99",
      muted: "#7FA5B2",
      sender: "#0B7FA6",
      text: "#123B49",
      bodyBg:
        "radial-gradient(1100px 480px at 50% -12%, rgba(14, 165, 201, 0.10), transparent 62%), #F2FAFD",
      inBg: "#FFFFFF",
      inBorder: "rgba(14, 127, 166, 0.35)",
      inText: "#123B49",
      outBg: "linear-gradient(135deg, rgba(14, 165, 201, 0.18), rgba(11, 127, 166, 0.10))",
      outBorder: "rgba(14, 127, 166, 0.45)",
      outText: "#0E3F50",
      sysBg: "rgba(14, 165, 201, 0.05)",
      sysBorder: "rgba(14, 127, 166, 0.32)",
      sysText: "#5E8A99",
      composerBg: "linear-gradient(180deg, rgba(14, 165, 201, 0.04), #FFFFFF)",
      composerBorder: "rgba(14, 127, 166, 0.22)",
      inputBg: "#F2FAFD",
      inputBorder: "rgba(14, 127, 166, 0.30)",
      placeholder: "#7FA5B2",
      focusBorder: "rgba(14, 165, 201, 0.75)",
      focusRing: "0 0 0 3px rgba(14, 165, 201, 0.16)",
      sendFrom: "#0EA5C9",
      sendTo: "#0B7FA6",
      link: "#0B7FA6",
      icon: "#0EA5C9",
      divider: "rgba(14, 127, 166, 0.16)",
      hoverBg: "rgba(14, 165, 201, 0.08)",
      selectedBg: "rgba(14, 165, 201, 0.14)",
      selectedText: "#0E4A5E",
      typingDot: "#0EA5C9",
      unread: "#E0483C",
      secondaryBg: "#FFFFFF",
      secondaryBorder: "rgba(14, 127, 166, 0.30)",
      secondaryText: "#0E4A5E",
      secondaryBgHover: "rgba(14, 165, 201, 0.08)",
      statusOpen: "#34c759",
      statusClosed: "#ff3b30",
      scrollThumb: "rgba(14, 127, 166, 0.30)",
      tooltipBg: "rgba(7, 42, 54, 0.96)",
      tooltipText: "#F2FAFD",
      ghostText: "#0B7FA6",
      pickerBg: "#FFFFFF",
      pickerShadow: "#0E4A5E",
    }),
  },
  {
    // Primary mockup, tile 3 — pink/blue pattern energy condensed into a
    // rose->azure duotone identity.
    id: "sunset-duo",
    name: "Sunset Duo",
    description: "Rose-to-azure duotone energy from the pattern tile.",
    dark: false,
    vars: defineSkin({
      dark: false,
      backdrop: "linear-gradient(160deg, #FDE7F0 0%, #E7E9FD 100%)",
      centerBg: "#F3EBF5",
      surface: "#FFFFFF",
      cardBorder: "rgba(233, 84, 140, 0.30)",
      shadowColor: "#5D1E3C",
      glowColor: "#E9548C",
      headerBg:
        "linear-gradient(120deg, rgba(233, 84, 140, 0.18), rgba(52, 120, 246, 0.10) 70%, rgba(233, 84, 140, 0.08))",
      headerBorder: "rgba(233, 84, 140, 0.28)",
      brandFrom: "#E9548C",
      brandTo: "#3478F6",
      title: "#5D1E3C",
      subtitle: "#96718A",
      muted: "#AD8CA1",
      sender: "#D6447E",
      text: "#3D2036",
      bodyBg:
        "radial-gradient(1100px 480px at 50% -12%, rgba(233, 84, 140, 0.10), transparent 62%), #FBF5F9",
      inBg: "#FFFFFF",
      inBorder: "rgba(233, 84, 140, 0.35)",
      inText: "#3D2036",
      outBg: "linear-gradient(135deg, rgba(52, 120, 246, 0.16), rgba(233, 84, 140, 0.10))",
      outBorder: "rgba(52, 120, 246, 0.45)",
      outText: "#27356B",
      sysBg: "rgba(233, 84, 140, 0.05)",
      sysBorder: "rgba(233, 84, 140, 0.32)",
      sysText: "#96718A",
      composerBg: "linear-gradient(180deg, rgba(233, 84, 140, 0.04), #FFFFFF)",
      composerBorder: "rgba(233, 84, 140, 0.22)",
      inputBg: "#FBF5F9",
      inputBorder: "rgba(233, 84, 140, 0.30)",
      placeholder: "#AD8CA1",
      focusBorder: "rgba(52, 120, 246, 0.65)",
      focusRing: "0 0 0 3px rgba(52, 120, 246, 0.16)",
      sendFrom: "#E9548C",
      sendTo: "#3478F6",
      link: "#C13A72",
      icon: "#D6447E",
      divider: "rgba(233, 84, 140, 0.16)",
      hoverBg: "rgba(233, 84, 140, 0.08)",
      selectedBg: "rgba(233, 84, 140, 0.14)",
      selectedText: "#C13A72",
      typingDot: "#E9548C",
      unread: "#3478F6",
      secondaryBg: "#FFFFFF",
      secondaryBorder: "rgba(233, 84, 140, 0.30)",
      secondaryText: "#C13A72",
      secondaryBgHover: "rgba(233, 84, 140, 0.08)",
      statusOpen: "#34c759",
      statusClosed: "#ff3b30",
      scrollThumb: "rgba(233, 84, 140, 0.30)",
      tooltipBg: "rgba(48, 15, 31, 0.96)",
      tooltipText: "#FBF5F9",
      ghostText: "#C13A72",
      pickerBg: "#FFFFFF",
      pickerShadow: "#5D1E3C",
    }),
  },
  {
    // Brand-language extension in the royal-violet family — regal
    // indigo/violet identity with an electric-blue companion (reference
    // duotone energy adapted to violet).
    id: "royal-violet",
    name: "Royal Violet",
    description: "Regal violet-indigo take on the Websmith language.",
    dark: false,
    vars: defineSkin({
      dark: false,
      backdrop: "linear-gradient(180deg, #F3F1FD, #EBE8FB)",
      centerBg: "#EEEBFA",
      surface: "#FFFFFF",
      cardBorder: "rgba(123, 79, 242, 0.32)",
      shadowColor: "#3A2282",
      glowColor: "#7B4FF2",
      headerBg:
        "linear-gradient(135deg, rgba(123, 79, 242, 0.16), rgba(92, 99, 232, 0.06) 60%, rgba(123, 79, 242, 0.08))",
      headerBorder: "rgba(123, 79, 242, 0.28)",
      brandFrom: "#7B4FF2",
      brandTo: "#5C63E8",
      title: "#3A2282",
      subtitle: "#8179AE",
      muted: "#9C93C4",
      sender: "#6B3FE0",
      text: "#2C2054",
      bodyBg:
        "radial-gradient(1100px 480px at 50% -12%, rgba(123, 79, 242, 0.10), transparent 62%), #F7F5FE",
      inBg: "#FFFFFF",
      inBorder: "rgba(123, 79, 242, 0.35)",
      inText: "#2C2054",
      outBg: "linear-gradient(135deg, rgba(123, 79, 242, 0.18), rgba(92, 99, 232, 0.10))",
      outBorder: "rgba(123, 79, 242, 0.45)",
      outText: "#33246E",
      sysBg: "rgba(123, 79, 242, 0.05)",
      sysBorder: "rgba(123, 79, 242, 0.32)",
      sysText: "#8179AE",
      composerBg: "linear-gradient(180deg, rgba(123, 79, 242, 0.04), #FFFFFF)",
      composerBorder: "rgba(123, 79, 242, 0.22)",
      inputBg: "#F7F5FE",
      inputBorder: "rgba(123, 79, 242, 0.30)",
      placeholder: "#9C93C4",
      focusBorder: "rgba(123, 79, 242, 0.70)",
      focusRing: "0 0 0 3px rgba(123, 79, 242, 0.16)",
      sendFrom: "#7B4FF2",
      sendTo: "#5C63E8",
      link: "#5B34C4",
      icon: "#6B3FE0",
      divider: "rgba(123, 79, 242, 0.16)",
      hoverBg: "rgba(123, 79, 242, 0.08)",
      selectedBg: "rgba(123, 79, 242, 0.14)",
      selectedText: "#5B34C4",
      typingDot: "#7B4FF2",
      unread: "#E9548C",
      secondaryBg: "#FFFFFF",
      secondaryBorder: "rgba(123, 79, 242, 0.30)",
      secondaryText: "#5B34C4",
      secondaryBgHover: "rgba(123, 79, 242, 0.08)",
      statusOpen: "#34c759",
      statusClosed: "#ff3b30",
      scrollThumb: "rgba(123, 79, 242, 0.30)",
      tooltipBg: "rgba(28, 17, 66, 0.96)",
      tooltipText: "#F7F5FE",
      ghostText: "#5B34C4",
      pickerBg: "#FFFFFF",
      pickerShadow: "#3A2282",
    }),
  },
  {
    // Warm-dark extension echoing the ember/red contrast notes found in the
    // reference set — charcoal stage with molten-orange forge light.
    id: "graphite-forge",
    name: "Graphite Forge",
    description: "Charcoal workshop lit by molten-orange forge light.",
    dark: true,
    vars: defineSkin({
      dark: true,
      backdrop:
        "radial-gradient(1200px 600px at 50% -10%, rgba(255, 122, 26, 0.08), transparent 60%), #131417",
      centerBg: "#17181C",
      surface: "#1D2126",
      cardBorder: "rgba(255, 122, 26, 0.35)",
      shadowColor: "#000000",
      glowColor: "#FF7A1A",
      headerBg:
        "linear-gradient(135deg, rgba(255, 122, 26, 0.14), rgba(148, 163, 184, 0.08) 55%, rgba(255, 122, 26, 0.06))",
      headerBorder: "rgba(255, 122, 26, 0.30)",
      brandFrom: "#FF7A1A",
      brandTo: "#E85D04",
      title: "#FFF4EA",
      subtitle: "#A8B0BC",
      muted: "#6E7681",
      sender: "#FFA45C",
      text: "#EDEAE6",
      bodyBg:
        "radial-gradient(1100px 480px at 50% -12%, rgba(255, 122, 26, 0.08), transparent 62%), #23282F",
      inBg: "rgba(148, 163, 184, 0.12)",
      inBorder: "rgba(148, 163, 184, 0.35)",
      inText: "#EDEAE6",
      outBg: "linear-gradient(135deg, rgba(255, 122, 26, 0.20), rgba(232, 93, 4, 0.10))",
      outBorder: "rgba(255, 122, 26, 0.45)",
      outText: "#FFF0E4",
      sysBg: "rgba(255, 122, 26, 0.05)",
      sysBorder: "rgba(255, 122, 26, 0.32)",
      sysText: "#A8B0BC",
      composerBg: "linear-gradient(180deg, rgba(255, 122, 26, 0.04), #1D2126)",
      composerBorder: "rgba(255, 122, 26, 0.22)",
      inputBg: "#2A3038",
      inputBorder: "rgba(255, 122, 26, 0.28)",
      placeholder: "#6E7681",
      focusBorder: "rgba(255, 122, 26, 0.70)",
      focusRing: "0 0 0 3px rgba(255, 122, 26, 0.15)",
      sendFrom: "#FF7A1A",
      sendTo: "#E85D04",
      link: "#FFA45C",
      icon: "#FFA45C",
      divider: "rgba(255, 122, 26, 0.16)",
      hoverBg: "rgba(255, 122, 26, 0.08)",
      selectedBg: "rgba(255, 122, 26, 0.14)",
      selectedText: "#FFA45C",
      typingDot: "#FF7A1A",
      unread: "#FF7A1A",
      secondaryBg: "#2A3038",
      secondaryBorder: "rgba(255, 122, 26, 0.32)",
      secondaryText: "#FFA45C",
      secondaryBgHover: "rgba(255, 122, 26, 0.10)",
      statusOpen: "#2ecc71",
      statusClosed: "#ff5b52",
      scrollThumb: "rgba(255, 122, 26, 0.30)",
      tooltipBg: "rgba(12, 13, 16, 0.97)",
      tooltipText: "#FFF4EA",
      ghostText: "#FFA45C",
      pickerBg: "#23282F",
      pickerShadow: "#000000",
    }),
  },
];

export const DEFAULT_SKIN_ID = CHAT_SKINS[0].id;

/** Resolve a skin by id, falling back to the default when unknown. */
export function getChatSkin(id: string | null | undefined): ChatSkin {
  return CHAT_SKINS.find((skin) => skin.id === id) ?? CHAT_SKINS[0];
}

/** localStorage key persisting the visitor's chosen skin. */
export const SKIN_STORAGE_KEY = "ws_chat_skin_id";

/** Read the persisted skin id (client only; never throws). */
export function readStoredSkinId(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(SKIN_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

/** Persist the chosen skin id (best effort; private-mode safe). */
export function storeSkinId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SKIN_STORAGE_KEY, id);
  } catch {
    // Storage unavailable (private mode / disabled) — selection stays session-only.
  }
}
