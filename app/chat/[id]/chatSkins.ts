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
//          SKIN COMPATIBILITY RULE (R01 visual-system fix): every skin is a
//          COMPLETE, SELF-CONTAINED color system. Every value below is a
//          CONCRETE color — skins NEVER reference global page variables
//          (`var(--bg-primary)`, `var(--text-primary)`, …), so an unrelated
//          host theme can never leak into (or break the contrast of) a skin.
//          Each skin owns compatible values for: the unified window background
//          (`--sk-backdrop`, ONE flat color across left+center+right — never a
//          gradient), center background (identical to the window), header,
//          card surface, borders, primary/secondary/muted text, buttons
//          (bg/text/border/hover), inputs (bg/text/border/placeholder),
//          incoming + outgoing message bubbles (bg/border/text), accent, and
//          the online/status colors. Light skins pair light surfaces with dark
//          text; dark skins pair dark surfaces with light text — a light-on-
//          light or dark-on-dark combination is impossible by construction
//          because every role is explicit and required (compile error when a
//          skin forgets one).
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
 * One compact palette per skin — EVERY visual role of the messenger. Fields
 * are required so TypeScript guarantees each skin defines ALL roles with
 * mutually compatible values (a missing role would be a compile error, never
 * a runtime contrast surprise).
 */
interface SkinPalette {
  dark: boolean;
  /** THE unified chat-window background — ONE flat color for left+center+right. */
  windowBg: string;
  /** Center zone base; always identical to windowBg (one continuous surface). */
  centerBg: string;
  /** Messenger card surface. */
  surface: string;
  cardBorder: string;
  /** Base hue for the soft card shadow. */
  shadowColor: string;
  /** Header band background (flat solid). */
  headerBg: string;
  headerBorder: string;
  accent: string;
  accentStrong: string;
  title: string;
  subtitle: string;
  muted: string;
  sender: string;
  /** Primary readable body/input text. */
  text: string;
  /** Message thread area background (flat). */
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
  inputText: string;
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
  /** Header nav / ghost buttons (Client Login, Home, error-screen action). */
  btnBg: string;
  btnText: string;
  btnBorder: string;
  btnHoverBg: string;
  statusOpen: string;
  statusClosed: string;
  scrollThumb: string;
  tooltipBg: string;
  tooltipText: string;
  pickerBg: string;
  pickerShadow: string;
}

/** Derive the FULL `--sk-*` token set from one palette. */
function defineSkin(p: SkinPalette): Record<string, string> {
  return {
    // Stage — ONE unified window background (left + center + right inherit it).
    "--sk-backdrop": p.windowBg,
    "--sk-center-bg": p.centerBg,
    // Card (de-layered: necessary border + ONE soft shadow, no glow stack).
    "--sk-card-bg": p.surface,
    "--sk-card-border": p.cardBorder,
    "--sk-card-shadow": p.dark
      ? `0 12px 34px ${hexA(p.shadowColor, 0.5)}`
      : `0 6px 22px ${hexA(p.shadowColor, 0.12)}`,
    "--sk-card-glow": "none",
    // Header
    "--sk-header-bg": p.headerBg,
    "--sk-header-border": p.headerBorder,
    // Brand/accent (kept for the picker swatch + Send gradient).
    "--sk-brand-bg": `linear-gradient(135deg, ${p.accent}, ${p.accentStrong})`,
    // Type scale
    "--sk-title": p.title,
    "--sk-subtitle": p.subtitle,
    "--sk-time": p.muted,
    "--sk-muted": p.muted,
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
    "--sk-input-text": p.inputText,
    "--sk-input-border": p.inputBorder,
    "--sk-placeholder": p.placeholder,
    "--sk-focus-border": p.focusBorder,
    "--sk-focus-ring": p.focusRing,
    "--sk-send-bg": `linear-gradient(135deg, ${p.sendFrom}, ${p.sendTo})`,
    "--sk-send-shadow": `0 3px 10px ${hexA(p.sendFrom, 0.30)}`,
    "--sk-send-hover": `0 5px 14px ${hexA(p.sendFrom, 0.42)}`,
    // States + chrome
    "--sk-link": p.link,
    "--sk-accent": p.accent,
    "--sk-accent-strong": p.accentStrong,
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
    "--sk-mask-ring": hexA(p.accentStrong, 0.45),
    "--sk-mask-glow": `0 0 0 3px ${hexA(p.accentStrong, 0.10)}, 0 0 12px ${hexA(p.accentStrong, 0.20)}`,
    // Tooltip
    "--sk-tooltip-border": hexA(p.accentStrong, 0.35),
    "--sk-tooltip-bg": p.tooltipBg,
    "--sk-tooltip-text": p.tooltipText,
    // Header nav / ghost buttons
    "--sk-btn-bg": p.btnBg,
    "--sk-btn-text": p.btnText,
    "--sk-btn-border": p.btnBorder,
    "--sk-btn-hover-bg": p.btnHoverBg,
    // Picker panel
    "--sk-picker-bg": p.pickerBg,
    "--sk-picker-border": p.cardBorder,
    "--sk-picker-shadow": p.dark
      ? `0 16px 40px ${hexA(p.pickerShadow, 0.55)}`
      : `0 12px 32px ${hexA(p.pickerShadow, 0.18)}`,
  };
}

/**
 * THE 10 PRODUCTION SKINS (ids/names/order preserved).
 * Order defines the picker gallery order; the first entry is the default.
 * Every palette is a COMPLETE coordinated combination — light skins use light
 * surfaces + dark text, dark skins use dark surfaces + light text; no role
 * inherits from any host-page variable.
 */
export const CHAT_SKINS: ChatSkin[] = [
  {
    id: "websmith-classic",
    name: "Websmith Classic",
    description: "Clean professional neutral with the Websmith blue.",
    dark: false,
    vars: defineSkin({
      dark: false,
      windowBg: "#F4F5F7",
      centerBg: "#F4F5F7",
      surface: "#FFFFFF",
      cardBorder: "rgba(15, 23, 42, 0.12)",
      shadowColor: "#0F1B2D",
      headerBg: "#FFFFFF",
      headerBorder: "rgba(15, 23, 42, 0.08)",
      accent: "#149CEA",
      accentStrong: "#1479EA",
      title: "#16233A",
      subtitle: "#51607A",
      muted: "#8592A6",
      sender: "#0B72C4",
      text: "#1F2B3E",
      bodyBg: "#FBFCFD",
      inBg: "#FFFFFF",
      inBorder: "rgba(15, 23, 42, 0.14)",
      inText: "#1F2B3E",
      outBg: "#E7F2FC",
      outBorder: "rgba(20, 156, 234, 0.40)",
      outText: "#14304A",
      sysBg: "rgba(20, 156, 234, 0.06)",
      sysBorder: "rgba(20, 156, 234, 0.30)",
      sysText: "#51607A",
      composerBg: "#FFFFFF",
      composerBorder: "rgba(15, 23, 42, 0.08)",
      inputBg: "#F4F6F9",
      inputText: "#1F2B3E",
      inputBorder: "rgba(15, 23, 42, 0.16)",
      placeholder: "#8592A6",
      focusBorder: "rgba(20, 156, 234, 0.65)",
      focusRing: "0 0 0 3px rgba(20, 156, 234, 0.15)",
      sendFrom: "#149CEA",
      sendTo: "#1479EA",
      link: "#0B72C4",
      icon: "#149CEA",
      divider: "rgba(15, 23, 42, 0.08)",
      hoverBg: "rgba(15, 23, 42, 0.05)",
      selectedBg: "rgba(20, 156, 234, 0.12)",
      selectedText: "#0B72C4",
      typingDot: "#149CEA",
      unread: "#E93D3D",
      secondaryBg: "#FFFFFF",
      secondaryBorder: "rgba(15, 23, 42, 0.14)",
      secondaryText: "#27405E",
      secondaryBgHover: "#EFF3F8",
      btnBg: "#FFFFFF",
      btnText: "#27405E",
      btnBorder: "rgba(15, 23, 42, 0.16)",
      btnHoverBg: "#EFF3F8",
      statusOpen: "#22A55A",
      statusClosed: "#E5484D",
      scrollThumb: "rgba(15, 23, 42, 0.22)",
      tooltipBg: "rgba(15, 23, 42, 0.96)",
      tooltipText: "#FFFFFF",
      pickerBg: "#FFFFFF",
      pickerShadow: "#0F1B2D",
    }),
  },
  {
    id: "midnight-gold",
    name: "Midnight Gold",
    description: "Deep black stage with metallic-gold accents.",
    dark: true,
    vars: defineSkin({
      dark: true,
      windowBg: "#0B0B0C",
      centerBg: "#0B0B0C",
      surface: "#131315",
      cardBorder: "rgba(255, 215, 0, 0.25)",
      shadowColor: "#000000",
      headerBg: "#131315",
      headerBorder: "rgba(255, 215, 0, 0.22)",
      accent: "#FFD700",
      accentStrong: "#D4AF37",
      title: "#F5EFDC",
      subtitle: "#C9BD97",
      muted: "#948A6B",
      sender: "#FFD700",
      text: "#F1EAD2",
      bodyBg: "#101010",
      inBg: "rgba(255, 255, 255, 0.06)",
      inBorder: "rgba(255, 215, 0, 0.28)",
      inText: "#F1EAD2",
      outBg: "rgba(0, 168, 198, 0.16)",
      outBorder: "rgba(0, 168, 198, 0.45)",
      outText: "#EAF7FA",
      sysBg: "rgba(255, 215, 0, 0.06)",
      sysBorder: "rgba(255, 215, 0, 0.30)",
      sysText: "#C9BD97",
      composerBg: "#131315",
      composerBorder: "rgba(255, 215, 0, 0.20)",
      inputBg: "#1A1916",
      inputText: "#F1EAD2",
      inputBorder: "rgba(255, 215, 0, 0.30)",
      placeholder: "#948A6B",
      focusBorder: "rgba(255, 215, 0, 0.65)",
      focusRing: "0 0 0 3px rgba(255, 215, 0, 0.14)",
      sendFrom: "#FFD700",
      sendTo: "#D4AF37",
      link: "#FFD700",
      icon: "#FFD700",
      divider: "rgba(255, 215, 0, 0.16)",
      hoverBg: "rgba(255, 215, 0, 0.08)",
      selectedBg: "rgba(255, 215, 0, 0.14)",
      selectedText: "#FFD700",
      typingDot: "#FFD700",
      unread: "#00A8C6",
      secondaryBg: "#1A1916",
      secondaryBorder: "rgba(255, 215, 0, 0.28)",
      secondaryText: "#FFD700",
      secondaryBgHover: "rgba(255, 215, 0, 0.10)",
      btnBg: "#1A1916",
      btnText: "#FFD700",
      btnBorder: "rgba(255, 215, 0, 0.32)",
      btnHoverBg: "rgba(255, 215, 0, 0.10)",
      statusOpen: "#34C759",
      statusClosed: "#FF453A",
      scrollThumb: "rgba(255, 215, 0, 0.30)",
      tooltipBg: "rgba(10, 10, 8, 0.97)",
      tooltipText: "#F5EFDC",
      pickerBg: "#17150F",
      pickerShadow: "#000000",
    }),
  },
  {
    id: "ocean-tech",
    name: "Ocean Tech",
    description: "Deep-ocean window with glowing orange tech accents.",
    dark: true,
    vars: defineSkin({
      dark: true,
      windowBg: "#2C3E50",
      centerBg: "#2C3E50",
      surface: "#33465A",
      cardBorder: "rgba(52, 152, 219, 0.40)",
      shadowColor: "#000000",
      headerBg: "#34495E",
      headerBorder: "rgba(52, 152, 219, 0.35)",
      accent: "#F39C12",
      accentStrong: "#E67E22",
      title: "#FFFFFF",
      subtitle: "#C7D3DE",
      muted: "#93A5B5",
      sender: "#F8C471",
      text: "#ECF0F1",
      bodyBg: "#293846",
      inBg: "rgba(255, 255, 255, 0.07)",
      inBorder: "rgba(255, 255, 255, 0.24)",
      inText: "#ECF0F1",
      outBg: "rgba(231, 76, 60, 0.24)",
      outBorder: "rgba(231, 76, 60, 0.50)",
      outText: "#FFEDEA",
      sysBg: "rgba(243, 156, 18, 0.08)",
      sysBorder: "rgba(243, 156, 18, 0.35)",
      sysText: "#C7D3DE",
      composerBg: "#33465A",
      composerBorder: "rgba(52, 152, 219, 0.32)",
      inputBg: "#3A4E63",
      inputText: "#ECF0F1",
      inputBorder: "rgba(52, 152, 219, 0.45)",
      placeholder: "#93A5B5",
      focusBorder: "rgba(243, 156, 18, 0.75)",
      focusRing: "0 0 0 3px rgba(243, 156, 18, 0.16)",
      sendFrom: "#F39C12",
      sendTo: "#E67E22",
      link: "#F8C471",
      icon: "#F8C471",
      divider: "rgba(255, 255, 255, 0.10)",
      hoverBg: "rgba(255, 255, 255, 0.06)",
      selectedBg: "rgba(243, 156, 18, 0.16)",
      selectedText: "#F8C471",
      typingDot: "#F39C12",
      unread: "#F39C12",
      secondaryBg: "#3A4E63",
      secondaryBorder: "rgba(52, 152, 219, 0.45)",
      secondaryText: "#F8C471",
      secondaryBgHover: "rgba(52, 152, 219, 0.18)",
      btnBg: "#3A4E63",
      btnText: "#ECF0F1",
      btnBorder: "rgba(255, 255, 255, 0.24)",
      btnHoverBg: "rgba(255, 255, 255, 0.08)",
      statusOpen: "#2ECC71",
      statusClosed: "#E74C3C",
      scrollThumb: "rgba(52, 152, 219, 0.40)",
      tooltipBg: "rgba(15, 26, 36, 0.97)",
      tooltipText: "#ECF0F1",
      pickerBg: "#293846",
      pickerShadow: "#000000",
    }),
  },
  {
    id: "emerald-sage",
    name: "Emerald Sage",
    description: "Soft sage garden with forest identity.",
    dark: false,
    vars: defineSkin({
      dark: false,
      windowBg: "#EDF4E7",
      centerBg: "#EDF4E7",
      surface: "#FFFFFF",
      cardBorder: "rgba(46, 125, 89, 0.28)",
      shadowColor: "#1F5C43",
      headerBg: "#FFFFFF",
      headerBorder: "rgba(46, 125, 89, 0.16)",
      accent: "#2E7D59",
      accentStrong: "#237048",
      title: "#1F5C43",
      subtitle: "#5F8271",
      muted: "#86A294",
      sender: "#256B4B",
      text: "#24382E",
      bodyBg: "#F7FBF3",
      inBg: "#FFFFFF",
      inBorder: "rgba(46, 125, 89, 0.28)",
      inText: "#24382E",
      outBg: "#E2F3EA",
      outBorder: "rgba(46, 125, 89, 0.42)",
      outText: "#173F31",
      sysBg: "rgba(46, 125, 89, 0.06)",
      sysBorder: "rgba(46, 125, 89, 0.28)",
      sysText: "#5F8271",
      composerBg: "#FFFFFF",
      composerBorder: "rgba(46, 125, 89, 0.16)",
      inputBg: "#F3F8EE",
      inputText: "#24382E",
      inputBorder: "rgba(46, 125, 89, 0.28)",
      placeholder: "#86A294",
      focusBorder: "rgba(64, 196, 221, 0.75)",
      focusRing: "0 0 0 3px rgba(64, 196, 221, 0.16)",
      sendFrom: "#2E7D59",
      sendTo: "#237048",
      link: "#1F7E93",
      icon: "#2E7D59",
      divider: "rgba(46, 125, 89, 0.14)",
      hoverBg: "rgba(46, 125, 89, 0.07)",
      selectedBg: "rgba(46, 125, 89, 0.13)",
      selectedText: "#1F5C43",
      typingDot: "#2E7D59",
      unread: "#E0483C",
      secondaryBg: "#FFFFFF",
      secondaryBorder: "rgba(46, 125, 89, 0.26)",
      secondaryText: "#1F5C43",
      secondaryBgHover: "#EDF5EF",
      btnBg: "#FFFFFF",
      btnText: "#1F5C43",
      btnBorder: "rgba(46, 125, 89, 0.30)",
      btnHoverBg: "#EDF5EF",
      statusOpen: "#22A55A",
      statusClosed: "#E5484D",
      scrollThumb: "rgba(46, 125, 89, 0.30)",
      tooltipBg: "rgba(16, 42, 32, 0.96)",
      tooltipText: "#EFF7E9",
      pickerBg: "#FFFFFF",
      pickerShadow: "#1F5C43",
    }),
  },
  {
    id: "circuit-navy",
    name: "Circuit Navy",
    description: "Navy circuit board alive with electric-cyan traces.",
    dark: true,
    vars: defineSkin({
      dark: true,
      windowBg: "#12161D",
      centerBg: "#12161D",
      surface: "#191F2A",
      cardBorder: "rgba(0, 243, 255, 0.28)",
      shadowColor: "#000000",
      headerBg: "#161C26",
      headerBorder: "rgba(0, 243, 255, 0.22)",
      accent: "#00F3FF",
      accentStrong: "#00C2E0",
      title: "#E6FBFF",
      subtitle: "#9FB2C4",
      muted: "#6E8095",
      sender: "#37D6F0",
      text: "#E2E8F0",
      bodyBg: "#151A23",
      inBg: "rgba(255, 255, 255, 0.05)",
      inBorder: "rgba(0, 243, 255, 0.26)",
      inText: "#E2E8F0",
      outBg: "rgba(0, 255, 157, 0.10)",
      outBorder: "rgba(0, 255, 157, 0.38)",
      outText: "#E4FFF2",
      sysBg: "rgba(0, 243, 255, 0.06)",
      sysBorder: "rgba(0, 243, 255, 0.28)",
      sysText: "#9FB2C4",
      composerBg: "#191F2A",
      composerBorder: "rgba(0, 243, 255, 0.18)",
      inputBg: "#232B38",
      inputText: "#E2E8F0",
      inputBorder: "rgba(0, 243, 255, 0.30)",
      placeholder: "#6E8095",
      focusBorder: "rgba(0, 243, 255, 0.70)",
      focusRing: "0 0 0 3px rgba(0, 243, 255, 0.13)",
      sendFrom: "#00F3FF",
      sendTo: "#0090FF",
      link: "#37D6F0",
      icon: "#37D6F0",
      divider: "rgba(255, 255, 255, 0.08)",
      hoverBg: "rgba(255, 255, 255, 0.05)",
      selectedBg: "rgba(0, 243, 255, 0.12)",
      selectedText: "#37D6F0",
      typingDot: "#00F3FF",
      unread: "#00FF9D",
      secondaryBg: "#232B38",
      secondaryBorder: "rgba(0, 243, 255, 0.32)",
      secondaryText: "#37D6F0",
      secondaryBgHover: "rgba(0, 243, 255, 0.08)",
      btnBg: "#232B38",
      btnText: "#DCE7F2",
      btnBorder: "rgba(255, 255, 255, 0.16)",
      btnHoverBg: "rgba(255, 255, 255, 0.06)",
      statusOpen: "#00FF9D",
      statusClosed: "#FF5B52",
      scrollThumb: "rgba(0, 243, 255, 0.30)",
      tooltipBg: "rgba(8, 14, 20, 0.97)",
      tooltipText: "#E6FBFF",
      pickerBg: "#1A2130",
      pickerShadow: "#000000",
    }),
  },
  {
    id: "arctic-white",
    name: "Arctic White",
    description: "Cool white stage with the teal Websmith sphere.",
    dark: false,
    vars: defineSkin({
      dark: false,
      windowBg: "#F0F4F4",
      centerBg: "#F0F4F4",
      surface: "#FFFFFF",
      cardBorder: "rgba(23, 94, 99, 0.24)",
      shadowColor: "#175E63",
      headerBg: "#FFFFFF",
      headerBorder: "rgba(23, 94, 99, 0.14)",
      accent: "#00A88F",
      accentStrong: "#0E8C86",
      title: "#175E63",
      subtitle: "#587F83",
      muted: "#85A4A7",
      sender: "#0E8C86",
      text: "#1C363A",
      bodyBg: "#F7FBFB",
      inBg: "#FFFFFF",
      inBorder: "rgba(23, 94, 99, 0.24)",
      inText: "#1C363A",
      outBg: "#DFF4F0",
      outBorder: "rgba(0, 168, 150, 0.42)",
      outText: "#0E4448",
      sysBg: "rgba(0, 184, 150, 0.06)",
      sysBorder: "rgba(0, 184, 150, 0.28)",
      sysText: "#587F83",
      composerBg: "#FFFFFF",
      composerBorder: "rgba(23, 94, 99, 0.14)",
      inputBg: "#F2F8F8",
      inputText: "#1C363A",
      inputBorder: "rgba(23, 94, 99, 0.26)",
      placeholder: "#85A4A7",
      focusBorder: "rgba(0, 184, 150, 0.70)",
      focusRing: "0 0 0 3px rgba(0, 184, 150, 0.14)",
      sendFrom: "#00B896",
      sendTo: "#25A4A6",
      link: "#0E8C86",
      icon: "#00A88F",
      divider: "rgba(23, 94, 99, 0.12)",
      hoverBg: "rgba(23, 94, 99, 0.06)",
      selectedBg: "rgba(0, 184, 150, 0.12)",
      selectedText: "#175E63",
      typingDot: "#00B896",
      unread: "#E0483C",
      secondaryBg: "#FFFFFF",
      secondaryBorder: "rgba(23, 94, 99, 0.22)",
      secondaryText: "#175E63",
      secondaryBgHover: "#EBF4F4",
      btnBg: "#FFFFFF",
      btnText: "#175E63",
      btnBorder: "rgba(23, 94, 99, 0.26)",
      btnHoverBg: "#EBF4F4",
      statusOpen: "#22A55A",
      statusClosed: "#E5484D",
      scrollThumb: "rgba(23, 94, 99, 0.28)",
      tooltipBg: "rgba(9, 44, 46, 0.96)",
      tooltipText: "#F7FCFC",
      pickerBg: "#FFFFFF",
      pickerShadow: "#175E63",
    }),
  },
  {
    id: "aqua-mist",
    name: "Aqua Mist",
    description: "Calm aqua mist with airy white bubbles.",
    dark: false,
    vars: defineSkin({
      dark: false,
      windowBg: "#E9F4FA",
      centerBg: "#E9F4FA",
      surface: "#FFFFFF",
      cardBorder: "rgba(14, 127, 166, 0.28)",
      shadowColor: "#0E4A5E",
      headerBg: "#FFFFFF",
      headerBorder: "rgba(14, 127, 166, 0.16)",
      accent: "#0EA5C9",
      accentStrong: "#0B7FA6",
      title: "#0E4A5E",
      subtitle: "#567F8D",
      muted: "#84A5B2",
      sender: "#0B7FA6",
      text: "#12303C",
      bodyBg: "#F5FBFD",
      inBg: "#FFFFFF",
      inBorder: "rgba(14, 127, 166, 0.26)",
      inText: "#12303C",
      outBg: "#DFEFF7",
      outBorder: "rgba(11, 127, 166, 0.40)",
      outText: "#0C3949",
      sysBg: "rgba(14, 165, 201, 0.06)",
      sysBorder: "rgba(14, 165, 201, 0.30)",
      sysText: "#567F8D",
      composerBg: "#FFFFFF",
      composerBorder: "rgba(14, 127, 166, 0.16)",
      inputBg: "#F1F8FB",
      inputText: "#12303C",
      inputBorder: "rgba(14, 127, 166, 0.26)",
      placeholder: "#84A5B2",
      focusBorder: "rgba(14, 165, 201, 0.72)",
      focusRing: "0 0 0 3px rgba(14, 165, 201, 0.14)",
      sendFrom: "#0EA5C9",
      sendTo: "#0B7FA6",
      link: "#0B7FA6",
      icon: "#0EA5C9",
      divider: "rgba(14, 127, 166, 0.14)",
      hoverBg: "rgba(14, 127, 166, 0.06)",
      selectedBg: "rgba(14, 165, 201, 0.12)",
      selectedText: "#0B7FA6",
      typingDot: "#0EA5C9",
      unread: "#E0483C",
      secondaryBg: "#FFFFFF",
      secondaryBorder: "rgba(14, 127, 166, 0.26)",
      secondaryText: "#0B7FA6",
      secondaryBgHover: "#EBF5F9",
      btnBg: "#FFFFFF",
      btnText: "#0B5E7C",
      btnBorder: "rgba(14, 127, 166, 0.30)",
      btnHoverBg: "#EBF5F9",
      statusOpen: "#22A55A",
      statusClosed: "#E5484D",
      scrollThumb: "rgba(14, 127, 166, 0.28)",
      tooltipBg: "rgba(7, 42, 54, 0.96)",
      tooltipText: "#F2FAFD",
      pickerBg: "#FFFFFF",
      pickerShadow: "#0E4A5E",
    }),
  },
  {
    id: "sunset-duo",
    name: "Sunset Duo",
    description: "Rose-to-azure duotone energy.",
    dark: false,
    vars: defineSkin({
      dark: false,
      windowBg: "#F8F2F6",
      centerBg: "#F8F2F6",
      surface: "#FFFFFF",
      cardBorder: "rgba(93, 30, 60, 0.22)",
      shadowColor: "#5D1E3C",
      headerBg: "#FFFFFF",
      headerBorder: "rgba(93, 30, 60, 0.12)",
      accent: "#E9548C",
      accentStrong: "#3478F6",
      title: "#5D1E3C",
      subtitle: "#8A667E",
      muted: "#AE90A2",
      sender: "#C13A72",
      text: "#3A2133",
      bodyBg: "#FCF7FA",
      inBg: "#FFFFFF",
      inBorder: "rgba(93, 30, 60, 0.22)",
      inText: "#3A2133",
      outBg: "#EAF1FE",
      outBorder: "rgba(52, 120, 246, 0.42)",
      outText: "#22346B",
      sysBg: "rgba(233, 84, 140, 0.06)",
      sysBorder: "rgba(233, 84, 140, 0.28)",
      sysText: "#8A667E",
      composerBg: "#FFFFFF",
      composerBorder: "rgba(93, 30, 60, 0.12)",
      inputBg: "#F8F3F7",
      inputText: "#3A2133",
      inputBorder: "rgba(93, 30, 60, 0.24)",
      placeholder: "#AE90A2",
      focusBorder: "rgba(52, 120, 246, 0.62)",
      focusRing: "0 0 0 3px rgba(52, 120, 246, 0.14)",
      sendFrom: "#E9548C",
      sendTo: "#3478F6",
      link: "#C13A72",
      icon: "#D6447E",
      divider: "rgba(93, 30, 60, 0.12)",
      hoverBg: "rgba(93, 30, 60, 0.05)",
      selectedBg: "rgba(233, 84, 140, 0.12)",
      selectedText: "#C13A72",
      typingDot: "#E9548C",
      unread: "#3478F6",
      secondaryBg: "#FFFFFF",
      secondaryBorder: "rgba(93, 30, 60, 0.20)",
      secondaryText: "#C13A72",
      secondaryBgHover: "#F7EEF3",
      btnBg: "#FFFFFF",
      btnText: "#5D1E3C",
      btnBorder: "rgba(93, 30, 60, 0.26)",
      btnHoverBg: "#F7EEF3",
      statusOpen: "#22A55A",
      statusClosed: "#E5484D",
      scrollThumb: "rgba(93, 30, 60, 0.24)",
      tooltipBg: "rgba(48, 15, 31, 0.96)",
      tooltipText: "#FBF5F9",
      pickerBg: "#FFFFFF",
      pickerShadow: "#5D1E3C",
    }),
  },
  {
    id: "royal-violet",
    name: "Royal Violet",
    description: "Regal violet-indigo take on the Websmith language.",
    dark: false,
    vars: defineSkin({
      dark: false,
      windowBg: "#F1EFF9",
      centerBg: "#F1EFF9",
      surface: "#FFFFFF",
      cardBorder: "rgba(58, 34, 130, 0.24)",
      shadowColor: "#3A2282",
      headerBg: "#FFFFFF",
      headerBorder: "rgba(58, 34, 130, 0.14)",
      accent: "#7B4FF2",
      accentStrong: "#5C63E8",
      title: "#3A2282",
      subtitle: "#726BA6",
      muted: "#9C93C4",
      sender: "#6B3FE0",
      text: "#2A2050",
      bodyBg: "#F9F8FE",
      inBg: "#FFFFFF",
      inBorder: "rgba(58, 34, 130, 0.24)",
      inText: "#2A2050",
      outBg: "#EDEAFD",
      outBorder: "rgba(123, 79, 242, 0.42)",
      outText: "#2C2170",
      sysBg: "rgba(123, 79, 242, 0.06)",
      sysBorder: "rgba(123, 79, 242, 0.28)",
      sysText: "#726BA6",
      composerBg: "#FFFFFF",
      composerBorder: "rgba(58, 34, 130, 0.14)",
      inputBg: "#F5F3FC",
      inputText: "#2A2050",
      inputBorder: "rgba(58, 34, 130, 0.26)",
      placeholder: "#9C93C4",
      focusBorder: "rgba(123, 79, 242, 0.68)",
      focusRing: "0 0 0 3px rgba(123, 79, 242, 0.14)",
      sendFrom: "#7B4FF2",
      sendTo: "#5C63E8",
      link: "#5B34C4",
      icon: "#6B3FE0",
      divider: "rgba(58, 34, 130, 0.12)",
      hoverBg: "rgba(58, 34, 130, 0.05)",
      selectedBg: "rgba(123, 79, 242, 0.12)",
      selectedText: "#5B34C4",
      typingDot: "#7B4FF2",
      unread: "#E9548C",
      secondaryBg: "#FFFFFF",
      secondaryBorder: "rgba(58, 34, 130, 0.22)",
      secondaryText: "#5B34C4",
      secondaryBgHover: "#F1EEFB",
      btnBg: "#FFFFFF",
      btnText: "#3A2282",
      btnBorder: "rgba(58, 34, 130, 0.28)",
      btnHoverBg: "#F1EEFB",
      statusOpen: "#22A55A",
      statusClosed: "#E5484D",
      scrollThumb: "rgba(58, 34, 130, 0.26)",
      tooltipBg: "rgba(28, 17, 66, 0.96)",
      tooltipText: "#F7F5FE",
      pickerBg: "#FFFFFF",
      pickerShadow: "#3A2282",
    }),
  },
  {
    id: "graphite-forge",
    name: "Graphite Forge",
    description: "Charcoal workshop lit by molten-orange forge light.",
    dark: true,
    vars: defineSkin({
      dark: true,
      windowBg: "#14161A",
      centerBg: "#14161A",
      surface: "#1D2126",
      cardBorder: "rgba(255, 122, 26, 0.28)",
      shadowColor: "#000000",
      headerBg: "#181C21",
      headerBorder: "rgba(255, 122, 26, 0.22)",
      accent: "#FF7A1A",
      accentStrong: "#E85D04",
      title: "#FFF4EA",
      subtitle: "#ADB5C1",
      muted: "#77808C",
      sender: "#FFA45C",
      text: "#EDEAE6",
      bodyBg: "#171A1F",
      inBg: "rgba(255, 255, 255, 0.05)",
      inBorder: "rgba(255, 255, 255, 0.18)",
      inText: "#EDEAE6",
      outBg: "rgba(255, 122, 26, 0.16)",
      outBorder: "rgba(255, 122, 26, 0.42)",
      outText: "#FFF0E4",
      sysBg: "rgba(255, 122, 26, 0.06)",
      sysBorder: "rgba(255, 122, 26, 0.28)",
      sysText: "#ADB5C1",
      composerBg: "#1D2126",
      composerBorder: "rgba(255, 122, 26, 0.18)",
      inputBg: "#262C33",
      inputText: "#EDEAE6",
      inputBorder: "rgba(255, 122, 26, 0.28)",
      placeholder: "#77808C",
      focusBorder: "rgba(255, 122, 26, 0.68)",
      focusRing: "0 0 0 3px rgba(255, 122, 26, 0.13)",
      sendFrom: "#FF7A1A",
      sendTo: "#E85D04",
      link: "#FFA45C",
      icon: "#FFA45C",
      divider: "rgba(255, 255, 255, 0.08)",
      hoverBg: "rgba(255, 255, 255, 0.05)",
      selectedBg: "rgba(255, 122, 26, 0.14)",
      selectedText: "#FFA45C",
      typingDot: "#FF7A1A",
      unread: "#FF7A1A",
      secondaryBg: "#262C33",
      secondaryBorder: "rgba(255, 122, 26, 0.30)",
      secondaryText: "#FFA45C",
      secondaryBgHover: "rgba(255, 122, 26, 0.09)",
      btnBg: "#262C33",
      btnText: "#EDEAE6",
      btnBorder: "rgba(255, 255, 255, 0.18)",
      btnHoverBg: "rgba(255, 255, 255, 0.06)",
      statusOpen: "#2ECC71",
      statusClosed: "#FF5B52",
      scrollThumb: "rgba(255, 122, 26, 0.30)",
      tooltipBg: "rgba(12, 13, 16, 0.97)",
      tooltipText: "#FFF4EA",
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
