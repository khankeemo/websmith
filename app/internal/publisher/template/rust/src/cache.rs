use std::fs;
use std::io;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone)]
pub struct CacheManager {
    cache_dir: PathBuf,
    cache_file: PathBuf,
    tmp_file: PathBuf,
    ttl_seconds: u64,
}

impl CacheManager {
    pub fn new(product_id: &str, ttl_seconds: u64) -> Self {
        let safe_id: String = product_id
            .chars()
            .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
            .collect();
        let mut cache_dir = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        cache_dir.push(".websmith");
        cache_dir.push(&safe_id);
        let cache_file = cache_dir.join("cache.json");
        let tmp_file = cache_dir.join("cache.tmp");
        Self {
            cache_dir,
            cache_file,
            tmp_file,
            ttl_seconds,
        }
    }

    fn ensure_dir(&self) -> io::Result<()> {
        fs::create_dir_all(&self.cache_dir)
    }

    fn now_epoch() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
    }

    fn load_raw(&self) -> serde_json::Value {
        if !self.cache_file.exists() {
            return serde_json::Value::Object(serde_json::Map::new());
        }
        match fs::read_to_string(&self.cache_file) {
            Ok(content) => {
                serde_json::from_str(&content).unwrap_or_else(|_| {
                    let _ = fs::rename(&self.cache_file, self.cache_dir.join("cache.corrupt"));
                    serde_json::Value::Object(serde_json::Map::new())
                })
            }
            Err(_) => serde_json::Value::Object(serde_json::Map::new()),
        }
    }

    fn save_raw(&self, data: &serde_json::Value) -> io::Result<()> {
        self.ensure_dir()?;
        let json_str = serde_json::to_string(data).map_err(|e| {
            io::Error::new(io::ErrorKind::Other, format!("Serialization: {}", e))
        })?;
        fs::write(&self.tmp_file, &json_str)?;
        fs::rename(&self.tmp_file, &self.cache_file)?;
        Ok(())
    }

    pub fn get(&self, key: &str) -> Option<String> {
        let data = self.load_raw();
        let obj = data.as_object()?;
        let entry = obj.get(key)?.as_object()?;
        let cached_at = entry.get("cached_at")?.as_u64()?;
        let now = Self::now_epoch();
        if now.saturating_sub(cached_at) > self.ttl_seconds {
            return None;
        }
        entry
            .get("value")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    }

    pub fn set(&self, key: &str, value: &str) -> io::Result<()> {
        let mut data = self.load_raw();
        let obj = data.as_object_mut().unwrap();
        let mut entry = serde_json::Map::new();
        entry.insert(
            "value".to_string(),
            serde_json::Value::String(value.to_string()),
        );
        entry.insert(
            "cached_at".to_string(),
            serde_json::Value::Number(serde_json::Number::from(Self::now_epoch())),
        );
        obj.insert(key.to_string(), serde_json::Value::Object(entry));
        self.save_raw(&data)
    }

    pub fn clear(&self) -> io::Result<()> {
        let empty = serde_json::Value::Object(serde_json::Map::new());
        self.save_raw(&empty)
    }

    pub fn exists(&self) -> bool {
        self.cache_file.exists()
    }
}
