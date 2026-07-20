use std::io::{self, BufRead, Write};

use crate::license_engine::LicenseEngine;

pub struct DeviceReplaceDialog;

impl DeviceReplaceDialog {
    pub fn show(engine: &mut LicenseEngine, license_key: &str) -> Result<DeviceReplaceResult, String> {
        let stdin = io::stdin();
        let mut stdout = io::stdout();

        let _ = writeln!(stdout, "{}", "=".repeat(60));
        let _ = writeln!(stdout, "REPLACE DEVICE");
        let _ = writeln!(stdout, "{}", "=".repeat(60));

        if !license_key.is_empty() {
            let _ = writeln!(stdout, "License Key: {}", license_key);
        }

        let old_hw = engine.get_hardware_id();
        let _ = writeln!(stdout, "New Hardware ID: {}", old_hw);

        let old_hw_from_status = {
            let status = engine.get_status_cloned();
            status.as_ref().and_then(|s| s.hardware_id.clone())
        };
        match old_hw_from_status {
            Some(ref hw) => {
                let _ = writeln!(stdout, "Old Hardware ID: {}", hw);
            }
            None => {
                let _ = writeln!(stdout, "Old Hardware ID: Unknown");
            }
        }

        let _ = writeln!(stdout);
        let _ = write!(stdout, "Enter device name (optional): ");
        let _ = stdout.flush();

        let mut dev_name = String::new();
        stdin.lock().read_line(&mut dev_name).map_err(|e| e.to_string())?;
        let dev_name = dev_name.trim().to_string();

        let _ = write!(stdout, "Proceed with device replacement? (y/N): ");
        let _ = stdout.flush();

        let mut confirm = String::new();
        stdin.lock().read_line(&mut confirm).map_err(|e| e.to_string())?;
        let confirm = confirm.trim().to_lowercase();

        if confirm != "y" && confirm != "yes" {
            let _ = writeln!(stdout, "Device replacement cancelled.");
            return Ok(DeviceReplaceResult { action: "cancelled".to_string() });
        }

        let _ = writeln!(stdout, "Replacing device...");
        let _ = stdout.flush();

        engine.license_key = Some(license_key.to_string());

        match engine.replace_hardware() {
            Ok(result) => {
                if result.get("success").and_then(|v| v.as_bool()).unwrap_or(false) {
                    let _ = writeln!(stdout, "Device replaced successfully!");
                    if !dev_name.is_empty() {
                        let _ = engine.bind_device("", &dev_name);
                    }
                    Ok(DeviceReplaceResult { action: "device_replaced".to_string() })
                } else {
                    let msg = result.get("message").and_then(|v| v.as_str()).unwrap_or("Device replacement failed");
                    let _ = writeln!(stdout, "Device replacement failed: {}", msg);
                    Ok(DeviceReplaceResult { action: "failed".to_string() })
                }
            }
            Err(e) => {
                let _ = writeln!(stdout, "Device replacement failed: {}", e);
                Ok(DeviceReplaceResult { action: "failed".to_string() })
            }
        }
    }
}

pub struct DeviceReplaceResult {
    pub action: String,
}
