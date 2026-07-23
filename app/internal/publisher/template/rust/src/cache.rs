use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone)]
pub struct CacheManager {
    cache_dir: PathBuf,
    cache_file: PathBuf,
    tmp_file: PathBuf,
    corrupt_file: PathBuf,
    ttl_days: u32,
    data: Option<HashMap<String, CacheEntry>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CacheEntry {
    value: serde_json::Value,
    cached_at: f64,
}

impl CacheManager {
    pub fn new(config: &crate::Config) -> Self {
        let product_id = &config.product.id;
        let safe_name: String = product_id
            .chars()
            .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
            .collect();
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        let cache_dir = home.join(".websmith").join(&safe_name);
        let cache_file = cache_dir.join("cache.json");
        let tmp_file = cache_dir.join("cache.tmp");
        let corrupt_file = cache_dir.join("cache.corrupt");
        let ttl_days = config.offline.cache_days;
        Self {
            cache_dir,
            cache_file,
            tmp_file,
            corrupt_file,
            ttl_days,
            data: None,
        }
    }

    fn ensure_dir(&self) -> std::io::Result<()> {
        fs::create_dir_all(&self.cache_dir)
    }

    fn now_epoch() -> f64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs_f64()
    }

    fn load_cache(&mut self) -> &HashMap<String, CacheEntry> {
        if self.data.is_some() {
            return self.data.as_ref().unwrap();
        }
        let _ = self.ensure_dir();
        if !self.cache_file.exists() {
            self.data = Some(HashMap::new());
            return self.data.as_ref().unwrap();
        }
        match fs::read_to_string(&self.cache_file) {
            Ok(content) => {
                match serde_json::from_str::<HashMap<String, CacheEntry>>(&content) {
                    Ok(map) => {
                        self.data = Some(map);
                    }
                    Err(_) => {
                        self.preserve_corrupt();
                        self.data = Some(HashMap::new());
                    }
                }
            }
            Err(_) => {
                self.data = Some(HashMap::new());
            }
        }
        self.data.as_ref().unwrap()
    }

    fn preserve_corrupt(&self) {
        if self.cache_file.exists() {
            if self.corrupt_file.exists() {
                let _ = fs::remove_file(&self.corrupt_file);
            }
            let _ = fs::rename(&self.cache_file, &self.corrupt_file);
        }
    }

    fn save_cache(&mut self) -> std::io::Result<()> {
        if self.data.is_none() {
            return Ok(());
        }
        self.ensure_dir()?;
        let json_str = serde_json::to_string_pretty(self.data.as_ref().unwrap())
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
        fs::write(&self.tmp_file, &json_str)?;
        fs::rename(&self.tmp_file, &self.cache_file)?;
        Ok(())
    }

    pub fn get(&mut self, key: &str) -> Option<serde_json::Value> {
        let cache = self.load_cache();
        let entry = cache.get(key)?;
        if self.is_expired(entry) {
            drop(cache);
            self.delete(key);
            return None;
        }
        Some(entry.value.clone())
    }

    pub fn set(&mut self, key: &str, value: serde_json::Value) {
        self.load_cache();
        let entry = CacheEntry {
            value,
            cached_at: Self::now_epoch(),
        };
        self.data.as_mut().unwrap().insert(key.to_string(), entry);
        let _ = self.save_cache();
    }

    pub fn delete(&mut self, key: &str) {
        self.load_cache();
        self.data.as_mut().unwrap().remove(key);
        let _ = self.save_cache();
    }

    pub fn clear(&mut self) {
        self.data = Some(HashMap::new());
        let _ = self.save_cache();
    }

    fn is_expired(&self, entry: &CacheEntry) -> bool {
        let ttl_seconds = self.ttl_days as f64 * 24.0 * 60.0 * 60.0;
        Self::now_epoch() - entry.cached_at > ttl_seconds
    }

    pub fn is_valid(&mut self) -> bool {
        let cache = self.load_cache();
        match cache.get("license_status") {
            Some(entry) => !self.is_expired(entry),
            None => false,
        }
    }

    pub fn exists(&self) -> bool {
        self.cache_file.exists()
    }

    pub fn get_license_status(&mut self) -> Option<serde_json::Value> {
        self.get("license_status")
    }

    pub fn set_license_status(&mut self, status: serde_json::Value) {
        self.set("license_status", status);
    }

    pub fn invalidate_license_status(&mut self) {
        self.delete("license_status");
    }

    pub fn set_onboarding_complete(&mut self) {
        self.set("onboarding_complete", serde_json::json!(true));
    }

    pub fn is_onboarding_complete(&mut self) -> bool {
        self.get("onboarding_complete")
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
    }

    pub fn mark_has_ever_activated_paid_license(&mut self) {
        self.set("has_ever_activated_paid_license", serde_json::json!(true));
    }

    pub fn has_ever_activated_paid_license(&mut self) -> bool {
        self.get("has_ever_activated_paid_license")
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
    }
}
