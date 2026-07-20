use std::io::{self, BufRead, Write};

use crate::license_engine::LicenseEngine;

pub struct WelcomeDialog;

impl WelcomeDialog {
    pub fn show(engine: &mut LicenseEngine) -> Result<Option<WelcomeResult>, String> {
        if engine.is_onboarding_complete() {
            let _ = writeln!(io::stdout(), "Onboarding already completed.");
            return Ok(None);
        }
        if !engine.config.trial.enabled {
            let _ = writeln!(io::stdout(), "Trial onboarding is not enabled.");
            return Ok(None);
        }

        let stdin = io::stdin();
        let mut stdout = io::stdout();

        let _ = writeln!(stdout, "{}", "=".repeat(60));
        let title = if engine.product_name.is_empty() {
            engine.config.product.name.clone()
        } else {
            engine.product_name.clone()
        };
        let title = if title.is_empty() { "Software".to_string() } else { title };
        let _ = writeln!(stdout, "Welcome to {}", title);
        let _ = writeln!(stdout, "Complete your registration to start the trial");
        let _ = writeln!(stdout, "{}", "=".repeat(60));

        let _ = write!(stdout, "Name *: ");
        let _ = stdout.flush();
        let mut name = String::new();
        stdin.lock().read_line(&mut name).map_err(|e| e.to_string())?;
        let name = name.trim().to_string();
        if name.is_empty() {
            let _ = writeln!(stdout, "Name is required.");
            return Ok(None);
        }

        let _ = write!(stdout, "Email *: ");
        let _ = stdout.flush();
        let mut email = String::new();
        stdin.lock().read_line(&mut email).map_err(|e| e.to_string())?;
        let email = email.trim().to_string();
        if email.is_empty() || !email.contains('@') {
            let _ = writeln!(stdout, "Valid email is required.");
            return Ok(None);
        }

        let _ = write!(stdout, "Mobile Number *: ");
        let _ = stdout.flush();
        let mut mobile = String::new();
        stdin.lock().read_line(&mut mobile).map_err(|e| e.to_string())?;
        let mobile = mobile.trim().to_string();
        if mobile.is_empty() || mobile.len() < 4 {
            let _ = writeln!(stdout, "Valid mobile number is required.");
            return Ok(None);
        }

        let _ = write!(stdout, "Company (optional): ");
        let _ = stdout.flush();
        let mut company = String::new();
        stdin.lock().read_line(&mut company).map_err(|e| e.to_string())?;
        let company = company.trim().to_string();

        let _ = writeln!(stdout);
        let _ = writeln!(stdout, "Sending OTP to your email...");
        let _ = stdout.flush();

        let otp_payload = serde_json::json!({"email": email});
        let _ = engine.client.request("auth/otp/send", otp_payload);

        let _ = write!(stdout, "Enter OTP (or press Enter to skip): ");
        let _ = stdout.flush();
        let mut otp = String::new();
        stdin.lock().read_line(&mut otp).map_err(|e| e.to_string())?;
        let otp = otp.trim().to_string();

        if !otp.is_empty() {
            let verify_payload = serde_json::json!({"email": email, "otp": otp});
            match engine.client.request("auth/otp/verify", verify_payload) {
                Ok(res) => {
                    if res.get("success").and_then(|v| v.as_bool()).unwrap_or(false) {
                        let _ = writeln!(stdout, "OTP verified!");
                    }
                }
                Err(_) => {
                    let _ = writeln!(stdout, "OTP verification failed, but continuing...");
                }
            }
        }

        let _ = writeln!(stdout, "Activating trial...");
        let _ = stdout.flush();

        let hardware_id = engine.get_hardware_id();

        let register_payload = serde_json::json!({
            "name": name,
            "email": email,
            "mobile": mobile,
            "hardware_id": hardware_id,
        });
        let _ = engine.client.request("customer/register", register_payload);

        let mut customer_data = serde_json::json!({
            "mobile": mobile,
            "hardware_id": hardware_id,
        });
        if !company.is_empty() {
            customer_data["company_name"] = serde_json::json!(company);
        }

        match engine.start_trial(&email, &name, Some(customer_data)) {
            Ok(result) => {
                if result.get("success").and_then(|v| v.as_bool()).unwrap_or(false) {
                    engine.set_onboarding_complete();
                    let _ = writeln!(stdout, "Trial activated! You can now use the software.");
                    Ok(Some(WelcomeResult {
                        name,
                        email,
                        hardware_id,
                        onboarding_complete: true,
                    }))
                } else {
                    let _ = writeln!(stdout, "Trial activation had issues, but setup completed.");
                    engine.set_onboarding_complete();
                    Ok(Some(WelcomeResult {
                        name,
                        email,
                        hardware_id,
                        onboarding_complete: true,
                    }))
                }
            }
            Err(e) => {
                let _ = writeln!(stdout, "Trial activation failed: {}", e);
                Ok(Some(WelcomeResult {
                    name,
                    email,
                    hardware_id,
                    onboarding_complete: false,
                }))
            }
        }
    }
}

pub struct WelcomeResult {
    pub name: String,
    pub email: String,
    pub hardware_id: String,
    pub onboarding_complete: bool,
}
