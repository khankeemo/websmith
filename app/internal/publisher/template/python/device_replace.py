"""Device Replacement Dialog for ${product_name} — contact support"""
import tkinter as tk
from typing import Optional, Dict, Any


class DeviceReplaceDialog:
    def __init__(self, engine, license_key: str, parent=None):
        self.engine=engine; self.config=getattr(engine,'config',{})
        self._parent=parent
        self.license_key=license_key; self.engine._license_key=license_key
        self.result=None; self.root=None

    def show(self)->Optional[Dict[str,Any]]:
        self._build_ui(); self.root.mainloop(); return self.result

    def _build_ui(self):
        branding=self.config.get('branding',{}); colors = branding.get('colors', {})
        primary=colors.get('primary', branding.get('primary_color','#6366f1')); bg=colors.get('bg_page','#f8f9fa')
        labels=branding.get('labels',{})
        support_email = branding.get('support_email', 'support@websmithdigital.com')
        if not self._parent:
            raise RuntimeError("SDK dialogs require the application root window as parent")
        self.root = tk.Toplevel(self._parent)
        self.root.transient(self._parent)
        self.root.grab_set()
        self.root.title(labels.get('replace_title', "Device Replacement")); self.root.geometry("420x280")
        self.root.resizable(False,False); self.root.configure(bg=bg)
        self.root.update_idletasks()
        sw=self.root.winfo_screenwidth(); sh=self.root.winfo_screenheight(); w=self.root.winfo_width(); h=self.root.winfo_height()
        self.root.geometry(f"+{(sw-w)//2}+{(sh-h)//2}")
        header=tk.Frame(self.root,bg=primary,height=60); header.pack(fill=tk.X); header.pack_propagate(False)
        tk.Label(header,text=labels.get('replace_title', "Device Replacement"),fg="white",bg=primary,font=("Helvetica",16,"bold")).pack(expand=True)
        form=tk.Frame(self.root,bg=bg,padx=25,pady=15); form.pack(fill=tk.BOTH,expand=True)
        tk.Label(form,text=labels.get('device_replace_section', "Device Replacement"),
                 font=("Helvetica",11,"bold"),bg=bg,fg=colors.get('text_primary','#333')).pack(anchor=tk.W,pady=(0,10))
        tk.Label(form,text=labels.get('device_replace_contact', 'Device replacement is handled by Websmith Support. Please contact:'),
                 font=("Helvetica",10),bg=bg,fg=colors.get('text_secondary','#555'),wraplength=360,justify='left').pack(anchor=tk.W,pady=(0,8))
        email_frame = tk.Frame(form,bg=colors.get('bg_card','#ffffff'),highlightbackground=colors.get('border','#d1d5db'),highlightthickness=1)
        email_frame.pack(fill=tk.X,pady=(0,15))
        tk.Label(email_frame,text=support_email,font=("Courier",11,"bold"),bg=colors.get('bg_card','#ffffff'),fg=primary).pack(padx=12,pady=8)
        btn_frame = tk.Frame(form,bg=bg); btn_frame.pack(fill=tk.X)
        close_btn = tk.Button(btn_frame,text=labels.get('cancel_btn', 'Close'),command=self.root.destroy,
                               font=("Helvetica",11),bg=colors.get('bg_button','#e5e7eb'),fg=colors.get('text_primary','#333'),relief=tk.FLAT,padx=15,pady=6)
        close_btn.pack(side=tk.LEFT,padx=(0,8))
        def copy_email():
            self.root.clipboard_clear(); self.root.clipboard_append(support_email)
            close_btn.config(text=labels.get('copied_text', 'Copied!'),fg=colors.get('success','#16a34a'))
            self.root.after(1500, lambda: close_btn.config(text=labels.get('cancel_btn', 'Close'),fg=colors.get('text_primary','#333')))
        copy_btn = tk.Button(btn_frame,text=labels.get('copy_email_btn', 'Copy Email'),command=copy_email,
                              font=("Helvetica",11),bg=primary,fg="white",relief=tk.FLAT,padx=15,pady=6)
        copy_btn.pack(side=tk.LEFT)
        self.root.bind('<Escape>',lambda e:self.root.destroy())
