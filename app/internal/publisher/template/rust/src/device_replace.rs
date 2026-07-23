use crate::license_engine::LicenseEngine;

pub struct DeviceReplaceDialog;

impl DeviceReplaceDialog {
    pub fn show(engine: &mut LicenseEngine, _license_key: &str) -> Result<DeviceReplaceResult, String> {
        let support_email = engine.config.as_ref()
            .and_then(|c| c.get("branding"))
            .and_then(|b| b.get("support_email"))
            .and_then(|v| v.as_str())
            .unwrap_or("support@websmithdigital.com")
            .to_string();

        println!("{}", "=".repeat(60));
        println!("REPLACE DEVICE");
        println!("{}", "=".repeat(60));
        println!();
        println!("Device reactivation requires Websmith Support approval.");
        println!();
        println!("Please contact support at: {}", support_email);
        println!("The application will remain locked until reactivation is approved.");
        println!();

        Ok(DeviceReplaceResult {
            action: "contact_support".to_string(),
        })
    }
}

pub struct DeviceReplaceResult {
    pub action: String,
}
