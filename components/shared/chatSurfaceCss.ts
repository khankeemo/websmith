// components/shared/chatSurfaceCss.ts
// PURPOSE: ONE shared presentational stylesheet for BOTH chat surfaces — the
//          Direct Secure Client Messenger (`/chat/[id]`, `ClientChat.tsx`) and
//          the Admin Messenger (`/admin/messages`,
//          `AdminMessagesClient.tsx`). R04 messenger polish that must look
//          identical everywhere lives here exactly once:
//            - smooth skin-transition easing on the structural chrome
//              (card / header / bubbles crossfade instead of snapping),
//            - message entrance animation (`wsMsgIn`) applied per mounted
//              message row (keyed by message id, so polling merges never
//              replay it),
//            - honest "Sending…" pill with pulsing dots (`ws-send-pill`),
//            - themed scrollbar polish for `.ws-chat-scroll`,
//            - placeholder + focus-ring theming from `--sk-*` tokens,
//            - subtle bubble elevation (incoming flat, outgoing lifted),
//            - `prefers-reduced-motion` guards.
//
//          Every rule is scoped under `.ws-chat-surface` (both hosts put this
//          class on their skin-carrying root element) and resolves ONLY
//          `--sk-*` custom properties from `app/chat/[id]/chatSkins.ts` — no
//          hardcoded palette, so all 10 skins theme it automatically. Pure CSS
//          string, injected via `<style dangerouslySetInnerHTML>` (the repo's
//          documented pattern). Zero logic, zero imports — client-safe.

export const CHAT_SURFACE_CSS = `
/* ---- Skin-switch smoothing (chrome crossfades between skins) ------------- */
.ws-chat-surface .ws-chat-card{transition:box-shadow .45s ease,border-color .45s ease,background-color .35s ease;}
.ws-chat-surface .ws-chat-header{transition:background-color .35s ease,border-color .35s ease;}
.ws-chat-surface .ws-bubble-in,.ws-chat-surface .ws-bubble-out{transition:background-color .3s ease,border-color .3s ease,color .3s ease;}

/* ---- Message entrance (once per mounted row; poll merges never replay) --- */
@keyframes wsMsgIn{from{opacity:0;transform:translateY(8px) scale(.98);}to{opacity:1;transform:none;}}
.ws-chat-surface .ws-msg{animation:wsMsgIn .28s cubic-bezier(.33,1,.68,1) both;}

/* ---- Bubble elevation (modern messenger depth; token-neutral shadows) ---- */
.ws-chat-surface .ws-bubble-in{box-shadow:0 1px 2px rgba(0,0,0,.05);}
.ws-chat-surface .ws-bubble-out{box-shadow:0 1px 3px rgba(0,0,0,.07),0 3px 10px rgba(0,0,0,.05);}

/* ---- Honest Sending… pill (pulsing dots, --sk-typing-dot) ----------------- */
@keyframes wsPillDot{0%,80%,100%{opacity:.25;transform:translateY(0);}40%{opacity:1;transform:translateY(-2px);}}
.ws-send-pill{display:inline-flex;align-items:center;gap:5px;padding:4px 11px;border-radius:999px;border:1px dashed var(--sk-system-border);background:var(--sk-system-bg);color:var(--sk-system-text);font-size:10.5px;font-weight:600;}
.ws-send-pill i{width:4px;height:4px;border-radius:50%;background:var(--sk-typing-dot);animation:wsPillDot 1.2s ease-in-out infinite;}
.ws-send-pill i:nth-of-type(2){animation-delay:.15s;}
.ws-send-pill i:nth-of-type(3){animation-delay:.3s;}

/* ---- Themed scrollbar (.ws-chat-scroll hosts) ----------------------------- */
.ws-chat-surface .ws-chat-scroll{scrollbar-width:thin;scrollbar-color:var(--sk-scroll-thumb) transparent;}
.ws-chat-surface .ws-chat-scroll::-webkit-scrollbar{width:8px;height:8px;}
.ws-chat-surface .ws-chat-scroll::-webkit-scrollbar-track{background:transparent;}
.ws-chat-surface .ws-chat-scroll::-webkit-scrollbar-thumb{background:var(--sk-scroll-thumb);border-radius:999px;border:2px solid transparent;background-clip:padding-box;}

/* ---- Placeholder + focus theming ------------------------------------------ */
.ws-chat-surface textarea::placeholder,.ws-chat-surface input::placeholder{color:var(--sk-placeholder);opacity:1;}
.ws-chat-surface textarea:focus-visible,.ws-chat-surface input:focus-visible{outline:none;border-color:var(--sk-focus-border) !important;box-shadow:var(--sk-focus-ring);}
.ws-chat-surface a:focus-visible,.ws-chat-surface button:focus-visible{outline:2px solid var(--sk-accent);outline-offset:2px;}

/* ---- Reduced motion -------------------------------------------------------- */
@media (prefers-reduced-motion: reduce){
  .ws-chat-surface .ws-msg{animation:none;}
  .ws-send-pill i{animation:none;}
  .ws-chat-surface .ws-chat-card,.ws-chat-surface .ws-chat-header,.ws-chat-surface .ws-bubble-in,.ws-chat-surface .ws-bubble-out{transition:none;}
}
`;
