use sha2::{Digest, Sha256};
use std::collections::HashMap;

pub struct HardwareDetector {
    fingerprint: Option<String>,
    identifiers: Option<HashMap<String, String>>,
}

impl HardwareDetector {
    pub fn new() -> Self {
        Self {
            fingerprint: None,
            identifiers: None,
        }
    }

    pub fn get_fingerprint(&mut self) -> String {
        if let Some(ref fp) = self.fingerprint {
            return fp.clone();
        }
        let identifiers = self.collect_identifiers();
        let combined = self.build_combined_string(&identifiers);
        let fp = self.hash_identifiers(&combined);
        self.fingerprint = Some(fp.clone());
        self.identifiers = Some(identifiers);
        fp
    }

    pub fn get_identifiers(&mut self) -> HashMap<String, String> {
        if self.identifiers.is_none() {
            self.get_fingerprint();
        }
        self.identifiers.clone().unwrap_or_default()
    }

    fn collect_identifiers(&self) -> HashMap<String, String> {
        let mut identifiers = HashMap::new();
        if let Some(cpu_id) = self.get_cpu_id() {
            identifiers.insert("cpu_id".to_string(), cpu_id);
        }
        if let Some(mb_id) = self.get_motherboard_id() {
            identifiers.insert("motherboard_id".to_string(), mb_id);
        }
        if !identifiers.contains_key("motherboard_id") {
            if let Some(net_id) = self.get_network_id() {
                identifiers.insert("network_id".to_string(), net_id);
            }
        }
        if let Some(os_info) = self.get_os_info() {
            identifiers.insert("os_info".to_string(), os_info);
        }
        identifiers
    }

    fn get_cpu_id(&self) -> Option<String> {
        #[cfg(target_os = "windows")]
        {
            if let Ok(out) = std::process::Command::new("wmic")
                .args(["cpu", "get", "ProcessorId", "/value"])
                .output()
            {
                let output = String::from_utf8_lossy(&out.stdout);
                for line in output.lines() {
                    let line = line.trim();
                    if let Some(val) = line.strip_prefix("ProcessorId=") {
                        let val = val.trim().to_string();
                        if !val.is_empty() {
                            return Some(val);
                        }
                    }
                }
            }
        }
        #[cfg(target_os = "macos")]
        {
            if let Ok(out) = std::process::Command::new("sysctl")
                .args(["-n", "hw.model"])
                .output()
            {
                let model = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if !model.is_empty() {
                    return Some(format!("mac-{}", model));
                }
            }
            if let Ok(out) = std::process::Command::new("sysctl")
                .args(["-n", "machdep.cpu.brand_string"])
                .output()
            {
                let brand = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if !brand.is_empty() {
                    let mut hasher = Sha256::new();
                    hasher.update(brand.as_bytes());
                    let hash = hex::encode(hasher.finalize());
                    return Some(hash[..16].to_string());
                }
            }
        }
        #[cfg(target_os = "linux")]
        {
            if let Ok(content) = std::fs::read_to_string("/proc/cpuinfo") {
                for line in content.lines() {
                    let line = line.trim();
                    if let Some(val) = line.strip_prefix("Serial").and_then(|s| s.split(':').nth(1)) {
                        let val = val.trim();
                        if !val.is_empty() {
                            return Some(format!("cpu-{}", val));
                        }
                    }
                }
                let mut vendor = String::new();
                let mut family = String::new();
                for line in content.lines() {
                    let line = line.trim();
                    if line.starts_with("vendor_id") {
                        if let Some(val) = line.split(':').nth(1) {
                            vendor = val.trim().to_string();
                        }
                    } else if line.starts_with("cpu family") {
                        if let Some(val) = line.split(':').nth(1) {
                            family = val.trim().to_string();
                        }
                    }
                }
                if !vendor.is_empty() && !family.is_empty() {
                    return Some(format!("{}-{}", vendor, family));
                }
            }
        }
        None
    }

    fn get_motherboard_id(&self) -> Option<String> {
        #[cfg(target_os = "windows")]
        {
            if let Ok(out) = std::process::Command::new("wmic")
                .args(["baseboard", "get", "SerialNumber", "/value"])
                .output()
            {
                let output = String::from_utf8_lossy(&out.stdout);
                for line in output.lines() {
                    let line = line.trim();
                    if let Some(val) = line.strip_prefix("SerialNumber=") {
                        let val = val.trim().to_string();
                        if !val.is_empty()
                            && val != "To be filled by O.E.M."
                            && val != "Default string"
                        {
                            return Some(format!("mb-{}", val));
                        }
                    }
                }
            }
        }
        #[cfg(target_os = "linux")]
        {
            if let Ok(out) = std::process::Command::new("dmidecode")
                .args(["-s", "baseboard-serial-number"])
                .output()
            {
                let serial = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if !serial.is_empty()
                    && serial != "To be filled by O.E.M."
                    && serial != "Default string"
                {
                    return Some(format!("mb-{}", serial));
                }
            }
        }
        None
    }

    fn get_network_id(&self) -> Option<String> {
        if let Ok(Some(mac)) = mac_address::get_mac_address() {
            let mac_str = mac.to_string();
            let mut hasher = Sha256::new();
            hasher.update(format!("net-{}", mac_str).as_bytes());
            let hash = hex::encode(hasher.finalize());
            return Some(hash[..16].to_string());
        }
        None
    }

    fn get_os_info(&self) -> Option<String> {
        Some(format!(
            "{}-{}",
            std::env::consts::OS,
            std::env::consts::ARCH
        ))
    }

    fn build_combined_string(&self, identifiers: &HashMap<String, String>) -> String {
        let order = ["cpu_id", "motherboard_id", "network_id"];
        let parts: Vec<&str> = order
            .iter()
            .filter_map(|k| identifiers.get(*k).map(|s| s.as_str()))
            .collect();
        parts.join("|")
    }

    fn hash_identifiers(&self, data: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(data.as_bytes());
        hex::encode(hasher.finalize())
    }
}

impl Default for HardwareDetector {
    fn default() -> Self {
        Self::new()
    }
}
