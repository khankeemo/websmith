"use client";

// components/shared/ChatSkinPicker.tsx
// PURPOSE: the ONE shared skin-changer UI for BOTH chat surfaces — the Direct
// Secure Client Messenger (`/chat/[id]`, `ClientChat.tsx`) and the Admin
// Messenger (`/admin/messages`, `AdminMessagesClient.tsx`). It renders the
// gallery of the 10 production skins defined in the single source of truth
// `app/chat/[id]/chatSkins.ts`. Selecting a skin swaps ONLY CSS custom
// properties (`--sk-*`) on the host surface's existing chat markup — there is
// no second chat implementation and no chat logic involved. Immediate apply
// (state), persistence (localStorage via the shared helpers), keyboard/AT
// accessible (button trigger, dialog semantics, listbox options,
// Escape/outside close).
//
// The stylesheet below is injected by this component itself so the picker is
// fully self-contained on any surface; every color resolves from the SAME
// `--sk-*` tokens the skins provide (set by the host on an ancestor element),
// so the selector is themed by the active skin like the rest of the chat.
//
// FALLBACKS: on the Admin Messenger the picker trigger lives OUTSIDE the
// messenger card (which carries the skin scope), so EVERY token here carries a
// fallback value — always the DEFAULT skin (Websmith Classic) value. Inside a
// skin scope the active skin wins; outside one the picker still renders with
// guaranteed contrast instead of transparent-on-transparent chrome.

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Palette } from "lucide-react";
import { CHAT_SKINS } from "@/app/chat/[id]/chatSkins";

const CHAT_SKIN_PICKER_CSS = `
.ws-skin-wrap{position:relative;flex-shrink:0;display:inline-flex;}
.ws-skin-trigger{width:32px;height:32px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--sk-input-border,rgba(15,23,42,.16));background:var(--sk-input-bg,#F4F6F9);color:var(--sk-accent,#149CEA);cursor:pointer;transition:border-color 160ms ease,box-shadow 160ms ease;}
.ws-skin-trigger:hover,.ws-skin-trigger[aria-expanded="true"]{border-color:var(--sk-focus-border,rgba(20,156,234,.65));box-shadow:var(--sk-focus-ring,0 0 0 3px rgba(20,156,234,.15));}
.ws-skin-panel{position:absolute;top:calc(100% + 8px);right:0;z-index:60;width:min(300px,calc(100vw - 48px));max-height:min(420px,58dvh);display:flex;flex-direction:column;background:var(--sk-picker-bg,#FFFFFF);border:1px solid var(--sk-picker-border,rgba(15,23,42,.12));border-radius:14px;box-shadow:var(--sk-picker-shadow,0 12px 32px rgba(15,27,45,.18));overflow:hidden;animation:wsSkinPanelIn .16s ease;transform-origin:top right;}
.ws-skin-panel-head{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:10px 12px 8px;border-bottom:1px solid var(--sk-picker-border,rgba(15,23,42,.12));}
.ws-skin-panel-title{font-size:11px;font-weight:800;letter-spacing:0.6px;text-transform:uppercase;color:var(--sk-subtitle,#51607A);}
.ws-skin-panel-count{font-size:10px;color:var(--sk-time,#8592A6);}
.ws-skin-list{overflow-y:auto;padding:6px;display:flex;flex-direction:column;gap:4px;}
.ws-skin-row{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:transparent;border:1px solid transparent;border-radius:10px;padding:7px 8px;cursor:pointer;transition:background 140ms ease,border-color 140ms ease;}
.ws-skin-row:hover{background:var(--sk-system-bg,rgba(20,156,234,.06));}
.ws-skin-row-active{border-color:var(--sk-accent,#149CEA);}
.ws-skin-meta{min-width:0;display:flex;flex-direction:column;gap:1px;}
.ws-skin-name{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:700;color:var(--sk-text,#1F2B3E);}
.ws-skin-desc{font-size:10.5px;line-height:1.4;color:var(--sk-subtitle,#51607A);}
.ws-skin-swatch{position:relative;width:44px;height:34px;flex-shrink:0;border-radius:8px;overflow:hidden;border:1px solid var(--sk-picker-border,rgba(15,23,42,.12));}
.ws-skin-swatch-header{position:absolute;top:0;left:0;right:0;height:9px;}
.ws-skin-swatch-bubbles{position:absolute;top:13px;left:5px;right:5px;display:flex;gap:3px;}
.ws-skin-swatch-bubble{height:7px;flex:1;border-radius:3.5px;opacity:0.9;}
.ws-skin-swatch-bubble-client{max-width:55%;}
.ws-skin-swatch-bubble-admin{margin-left:auto;max-width:55%;}
.ws-skin-swatch-composer{position:absolute;bottom:4px;left:5px;width:11px;height:7px;border-radius:50%;}
@keyframes wsSkinPanelIn{from{opacity:0;transform:translateY(-4px) scale(.98);}to{opacity:1;transform:none;}}
@media (prefers-reduced-motion: reduce){.ws-skin-trigger,.ws-skin-row{transition:none;}.ws-skin-panel{animation:none;}}
`;

export function ChatSkinPicker({
  activeSkinId,
  onSelect,
}: {
  activeSkinId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onMouseDown = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [open]);

  return (
    <div className="ws-skin-wrap" ref={wrapRef}>
      <style dangerouslySetInnerHTML={{ __html: CHAT_SKIN_PICKER_CSS }} />
      <button
        type="button"
        className="ws-skin-trigger"
        aria-label="Change chat theme"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Chat themes"
        onClick={() => setOpen((value) => !value)}
      >
        <Palette size={15} aria-hidden="true" />
      </button>
      {open && (
        <div className="ws-skin-panel" role="dialog" aria-label="Chat themes">
          <div className="ws-skin-panel-head">
            <span className="ws-skin-panel-title">Chat Theme</span>
            <span className="ws-skin-panel-count">{CHAT_SKINS.length} skins</span>
          </div>
          <div className="ws-skin-list" role="listbox" aria-label="Available chat themes">
            {CHAT_SKINS.map((skin) => {
              const active = skin.id === activeSkinId;
              return (
                <button
                  key={skin.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={active ? "ws-skin-row ws-skin-row-active" : "ws-skin-row"}
                  onClick={() => onSelect(skin.id)}
                >
                  <span
                    className="ws-skin-swatch"
                    style={{ background: skin.vars["--sk-body-bg"] }}
                    aria-hidden="true"
                  >
                    <span className="ws-skin-swatch-header" style={{ background: skin.vars["--sk-header-bg"] }} />
                    <span className="ws-skin-swatch-bubbles">
                      <span className="ws-skin-swatch-bubble ws-skin-swatch-bubble-client" style={{ background: skin.vars["--sk-client-bg"] }} />
                      <span className="ws-skin-swatch-bubble ws-skin-swatch-bubble-admin" style={{ background: skin.vars["--sk-admin-bg"] }} />
                    </span>
                    <span className="ws-skin-swatch-composer" style={{ background: skin.vars["--sk-brand-bg"] }} />
                  </span>
                  <span className="ws-skin-meta">
                    <span className="ws-skin-name">
                      {skin.name}
                      {active && <CheckCircle2 size={12} color="var(--sk-accent, #149CEA)" aria-hidden="true" />}
                    </span>
                    <span className="ws-skin-desc">{skin.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatSkinPicker;
