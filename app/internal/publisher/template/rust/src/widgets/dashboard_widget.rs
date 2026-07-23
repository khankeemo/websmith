use crate::license_engine::LicenseEngine;

pub struct DashboardWidget {
    engine: *mut LicenseEngine,
    status: String,
    days_left: u32,
    expiry: String,
    plan: String,
}

impl DashboardWidget {
    pub fn new(engine: &mut LicenseEngine) -> Self {
        Self {
            engine: engine as *mut LicenseEngine,
            status: String::new(),
            days_left: 0,
            expiry: String::new(),
            plan: String::new(),
        }
    }

    pub fn render(&mut self) -> String {
        self.refresh();
        let mut output = String::new();
        output.push_str(&format!("License Status: {}\n", self.status));
        if self.days_left > 0 {
            output.push_str(&format!("Days Remaining: {}\n", self.days_left));
        }
        if !self.expiry.is_empty() {
            output.push_str(&format!("Expiry: {}\n", self.expiry));
        }
        if !self.plan.is_empty() {
            output.push_str(&format!("Plan: {}\n", self.plan));
        }
        output
    }

    pub fn refresh(&mut self) {
        let engine = unsafe { &mut *self.engine };
        let s = engine.get_status_cloned().unwrap_or_else(|| engine.initialize());
        if s.valid && (s.status == "active" || s.status == "trial" || s.status == "trial_active") {
            self.status = if s.trial_active {
                "Trial Active".to_string()
            } else {
                "Active".to_string()
            };
            self.days_left = s.days_remaining;
            self.expiry = s.expires_at.unwrap_or_default();
            self.plan = s.plan.unwrap_or_default();
        } else {
            self.status = "Unlicensed".to_string();
            self.days_left = 0;
            self.expiry.clear();
            self.plan.clear();
        }
    }

    pub fn get_status(&self) -> &str {
        &self.status
    }

    pub fn get_days_left(&self) -> u32 {
        self.days_left
    }
}
