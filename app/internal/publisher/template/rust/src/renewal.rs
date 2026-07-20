use std::io::{self, BufRead, Write};

use crate::license_engine::LicenseEngine;

pub struct RenewalDialog;

impl RenewalDialog {
    pub fn show(engine: &mut LicenseEngine, license_key: &str) -> Result<RenewalResult, String> {
        let stdin = io::stdin();
        let mut stdout = io::stdout();

        let _ = writeln!(stdout, "{}", "=".repeat(60));
        let _ = writeln!(stdout, "RENEW LICENSE");
        let _ = writeln!(stdout, "{}", "=".repeat(60));

        if !license_key.is_empty() {
            let _ = writeln!(stdout, "License Key: {}", license_key);
        }

        let status = engine.get_status_cloned();
        if let Some(ref s) = status {
            let _ = writeln!(stdout, "Current Plan: {}", s.plan.as_deref().unwrap_or("--"));
            let _ = writeln!(stdout, "Expires: {}", s.expires_at.as_deref().unwrap_or("--"));
        }

        let _ = writeln!(stdout);
        let _ = write!(stdout, "Enter extra days to renew (or press Enter for default): ");
        let _ = stdout.flush();

        let mut input = String::new();
        stdin.lock().read_line(&mut input).map_err(|e| e.to_string())?;
        let input = input.trim().to_string();

        engine.license_key = Some(license_key.to_string());

        let result = if !input.is_empty() {
            if let Ok(days) = input.parse::<u32>() {
                engine.renew_with_days(days)
            } else {
                engine.renew()
            }
        } else {
            engine.renew()
        };

        match result {
            Ok(res) => {
                if res.get("success").and_then(|v| v.as_bool()).unwrap_or(false) {
                    let _ = writeln!(stdout, "License renewed successfully!");
                    Ok(RenewalResult { action: "renewed".to_string() })
                } else {
                    let msg = res.get("message").and_then(|v| v.as_str()).unwrap_or("Renewal failed");
                    let _ = writeln!(stdout, "Renewal failed: {}", msg);
                    Ok(RenewalResult { action: "failed".to_string() })
                }
            }
            Err(e) => {
                let _ = writeln!(stdout, "Renewal failed: {}", e);
                Ok(RenewalResult { action: "failed".to_string() })
            }
        }
    }
}

pub struct RenewalResult {
    pub action: String,
}
