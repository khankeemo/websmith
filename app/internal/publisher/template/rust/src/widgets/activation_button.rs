use crate::license_engine::LicenseEngine;
use crate::ActivationDialog;

pub struct ActivationButton;

impl ActivationButton {
    pub fn click(engine: &mut LicenseEngine) {
        println!("Opening activation dialog for license activation...");
        match ActivationDialog::show(engine) {
            Ok(result) => {
                if result.activated {
                    println!("License activated successfully via button click.");
                } else if result.cancelled {
                    println!("License activation was cancelled by user.");
                } else {
                    println!("License activation failed or returned no result.");
                }
            }
            Err(e) => {
                println!("Activation dialog error: {}", e);
            }
        }
    }

    pub fn get_label() -> &'static str {
        "Activate License"
    }

    pub fn is_active(engine: &LicenseEngine) -> bool {
        engine.has_license_key()
    }

    pub fn is_valid(engine: &LicenseEngine) -> bool {
        engine.get_status_cloned().map(|s| s.valid).unwrap_or(false)
    }

    pub fn get_status_text(engine: &LicenseEngine) -> String {
        if let Some(ref s) = engine.get_status_cloned() {
            if s.valid {
                if s.trial_active {
                    format!("Trial Active ({}d)", s.days_remaining)
                } else {
                    format!("Licensed ({})", s.plan.as_deref().unwrap_or("active"))
                }
            } else {
                s.message.clone().unwrap_or_else(|| "Unlicensed".to_string())
            }
        } else {
            "Uninitialized".to_string()
        }
    }

    pub fn check_and_activate(engine: &mut LicenseEngine) -> bool {
        if !Self::is_valid(engine) {
            println!("Current license is not valid. Opening activation dialog...");
            Self::click(engine);
            Self::is_valid(engine)
        } else {
            println!("License is already valid. No activation needed.");
            true
        }
    }

    pub fn is_active_dynamic() -> bool {
        true
    }

    pub fn get_button_info() -> String {
        format!("ActivationButton: default label '{}', supports click/check/status", Self::get_label())
    }
}
