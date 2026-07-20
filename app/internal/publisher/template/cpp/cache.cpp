#include "cache.h"
#include "crypto.h"
#include <fstream>
#include <sstream>
#include <filesystem>
#include <chrono>
#include <algorithm>
#include <cctype>

namespace fs = std::filesystem;

CacheManager::CacheManager(const std::map<std::string, std::string>& config)
    : config_(config) {
    auto prod = json_parse(config_.at("product_json"));
    product_id_ = prod["id"];
    if (product_id_.empty()) product_id_ = "unknown";
    std::string safe_name;
    for (char c : product_id_) {
        if (std::isalnum(c) || c == '-' || c == '_') safe_name += c;
        else safe_name += '_';
    }
#ifdef _WIN32
    const char* home = std::getenv("USERPROFILE");
#else
    const char* home = std::getenv("HOME");
#endif
    if (!home) home = ".";
    cache_dir_ = std::string(home) + "/.websmith/" + safe_name;
    cache_file_ = cache_dir_ + "/cache.json";
    tmp_file_ = cache_dir_ + "/cache.tmp";
    corrupt_file_ = cache_dir_ + "/cache.corrupt";
    ttl_days_ = get_ttl();
}

int CacheManager::get_ttl() {
    auto off_config = json_parse(config_.at("offline_json"));
    auto it = off_config.find("cache_days");
    if (it != off_config.end() && !it->second.empty()) {
        return std::stoi(it->second);
    }
    return 0;
}

void CacheManager::ensure_cache_dir() {
    fs::create_directories(cache_dir_);
}

std::string CacheManager::ts_now() {
    auto now = std::chrono::system_clock::now();
    auto tt = std::chrono::system_clock::to_time_t(now);
    return std::to_string(tt);
}

void CacheManager::load_cache() {
    if (!cache_.empty()) return;
    ensure_cache_dir();
    if (!fs::exists(cache_file_)) return;
    std::ifstream f(cache_file_);
    if (!f.is_open()) return;
    std::string content((std::istreambuf_iterator<char>(f)),
                         std::istreambuf_iterator<char>());
    f.close();
    preserve_corrupt_cache();
    size_t pos = 0;
    auto skip_ws = [&]() {
        while (pos < content.size() && (content[pos] == ' ' || content[pos] == '\t' ||
               content[pos] == '\n' || content[pos] == '\r')) ++pos;
    };
    skip_ws();
    if (pos >= content.size() || content[pos] != '{') { cache_.clear(); return; }
    ++pos;
    while (pos < content.size()) {
        skip_ws();
        if (pos >= content.size() || content[pos] == '}') break;
        std::string key;
        if (content[pos] == '"') {
            ++pos;
            while (pos < content.size() && content[pos] != '"') {
                if (content[pos] == '\\' && pos + 1 < content.size()) {
                    key += content[pos + 1]; pos += 2;
                } else { key += content[pos]; ++pos; }
            }
            if (pos < content.size()) ++pos;
        }
        skip_ws();
        if (pos < content.size() && content[pos] == ':') ++pos;
        skip_ws();
        if (pos < content.size() && content[pos] == '{') {
            ++pos;
            std::map<std::string, std::string> entry;
            while (pos < content.size()) {
                skip_ws();
                if (pos >= content.size() || content[pos] == '}') break;
                std::string ek, ev;
                if (content[pos] == '"') {
                    ++pos;
                    while (pos < content.size() && content[pos] != '"') {
                        if (content[pos] == '\\' && pos + 1 < content.size()) {
                            ek += content[pos + 1]; pos += 2;
                        } else { ek += content[pos]; ++pos; }
                    }
                    if (pos < content.size()) ++pos;
                }
                skip_ws();
                if (pos < content.size() && content[pos] == ':') ++pos;
                skip_ws();
                if (pos < content.size() && content[pos] == '"') {
                    ++pos;
                    while (pos < content.size() && content[pos] != '"') {
                        if (content[pos] == '\\' && pos + 1 < content.size()) {
                            ev += content[pos + 1]; pos += 2;
                        } else { ev += content[pos]; ++pos; }
                    }
                    if (pos < content.size()) ++pos;
                } else {
                    while (pos < content.size() && content[pos] != ',' &&
                           content[pos] != '}' && content[pos] != ' ') {
                        if (content[pos] != '\n' && content[pos] != '\r' && content[pos] != '\t')
                            ev += content[pos];
                        ++pos;
                    }
                }
                entry[ek] = ev;
                skip_ws();
                if (pos < content.size() && content[pos] == ',') ++pos;
            }
            if (pos < content.size()) ++pos;
            cache_[key] = entry;
        }
        skip_ws();
        if (pos < content.size() && content[pos] == ',') ++pos;
    }
}

void CacheManager::preserve_corrupt_cache() {
    if (fs::exists(cache_file_)) {
        try {
            if (fs::exists(corrupt_file_)) fs::remove(corrupt_file_);
            fs::rename(cache_file_, corrupt_file_);
        } catch (...) {
            fs::remove(cache_file_);
        }
    }
}

void CacheManager::save_cache() {
    if (cache_.empty()) return;
    ensure_cache_dir();
    std::ofstream f(tmp_file_);
    if (!f.is_open()) return;
    f << "{\n";
    bool first = true;
    for (const auto& [k, entry] : cache_) {
        if (!first) f << ",\n";
        first = false;
        f << "  \"" << json_escape(k) << "\": {\n";
        bool efirst = true;
        for (const auto& [ek, ev] : entry) {
            if (!efirst) f << ",\n";
            efirst = false;
            f << "    \"" << json_escape(ek) << "\": \"" << json_escape(ev) << "\"";
        }
        f << "\n  }";
    }
    f << "\n}\n";
    f.close();
    try {
        fs::rename(tmp_file_, cache_file_);
    } catch (...) {
        fs::remove(tmp_file_);
    }
}

std::optional<std::string> CacheManager::get(const std::string& key) {
    load_cache();
    auto it = cache_.find(key);
    if (it == cache_.end()) return std::nullopt;
    if (is_expired(it->second)) {
        del(key);
        return std::nullopt;
    }
    auto vit = it->second.find("value");
    if (vit == it->second.end()) return std::nullopt;
    return vit->second;
}

void CacheManager::set(const std::string& key, const std::string& value) {
    load_cache();
    cache_[key] = {{"value", value}, {"cached_at", ts_now()}};
    save_cache();
}

void CacheManager::del(const std::string& key) {
    load_cache();
    auto it = cache_.find(key);
    if (it != cache_.end()) {
        cache_.erase(it);
        save_cache();
    }
}

void CacheManager::clear() {
    cache_.clear();
    save_cache();
}

bool CacheManager::is_expired(const std::map<std::string, std::string>& entry) {
    auto it = entry.find("cached_at");
    if (it == entry.end()) return true;
    double cached_at = std::stod(it->second);
    double ttl_seconds = (double)ttl_days_ * 24 * 60 * 60;
    auto now = std::chrono::system_clock::now();
    double now_ts = std::chrono::duration<double>(
        now.time_since_epoch()).count();
    return (now_ts - cached_at) > ttl_seconds;
}

bool CacheManager::is_valid() {
    load_cache();
    auto it = cache_.find("license_status");
    if (it == cache_.end()) return false;
    return !is_expired(it->second);
}

bool CacheManager::exists() {
    return fs::exists(cache_file_);
}

std::optional<std::map<std::string, std::string>> CacheManager::get_license_status() {
    auto val = get("license_status");
    if (!val) return std::nullopt;
    return json_parse(*val);
}

void CacheManager::set_license_status(const std::map<std::string, std::string>& status) {
    std::string json = "{";
    bool first = true;
    for (const auto& [k, v] : status) {
        if (!first) json += ",";
        first = false;
        json += "\"" + json_escape(k) + "\":\"" + json_escape(v) + "\"";
    }
    json += "}";
    set("license_status", json);
}

void CacheManager::invalidate_license_status() {
    del("license_status");
}

void CacheManager::set_onboarding_complete() {
    load_cache();
    cache_["onboarding_complete"] = {{"value", "true"}, {"cached_at", ts_now()}};
    save_cache();
}

bool CacheManager::is_onboarding_complete() {
    auto val = get("onboarding_complete");
    return val.has_value() && *val == "true";
}
