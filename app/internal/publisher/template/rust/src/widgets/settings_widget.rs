use crate::license_engine::LicenseEngine;
use crate::{ActivationDialog, DeviceReplaceDialog, RenewalDialog, WelcomeDialog};

pub struct SettingsWidget {
    engine: *mut LicenseEngine,
}

impl SettingsWidget {
    pub fn new(engine: &mut LicenseEngine) -> Self {
        Self {
            engine: engine as *mut LicenseEngine,
        }
    }

    pub fn render_info(&mut self) -> String {
        self.refresh();
        let engine = unsafe { &mut *self.engine };
        let mut output = String::new();
        if let Some(ref s) = engine.get_status_cloned() {
            output.push_str(&format!("Status: {}\n", s.status));
            if let Some(ref hw) = s.hardware_id {
                output.push_str(&format!("Hardware ID: {}\n", hw));
            }
            if let Some(ref exp) = s.expires_at {
                output.push_str(&format!("Expiry: {}\n", exp));
            }
            if let Some(ref plan) = s.plan {
                output.push_str(&format!("Plan: {}\n", plan));
            }
        }
        if let Some(ref lk) = engine.license_key {
            output.push_str(&format!("License Key: {}\n", lk));
        }
        output
    }

    pub fn refresh(&mut self) {
        let engine = unsafe { &mut *self.engine };
        engine.initialize();
    }

    pub fn open_activation(&mut self) {
        let engine = unsafe { &mut *self.engine };
        let _ = ActivationDialog::show(engine);
        self.refresh();
    }

    pub fn open_renewal(&mut self) {
        let engine = unsafe { &mut *self.engine };
        if let Some(ref key) = engine.license_key.clone() {
            let _ = RenewalDialog::show(engine, key);
            self.refresh();
        }
    }

    pub fn open_replace(&mut self) {
        let engine = unsafe { &mut *self.engine };
        if let Some(ref key) = engine.license_key.clone() {
            let _ = DeviceReplaceDialog::show(engine, key);
            self.refresh();
        }
    }

    pub fn open_welcome(&mut self) {
        let engine = unsafe { &mut *self.engine };
        let _ = WelcomeDialog::show(engine);
        self.refresh();
    }
}
