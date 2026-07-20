use crate::license_engine::LicenseEngine;

pub struct StatusWidget {
    engine: *mut LicenseEngine,
    label: String,
    active: bool,
}

impl StatusWidget {
    pub fn new(engine: &mut LicenseEngine) -> Self {
        Self {
            engine: engine as *mut LicenseEngine,
            label: String::new(),
            active: false,
        }
    }

    pub fn get_status_line(&mut self) -> String {
        self.refresh();
        let engine = unsafe { &mut *self.engine };
        if let Some(ref s) = engine.get_status_cloned() {
            if s.valid {
                if s.trial_active {
                    format!("Trial: {}d", s.days_remaining)
                } else {
                    format!("Licensed: {}d", s.days_remaining)
                }
            } else {
                s.message.clone().unwrap_or_else(|| "No license".to_string())
            }
        } else {
            "No license".to_string()
        }
    }

    pub fn refresh(&mut self) {
        let engine = unsafe { &mut *self.engine };
        let s = engine.get_status_cloned().unwrap_or_else(|| engine.initialize());
        if s.valid {
            if s.trial_active {
                self.label = format!("Trial: {}d", s.days_remaining);
            } else {
                self.label = format!("Licensed: {}d", s.days_remaining);
            }
            self.active = true;
        } else {
            self.label = s.message.unwrap_or_else(|| "No license".to_string());
            self.active = false;
        }
    }

    pub fn is_active(&self) -> bool {
        self.active
    }

    pub fn get_label(&self) -> &str {
        &self.label
    }
}
