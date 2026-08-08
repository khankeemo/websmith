"""Universal License Activation — standalone activation window (UI LAYER ONLY).

Restored as the full standalone activation UI (See master doc SECTION 0E and
AGENTS.md "activation.py is the full standalone Activation UI again (ROLLBACK)").
It is a UI-layer module: the window delegates every operation to LicenseEngine
(validate_license_key -> auto send_otp -> verify_otp -> activate -> refresh)
and resolves every user-visible message through GlobalMessage. It never touches
client/cache/_client directly and never embeds backend decision logic.

Required workflow (SECTION 0B/0C, LOCKED §10):
  License key -> Validate -> Backend Status -> Validation Success ->
  Auto send OTP -> OTP sent (05:00 countdown) -> Enter OTP -> Verify OTP ->
  OTP verified -> Activate -> Bind hardware -> Update license -> Refresh ->
  Success dialog -> Restart.
"""
from typing import Any, Dict, Optional

import tkinter as tk

from .license_engine import LicenseEngine, LicenseStatus
from .hardware import HardwareDetector
from .global_message import GlobalMessage
from .workflow_progress import format_timer
from .live_log import LiveLog

__all__ = [
    "activate_license",
    "validate_license",
    "deactivate_license",
    "open_activation_dialog",
    "ActivationDialog",
]


# ---------------------------------------------------------------------------
# UI.MD visual layer (docs/UI.MD) — cosmetic only, no behaviour changes.
#
# Self-contained widgets that draw from the Uiverse.io reference designs:
#   * Card   : soft shadow, rounded white panel with subtle border (form/card
#              reference).
#   * Button : rounded, gradient primary/success CTA + quiet ghost (button +
#              form login-button references).
#   * Form   : container keeps content inside a compact clean card.
#   * Textbox: normal rectangular box with a *slightly* rounded corner and a
#              cyan focus ring (alexruix input reference) — not a pill/oval.
#
# All of the activation flow (Validate -> auto OTP -> 5-min timer -> Verify ->
# Activate -> Refresh -> Success -> Restart) stays byte-for-byte the same.
# ---------------------------------------------------------------------------
from .ui_styles import (
    COL, INPUT_H,
    Label, SectionLabel, Subtitle, StatusPill, ProgressBar,
    hex_lerp, _rrect,
)

_REF_BLUE = "#1089D3"
_REF_CYAN = "#1BB5D2"
_REF_EDGE = "#dce3ee"
_REF_FILL = "#f4f7fb"
_REF_INK = "#1e2430"
_REF_MUTED = "#5c6675"


class _RefHeader(tk.Canvas):
    """Gradient band (blue -> cyan) carrying the window title + subtitle."""

    def __init__(self, parent, *, title: str = "", subtitle: str = "",
                 height: int = 64):
        self._title = title
        self._subtitle = subtitle
        self._h = height
        tk.Canvas.__init__(self, parent, height=height, bg=_REF_BLUE,
                           highlightthickness=0, bd=0)
        self.bind("<Configure>", self._redraw)

    def _redraw(self, *_args) -> None:
        self.delete("all")
        w = self.winfo_width() or 1
        step = 28
        for i in range(step):
            x1 = int(w * i / step)
            x2 = int(w * (i + 1) / step) + 1
            self.create_rectangle(x1, 0, x2, self._h,
                                  fill=hex_lerp(_REF_BLUE, _REF_CYAN,
                                                i / (step - 1)),
                                  outline="")
        if self._subtitle:
            self.create_text(w // 2, self._h // 2 + 6, text=self._title,
                             fill="#ffffff", font=(COL["font"], 15, "bold"))
            self.create_text(w // 2, self._h // 2 + 22, text=self._subtitle,
                             fill="#ffffff", font=(COL["font"], 9))
        else:
            self.create_text(w // 2, self._h // 2, text=self._title,
                             fill="#ffffff", font=(COL["font"], 15, "bold"))


class _RefCard(tk.Canvas):
    """Form card: rounded white panel over a soft shadow, centred `.body`."""

    def __init__(self, parent):
        tk.Canvas.__init__(self, parent, bg=COL["bg"],
                           highlightthickness=0, bd=0)
        self.body = tk.Frame(self, bg="#ffffff")
        self._body_win = None
        self.bind("<Configure>", self._redraw)
        self._redraw()

    def _redraw(self, *_args) -> None:
        w = self.winfo_width()
        h = self.winfo_height()
        if w < 20 or h < 20:
            return
        self.delete("shadow")
        self.delete("card")
        _rrect(self, 6, 6, w - 2, h - 2, 14,
               fill="#d9e3ee", outline="", tags="shadow")
        _rrect(self, 2, 2, w - 4, h - 4, 14,
               fill="#ffffff", outline=_REF_EDGE, width=1, tags="card")
        pad = 14
        bw = max(20, w - 2 * pad)
        bh = max(20, h - 2 * pad)
        if self._body_win is None:
            self._body_win = self.create_window(w // 2, h // 2,
                                                window=self.body,
                                                width=bw, height=bh,
                                                tags="win")
        else:
            self.itemconfigure(self._body_win, width=bw, height=bh)


class _RefEntry(tk.Canvas):
    """Compact rounded text box. Rectangular with a subtle corner radius
    (never an oval/pill). A cyan focus ring appears while the field is active."""

    def __init__(self, parent, *, width: int = 320, justify: str = "center",
                 password: bool = False):
        self._width = width
        tk.Canvas.__init__(self, parent, width=width, height=INPUT_H,
                           bg="#ffffff", highlightthickness=0, bd=0)
        self.entry = tk.Entry(
            self, font=(COL["font"], 12), justify=justify,
            relief="flat", bd=0, highlightthickness=0,
            bg=_REF_FILL, fg=_REF_INK, insertbackground=_REF_BLUE)
        if password:
            self.entry.configure(show="\u2022")
        self._win = self.create_window(width // 2, INPUT_H // 2,
                                       window=self.entry, width=width - 20)
        self._paint(False)
        self.entry.bind("<FocusIn>", lambda e: self._paint(True))
        self.entry.bind("<FocusOut>", lambda e: self._paint(False))

    def _paint(self, focused: bool) -> None:
        tk.Canvas.delete(self, "frame")
        _rrect(self, 1, 1, self._width - 1, INPUT_H - 1, 6,
               fill=_REF_FILL if not focused else "#ffffff",
               outline=_REF_CYAN if focused else _REF_EDGE,
               width=2 if focused else 1,
               tags="frame")

    def get(self) -> str:
        return self.entry.get()

    def delete(self, first, last=None) -> None:
        self.entry.delete(first, last)

    def insert(self, index, string) -> None:
        self.entry.insert(index, string)

    def focus_set(self):
        self.entry.focus_set()

    def state(self, mode: str) -> None:
        self.entry.config(state=mode)


class _RefButton(tk.Canvas):
    """Rounded button from the button/form references.

    ``kind`` ∈ {primary, success, ghost}. Primary/success draw a gentle
    vertical gradient; ghost is a quiet outlined button. A luminous inner
    ring appears on hover and the face darkens while pressed.
    """

    _R = {
        "primary": (_REF_BLUE, _REF_CYAN),
        "success": ("#16a34a", "#2FBE66"),
        "ghost":   ("#f8fbfe", "#eef4fb"),
    }

    def __init__(self, parent, text: str, *, kind: str = "primary",
                 command=None, width: int = 200, height: Optional[int] = None):
        self._kind = kind
        self._text = text
        self._command = command
        self._over = False
        self._pressed = False
        self._disabled = False
        self._width = width
        self._height = height or 40
        tk.Canvas.__init__(self, parent, width=width, height=self._height,
                           bg="#ffffff", highlightthickness=0, bd=0)
        self.bind("<Button-1>", self._press)
        self.bind("<Enter>", lambda e: self._set_over(True))
        self.bind("<Leave>", lambda e: self._set_over(False))
        self._draw()

    def _set_over(self, over: bool) -> None:
        self._over = over
        self._draw()

    def _press(self, _ev) -> None:
        if self._disabled or not self._command:
            return
        self._pressed = True
        self._draw()
        try:
            self.after(90, lambda: (setattr(self, "_pressed", False),
                                    self._draw()))
        except Exception:
            pass
        try:
            self._command()
        except Exception:
            pass

    def _draw(self) -> None:
        self.delete("all")
        w = self._width
        h = self._height
        near, far = self._R.get(self._kind, self._R["primary"])
        if self._disabled:
            near = far = COL["border"]
        if self._pressed and not self._disabled:
            near = hex_lerp(near, "#04243a", 0.22)
            far = hex_lerp(far, "#04243a", 0.22)
        _rrect(self, 1, 1, w - 1, h - 1, 8,
               fill=hex_lerp(far, near, 0.5), outline="", tags="base")
        _rrect(self, 1, int(h * 0.45), w - 1, h - 1, 8,
               fill=hex_lerp(near, far, 0.35), outline="", tags="sheen")
        if self._kind == "ghost" and not self._disabled:
            out = _REF_CYAN if self._over else _REF_EDGE
            _rrect(self, 1, 1, w - 1, h - 1, 8,
                   outline=out, width=2 if self._over else 1, tags="line")
        if self._over and not self._disabled:
            _rrect(self, 2, 2, w - 2, h - 2, 7,
                   outline=hex_lerp("#ffffff", _REF_CYAN, 0.45), width=2,
                   tags="ring")
        if self._disabled:
            fg = COL["text_faint"]
        else:
            fg = COL["text"] if self._kind == "ghost" else "#ffffff"
        self.create_text(w // 2, h // 2 + 1, text=self._text,
                         fill=fg, font=(COL["font"], 11, "bold"))

    def set_text(self, text: str) -> None:
        self._text = text
        self._draw()

    def set_state(self, state: str) -> None:
        self._disabled = state == "disabled"
        self._draw()


def activate_license(engine: LicenseEngine, license_key: str) -> Dict[str, Any]:
    return engine.activate(license_key)


def validate_license(engine: LicenseEngine, license_key: str = "") -> Dict[str, Any]:
    return engine.validate_license_key(license_key)


def deactivate_license(engine: LicenseEngine, license_key: str = "") -> Dict[str, Any]:
    return engine.deactivate(license_key)


def open_activation_dialog(center) -> None:
    """Open the standalone activation window against the given Universal License
    Center. ``center.engine`` is the single controller used for every step."""
    ActivationDialog(
        engine=center.engine,
        product_name=getattr(center, "_product_name", None) or "",
    ).show()


class ActivationDialog:
    """Standalone 'Activate your license' window.

    Pure UI: every state change comes back from the engine, and every message is
    resolved through GlobalMessage. Close cancels; success hand-off restarts
    via the shared SuccessDialog (single restart workflow).
    """

    def __init__(self, engine: LicenseEngine, product_name: Optional[str] = None):
        self.engine = engine
        self.config = getattr(engine, "config", None)
        cfg = {}
        if self.config is not None:
            try:
                cfg = self.config.raw() if hasattr(self.config, "raw") else dict(self.config)
            except Exception:
                cfg = {}
        self.product_name = product_name or (cfg.get("product", {}) or {}).get("name", "")
        self.hardware = HardwareDetector()
        self._root = None
        self._hardware_id = ""
        self._email = ""
        self._validated = False
        self._otp_verified = False
        self._otp_expires_at = 0.0
        self._otp_timer_id = None

    # -- window lifespan --------------------------------------------------
    def show(self) -> Dict[str, Any]:
        from .ui_styles import (
            COL,
            Label, SectionLabel, Subtitle, StatusPill, ProgressBar,
        )

        self._root = tk.Toplevel()
        self._root.title("UNIVERSAL LICENSE ACTIVATION")
        self._root.geometry("520x640")
        self._root.configure(bg=COL["bg"])
        self._root.resizable(False, False)
        self._root.protocol("WM_DELETE_WINDOW", self._on_closing)
        try:
            self._root.transient()
            self._root.grab_set()
        except Exception:
            pass

        _RefHeader(self._root, title="Activate License",
                   subtitle=self.product_name or "Universal License Engine",
                   height=64).pack(fill="x")
        card = _RefCard(self._root)
        card.pack(fill="both", expand=True, padx=2, pady=2)
        main = card.body

        phase = StatusPill(main, height=26)
        phase.pack(anchor="w", pady=(0, 12))
        phase.set_text("Ready", "neutral")

        SectionLabel(main, GlobalMessage.get("ui_enter_license_key")).pack(pady=(0, 6))
        key_entry = _RefEntry(main, width=460, justify="center")
        key_entry.pack(fill="x", pady=(0, 4))
        if self.engine.get_license_key():
            key_entry.insert(0, self.engine.get_license_key())
        self._hardware_id = self.hardware.get_fingerprint()
        hw = Subtitle(main, GlobalMessage.get("ui_hardware_hint", (self._hardware_id or "")[:16] + "…"), size=8)
        hw.pack(anchor="w", pady=(0, 10))

        validate_btn = _RefButton(main, "Validate License", kind="primary", width=460)
        validate_btn.pack(fill="x", pady=(4, 8))

        status = Label(main, text="", justify="center", wraplength=430)
        status.pack(fill="x", pady=(2, 2))
        progress = ProgressBar(main, width=430, height=8)
        progress.pack(fill="x", pady=(6, 0))
        details = Label(main, text="", justify="left", wraplength=430, size=9,
                        color=COL["text_muted"])
        details.pack(fill="x", pady=(6, 2))

        # OTP
        SectionLabel(main, GlobalMessage.get("ui_otp_label")).pack(pady=(14, 6))
        otp_row = tk.Frame(main, bg=COL["surface"])
        otp_row.pack(fill="x", pady=(0, 4))
        otp_entry = _RefEntry(otp_row, width=200, justify="center")
        otp_entry.pack(side="left", expand=True, fill="x")
        verify_btn = _RefButton(otp_row, "Verify", kind="success", width=122)
        verify_btn.pack(side="left", padx=(8, 0))

        resend_btn = _RefButton(main, "Resend OTP", kind="ghost", width=150)
        resend_btn.pack(anchor="w", pady=(6, 2))

        # Final action
        activate_btn = _RefButton(main, "Activate License", kind="primary", width=460)
        activate_btn.pack(fill="x", pady=(14, 6))
        cancel_btn = _RefButton(main, "Cancel", kind="ghost", width=460)
        cancel_btn.pack(fill="x", pady=(0, 0))

        # Initial disabled states
        otp_entry.state("disabled")
        verify_btn.set_state("disabled")
        resend_btn.set_state("disabled")
        activate_btn.set_state("disabled")

        STATUS_FG = {
            "success": COL["success"], "error": COL["error"],
            "warning": COL["warning"], "info": COL["primary"],
            "muted": COL["text_muted"], "neutral": COL["text"],
        }

        def _set_status(text: str, kind: str = "muted") -> None:
            status.config(text=text, fg=STATUS_FG.get(kind, COL["text"]))

        def _set_phase(text: str, kind: str = "neutral") -> None:
            phase.set_text(text, kind)

        def _cancel_otp():
            if self._otp_timer_id is not None:
                try:
                    self._root.after_cancel(self._otp_timer_id)
                except Exception:
                    pass
                self._otp_timer_id = None

        def _update_otp_timer():
            import time as _time
            _cancel_otp()
            remaining = int(self._otp_expires_at - _time.time())
            if remaining <= 0:
                self._otp_expires_at = 0.0
                _set_status(GlobalMessage.get("ui_otp_expired"), "error")
                _set_phase("OTP expired", "error")
                otp_entry.state("disabled")
                verify_btn.set_state("disabled")
                resend_btn.set_state("normal")
                return
            _set_status(
                GlobalMessage.get("ui_otp_expires_in", format_timer(remaining)),
                "info")
            self._otp_timer_id = self._root.after(1000, _update_otp_timer)

        def _validation_message(result: dict) -> str:
            status_kind = result.get("status", "")
            lic = result.get("license") or {}
            cust = result.get("customer") or {}
            err = result.get("error") or {}
            if result.get("new_customer") or not lic:
                if not cust.get("email"):
                    return GlobalMessage.get("ui_customer_not_found")
                return GlobalMessage.get("ui_license_not_found")
            if status_kind in ("not_found", "no_license", "unlicensed", ""):
                return GlobalMessage.get("ui_license_not_found")
            if status_kind in ("inactive", "deleted", "disabled"):
                return GlobalMessage.get("ui_license_inactive")
            if status_kind == "revoked":
                return GlobalMessage.get("ui_license_revoked")
            if status_kind == "expired":
                return GlobalMessage.get("ui_license_expired")
            msg = err.get("message") if isinstance(err, dict) else None
            if msg:
                return str(msg)  # pass through real server message verbatim (Rule 5)
            return GlobalMessage.get("validation_failed")

        def do_send_otp():
            if not self._validated:
                return
            email = self._email
            if not email:
                _set_status(GlobalMessage.get("otp_no_email"), "error")
                return
            resend_btn.set_state("disabled")
            _set_status(GlobalMessage.get("ui_sending_otp"), "info")
            _set_phase("Sending OTP", "info")
            try:
                result = self.engine.send_otp(email)
            except Exception as exc:
                _set_status(str(exc), "error")
                resend_btn.set_state("normal")
                return
            if result.get("success"):
                import time as _time
                self._otp_expires_at = _time.time() + int(result.get("expires_in", 300))
                otp_entry.state("normal")
                verify_btn.set_state("normal")
                resend_btn.set_state("normal")
                _set_phase("OTP sent", "success")
                _update_otp_timer()
            else:
                msg = result.get("message") or result.get("error") or "Failed to send OTP"
                _set_status(str(msg), "error")
                resend_btn.set_state("normal")

        def do_validate():
            key = key_entry.get().strip()
            if not key:
                _set_status(GlobalMessage.get("validation_key_required"), "error")
                _set_phase("Enter a key", "error")
                return
            validate_btn.set_state("disabled")
            validate_btn.set_text("Validating…")
            _set_status(GlobalMessage.get("ui_validating"), "info")
            _set_phase("Checking license", "info")
            progress.start()
            try:
                result = self.engine.validate_license_key(key)
            except Exception as exc:
                progress.stop()
                _set_status(str(exc), "error")
                validate_btn.set_state("normal")
                validate_btn.set_text("Validate License")
                return

            cust = result.get("customer") or {}
            lic = result.get("license") or {}
            api_status = result.get("status", "")

            if result.get("already_activated"):
                progress.stop()
                LiveLog.log("ALREADY_ACTIVATED",
                            "This device already has this license")
                _set_status(GlobalMessage.get("already_activated"), "success")
                _set_phase("Already activated", "success")
                try:
                    self.engine.refresh()
                except Exception:
                    pass
                activate_btn.set_state("normal")
                return

            if result.get("new_customer"):
                progress.stop()
                _set_status(GlobalMessage.get("ui_customer_not_found"), "warning")
                _set_phase("New customer", "warning")
                validate_btn.set_state("normal")
                validate_btn.set_text("Validate License")
                return

            if not result.get("validated"):
                progress.stop()
                msg = _validation_message(result)
                LiveLog.log("operation.error", msg)
                _set_status(msg, "error")
                _set_phase("Not validated", "error")
                validate_btn.set_state("normal")
                validate_btn.set_text("Validate License")
                otp_entry.state("disabled")
                verify_btn.set_state("disabled")
                resend_btn.set_state("disabled")
                activate_btn.set_state("disabled")
                self._validated = False
                return

            progress.stop()
            self._validated = True
            self._otp_verified = False
            self._email = cust.get("email", "")
            validate_btn.set_state("normal")
            validate_btn.set_text("Validate License")

            lines = []
            if cust.get("name"):
                lines.append("Customer: %s" % cust["name"])
            if self._email:
                lines.append("Email: %s" % self._email)
            if self.product_name:
                lines.append("Product: %s" % self.product_name)
            if lic.get("plan"):
                lines.append("Plan: %s" % lic["plan"])
            if lic.get("expiry_date"):
                lines.append("Expiry: %s" % lic["expiry_date"])
            rem = lic.get("days_remaining")
            if rem is None:
                rem = lic.get("days_left")
            if rem is not None:
                lines.append("Days remaining: %s" % rem)
            if not lines:
                lines.append(GlobalMessage.get("ui_license_active"))
            details.config(text="\n".join(lines))

            _set_status(GlobalMessage.get("ui_sending_otp"), "info")
            LiveLog.log("activation.validated", "License validated — auto-sending OTP")
            _set_phase("Validated", "success")
            do_send_otp()

        def do_verify():
            if not self._validated:
                return
            otp = otp_entry.get().strip()
            if not otp or len(otp) < 4:
                _set_status(GlobalMessage.get("otp_required"), "error")
                return
            verify_btn.set_state("disabled")
            verify_btn.set_text("Verifying…")
            try:
                result = self.engine.verify_otp(self._email, otp)
            except Exception as exc:
                _set_status(str(exc), "error")
                verify_btn.set_state("normal")
                verify_btn.set_text("Verify")
                return
            if result.get("success"):
                self._otp_verified = True
                verify_btn.set_state("normal")
                verify_btn.set_text("Verify")
                otp_entry.state("disabled")
                activate_btn.set_state("normal")
                _set_status(GlobalMessage.get("ui_otp_verified"), "success")
                _set_phase("OTP verified", "success")
            else:
                otp_entry.delete(0, "end")
                _set_status(GlobalMessage.get("ui_otp_invalid"), "error")
                verify_btn.set_state("normal")
                verify_btn.set_text("Verify")
                otp_entry.focus_set()

        def finish_success() -> None:
            steps = [
                (GlobalMessage.get("ui_creating_activation"), "info"),
                (GlobalMessage.get("ui_updating_license"), "info"),
                (GlobalMessage.get("ui_refreshing_license"), "info"),
                (GlobalMessage.get("ui_updating_application"), "info"),
            ]
            for text, kind in steps:
                _set_status(text, kind)
                _set_phase("In progress", "info")
                try:
                    self._root.update()
                except Exception:
                    pass
                self._root.after(110)
            progress.stop()
            _set_status(GlobalMessage.get("ui_activation_completed"), "success")
            _set_phase("Completed", "success")
            self._root.after(160)
            try:
                self.engine.refresh()
            except Exception:
                pass
            status_obj: Optional[LicenseStatus] = None
            try:
                status_obj = self.engine.get_status()
            except Exception:
                status_obj = None
            if status_obj is None:
                self._root.destroy()
                return
            LiveLog.log("Showing Success Dialog", "Operation: activation")
            from .universal_success_dialog import SuccessDialog
            try:
                SuccessDialog(
                    parent=self._root,
                    status=status_obj,
                    product_name=self.product_name,
                    operation="activation",
                    engine=self.engine,
                ).show()
            except Exception:
                try:
                    self._root.destroy()
                except Exception:
                    pass

        def do_activate():
            if not self._validated or not self._otp_verified:
                return
            key = key_entry.get().strip()
            activate_btn.set_state("disabled")
            activate_btn.set_text("Activating…")
            _set_status(GlobalMessage.get("ui_binding_hardware"), "info")
            _set_phase("Binding hardware", "info")
            progress.start()
            try:
                result = self.engine.activate(key)
            except Exception as exc:
                progress.stop()
                _set_status(str(exc), "error")
                activate_btn.set_state("normal")
                activate_btn.set_text("Activate License")
                return
            if result.get("success") or result.get("already_activated"):
                LiveLog.log("activation.success", "License activated on this device")
                finish_success()
            else:
                progress.stop()
                err = result.get("error") or result.get("data") or result
                msg = err.get("message") if isinstance(err, dict) else str(err)
                if not msg:
                    msg = (GlobalMessage.get("activation_failed") + " "
                           "Please contact support.")
                LiveLog.log("operation.error", msg)
                _set_status(str(msg), "error")
                _set_phase("Failed", "error")
                activate_btn.set_state("normal")
                activate_btn.set_text("Activate License")

        validate_btn._command = do_validate
        verify_btn._command = do_verify
        resend_btn._command = do_send_otp
        activate_btn._command = do_activate
        cancel_btn._command = self._on_closing
        key_entry.entry.bind("<Return>", lambda e: do_validate())
        otp_entry.entry.bind("<Return>", lambda e: do_verify())
        self._root.after(60, key_entry.focus_set)
        self._root.wait_window()
        return {"activated": bool(self._validated and self._otp_verified)}

    # -------------------------------------------------------------------
    def _on_closing(self):
        if self._root is not None:
            try:
                self._root.destroy()
            except Exception:
                pass

    def _on_cancel(self):
        self._on_closing()