#pragma once
#include <string>
#include <map>
#include <any>
#include <optional>

class CacheManager {
public:
    CacheManager(const std::map<std::string, std::string>& config);
    std::optional<std::string> get(const std::string& key);
    void set(const std::string& key, const std::string& value);
    void del(const std::string& key);
    void clear();
    bool is_expired(const std::map<std::string, std::string>& entry);
    bool is_valid();
    bool exists();
    std::optional<std::map<std::string, std::string>> get_license_status();
    void set_license_status(const std::map<std::string, std::string>& status);
    void invalidate_license_status();
    void set_onboarding_complete();
    bool is_onboarding_complete();
    void mark_has_ever_activated_paid_license();
    bool has_ever_activated_paid_license();

private:
    std::map<std::string, std::string> config_;
    std::string product_id_;
    std::string cache_dir_;
    std::string cache_file_;
    std::string tmp_file_;
    std::string corrupt_file_;
    int ttl_days_ = 0;
    std::map<std::string, std::map<std::string, std::string>> cache_;

    int get_ttl();
    void ensure_cache_dir();
    void load_cache();
    void save_cache();
    void preserve_corrupt_cache();
    std::string ts_now();
};
