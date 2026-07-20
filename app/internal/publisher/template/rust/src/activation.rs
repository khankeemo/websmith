use std::io::{self, BufRead, Write};

use crate::license_engine::LicenseEngine;

pub struct ActivationDialog;

impl ActivationDialog {
    pub fn show(engine: &mut LicenseEngine) -> Result<ActivationResult, String> {
        let stdin = io::stdin();
        let mut stdout = io::stdout();

        let _ = writeln!(stdout, "{}", "=".repeat(60));
        let _ = writeln!(stdout, "UNIVERSAL LICENSE ACTIVATION");
        if !engine.product_name.is_empty() {
            let _ = writeln!(stdout, "Product: {}", engine.product_name);
        }
        let _ = writeln!(stdout, "{}", "=".repeat(60));

        let hw_id = engine.get_hardware_id();
        let _ = writeln!(stdout, "Hardware ID: {}", hw_id);
        let _ = writeln!(stdout);

        let _ = write!(stdout, "Enter license key: ");
        let _ = stdout.flush();

        let mut key = String::new();
        stdin.lock().read_line(&mut key).map_err(|e| e.to_string())?;
        let key = key.trim().to_string();

        if key.is_empty() {
            let _ = writeln!(stdout, "No license key entered. Activation cancelled.");
            return Ok(ActivationResult {
                activated: false,
                cancelled: true,
                license_key: None,
            });
        }

        let _ = writeln!(stdout, "Activating license...");
        let _ = stdout.flush();

        match engine.activate(&key) {
            Ok(result) => {
                if result.get("success").and_then(|v| v.as_bool()).unwrap_or(false) {
                    let _ = writeln!(stdout, "License activated successfully!");
                    Ok(ActivationResult {
                        activated: true,
                        cancelled: false,
                        license_key: Some(key),
                    })
                } else {
                    let msg = result.get("message")
                        .or_else(|| result.get("error"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("Activation failed");
                    let _ = writeln!(stdout, "Activation failed: {}", msg);
                    Ok(ActivationResult {
                        activated: false,
                        cancelled: false,
                        license_key: Some(key),
                    })
                }
            }
            Err(e) => {
                let _ = writeln!(stdout, "Activation failed: {}", e);
                Ok(ActivationResult {
                    activated: false,
                    cancelled: false,
                    license_key: Some(key),
                })
            }
        }
    }
}

pub struct ActivationResult {
    pub activated: bool,
    pub cancelled: bool,
    pub license_key: Option<String>,
}
