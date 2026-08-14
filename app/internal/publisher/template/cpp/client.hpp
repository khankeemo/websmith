#ifndef WEBSMITH_CLIENT_HPP
#define WEBSMITH_CLIENT_HPP

#include <string>
#include <vector>
#include <cstring>
#include <sstream>
#include <chrono>
#include <iomanip>
#include <fstream>
#include <thread>
#include <random>
#include <regex>
#include <array>
#include <memory>
#include <algorithm>
#include <cctype>
#include <stdexcept>
#include <functional>
#include <unordered_map>
#include <cstdint>

#include <curl/curl.h>
#include <nlohmann/json.hpp>
#include <openssl/hmac.h>

#ifdef _WIN32
#include <windows.h>
#include <iphlpapi.h>
#include <intrin.h>
#pragma comment(lib, "iphlpapi.lib")
#pragma comment(lib, "wbemuuid.lib")
#else
#include <unistd.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <sys/ioctl.h>
#include <net/if.h>
#include <netdb.h>
#include <ifaddrs.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#endif

#include <filesystem>
#include <cstdio>

using json = nlohmann::json;
namespace fs = std::filesystem;

namespace websmith {

class ApiException : public std::runtime_error {
public:
    explicit ApiException(const std::string& message, int statusCode = 0)
        : std::runtime_error(message), m_statusCode(statusCode) {}
    int statusCode() const { return m_statusCode; }
private:
    int m_statusCode;
};

static size_t WriteCallback(void* contents, size_t size, size_t nmemb, std::string* output) {
    size_t total = size * nmemb;
    output->append(static_cast<char*>(contents), total);
    return total;
}

static std::string sha256Hex(const std::string& data) {
    unsigned char hash[EVP_MAX_MD_SIZE];
    unsigned int hashLen = 0;
    HMAC(EVP_sha256(), nullptr, 0,
         reinterpret_cast<const unsigned char*>(data.data()), data.size(),
         hash, &hashLen);
    std::ostringstream oss;
    for (unsigned int i = 0; i < hashLen; ++i)
        oss << std::hex << std::setw(2) << std::setfill('0') << static_cast<int>(hash[i]);
    return oss.str();
}

static std::string hmacSha256Hex(const std::string& key, const std::string& data) {
    unsigned char hash[EVP_MAX_MD_SIZE];
    unsigned int hashLen = 0;
    HMAC(EVP_sha256(),
         key.data(), static_cast<int>(key.size()),
         reinterpret_cast<const unsigned char*>(data.data()), data.size(),
         hash, &hashLen);
    std::ostringstream oss;
    for (unsigned int i = 0; i < hashLen; ++i)
        oss << std::hex << std::setw(2) << std::setfill('0') << static_cast<int>(hash[i]);
    return oss.str();
}

static std::string currentTimestamp() {
    auto now = std::chrono::system_clock::now();
    auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()).count();
    return std::to_string(ms);
}

static std::string generateNonce() {
    std::random_device rd;
    std::mt19937_64 gen(rd());
    std::uniform_int_distribution<uint64_t> dist;
    std::ostringstream oss;
    oss << std::hex << dist(gen) << dist(gen);
    return oss.str();
}

static json loadConfig(const std::string& configPath = "config/api-config.json") {
    std::ifstream file(configPath);
    if (!file.is_open()) return json::object();
    json cfg;
    try { file >> cfg; } catch (...) { return json::object(); }
    return cfg;
}

class Client {
public:
    Client(const std::string& apiKey, const std::string& apiSecret = "", const json& config = json::object())
        : m_apiKey(apiKey), m_apiSecret(apiSecret) {
        const char* envUrl = std::getenv("WEBSMITH_API_URL");
        if (envUrl && std::strlen(envUrl) > 0) {
            m_apiUrl = envUrl;
        } else if (config.contains("api_url") && config["api_url"].is_string()) {
            m_apiUrl = config["api_url"].get<std::string>();
        } else {
            m_apiUrl = "";
        }
        if (!m_apiUrl.empty() && m_apiUrl.back() == '/')
            m_apiUrl.pop_back();
        m_timeout = config.value("timeout", 30);
        m_retries = config.value("retries", 3);
    }

    json validateLicense(const std::string& licenseKey, const std::string& deviceId) {
        json body = {{"action", "validate"}, {"license_key", licenseKey}, {"hardware_id", deviceId}};
        return request("POST", "/api/v1/license", body);
    }

    json activateLicense(const std::string& licenseKey, const std::string& deviceId, const std::string& deviceName) {
        json body = {{"action", "activate"}, {"license_key", licenseKey}, {"hardware_id", deviceId}, {"device_name", deviceName}};
        return request("POST", "/api/v1/license", body);
    }

    json deactivateLicense(const std::string& licenseKey, const std::string& deviceId) {
        json body = {{"action", "deactivate"}, {"license_key", licenseKey}, {"hardware_id", deviceId}};
        return request("POST", "/api/v1/license", body);
    }

    json renewLicense(const std::string& licenseKey, const std::string& deviceId) {
        json body = {{"action", "renew"}, {"license_key", licenseKey}, {"hardware_id", deviceId}};
        return request("POST", "/api/v1/license", body);
    }

    json startTrial(const std::string& email, const std::string& customerName, const json& customerData) {
        json payload = {{"action", "start"}, {"customer_email", email}, {"customer_name", customerName}};
        if (!customerData.is_null()) {
            for (auto& [key, val] : customerData.items())
                payload[key] = val;
        }
        return request("POST", "/api/v1/trial", payload);
    }

    json checkTrial(const std::string& hardwareId) {
        return request("POST", "/api/v1/trial", {{"action", "status"}, {"hardware_id", hardwareId}});
    }

    json convertTrial(const std::string& hardwareId, const std::string& plan, const std::string& name, const std::string& email) {
        return request("POST", "/api/v1/trial",
            {{"action", "convert"}, {"hardware_id", hardwareId}, {"plan", plan}, {"customer_name", name}, {"customer_email", email}});
    }

    json bindDevice(const std::string& licenseKey, const std::string& deviceId, const std::string& deviceName) {
        json body = {{"action", "bind_device"}, {"license_key", licenseKey},
                     {"hardware_id", deviceId}, {"device_name", deviceName}};
        return request("POST", "/api/v1/license", body);
    }

    json getTrialStatus(const std::string& hardwareId) {
        return request("POST", "/api/v1/trial", {{"action", "status"}, {"hardware_id", hardwareId}});
    }

    json getProducts() {
        return request("POST", "/api/v1/store/products", {{"action", "list"}});
    }

private:
    std::string m_apiKey;
    std::string m_apiSecret;
    std::string m_apiUrl;
    int m_timeout;
    int m_retries;

    json request(const std::string& method, const std::string& endpoint, const json& data) {
        std::string url = m_apiUrl + endpoint;
        std::string body = data.dump();
        std::string timestamp = currentTimestamp();
        std::string nonce = generateNonce();

        std::string signaturePayload = timestamp + nonce + body;
        std::string signature = hmacSha256Hex(m_apiSecret, signaturePayload);

        int lastError = 0;
        for (int attempt = 0; attempt < m_retries; ++attempt) {
            CURL* curl = curl_easy_init();
            if (!curl) continue;

            std::string response;
            struct curl_slist* headers = nullptr;
            headers = curl_slist_append(headers, ("X-API-Key: " + m_apiKey).c_str());
            headers = curl_slist_append(headers, ("X-Timestamp: " + timestamp).c_str());
            headers = curl_slist_append(headers, ("X-Nonce: " + nonce).c_str());
            headers = curl_slist_append(headers, ("X-Signature: " + signature).c_str());
            headers = curl_slist_append(headers, "Content-Type: application/json");

            curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
            curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
            curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
            curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response);
            curl_easy_setopt(curl, CURLOPT_POSTFIELDS, body.c_str());
            curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, static_cast<long>(body.size()));
            curl_easy_setopt(curl, CURLOPT_TIMEOUT, static_cast<long>(m_timeout));
            curl_easy_setopt(curl, CURLOPT_NOSIGNAL, 1L);

            CURLcode res = curl_easy_perform(curl);
            long httpCode = 0;
            curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &httpCode);
            curl_easy_cleanup(curl);
            curl_slist_free_all(headers);

            if (res == CURLE_OK) {
                json parsed = json::parse(response, nullptr, false);
                if (parsed.is_discarded())
                    throw ApiException("Failed to parse API response", static_cast<int>(httpCode));
                if (httpCode >= 400) {
                    std::string msg = parsed.value("error", parsed.value("message", "API error"));
                    throw ApiException(msg, static_cast<int>(httpCode));
                }
                return parsed;
            }

            lastError = static_cast<int>(res);
            if (attempt < m_retries - 1) {
                int delayMs = (1 << attempt) * 500;
                std::this_thread::sleep_for(std::chrono::milliseconds(delayMs));
            }
        }

        throw ApiException("Request failed after " + std::to_string(m_retries) +
                           " retries (curl error: " + std::to_string(lastError) + ")", lastError);
    }
};

static std::string getCpuId() {
    std::string cpuInfo;
#ifdef _WIN32
    SYSTEM_INFO sysInfo;
    GetSystemInfo(&sysInfo);
    std::ostringstream oss;
    oss << sysInfo.wProcessorArchitecture << "-"
        << sysInfo.dwPageSize << "-"
        << sysInfo.dwNumberOfProcessors;
    cpuInfo = oss.str();
#else
    std::ifstream cpu("/proc/cpuinfo");
    if (cpu.is_open()) {
        std::string line;
        while (std::getline(cpu, line)) {
            if (line.find("Serial") != std::string::npos || line.find("processor") != std::string::npos) {
                auto pos = line.find(':');
                if (pos != std::string::npos) {
                    cpuInfo += line.substr(pos + 1);
                    cpuInfo += ",";
                }
            }
        }
    }
    if (cpuInfo.empty())
        cpuInfo = "unknown_cpu";
#endif
    return cpuInfo;
}

static std::string getMotherboardSerial() {
#ifdef _WIN32
    std::string serial;
    HKEY hKey;
    if (RegOpenKeyExA(HKEY_LOCAL_MACHINE,
        "HARDWARE\DESCRIPTION\System\BIOS", 0, KEY_READ, &hKey) == ERROR_SUCCESS) {
        char buffer[256];
        DWORD bufSize = sizeof(buffer);
        if (RegQueryValueExA(hKey, "SystemProductName", nullptr, nullptr,
                             reinterpret_cast<LPBYTE>(buffer), &bufSize) == ERROR_SUCCESS) {
            serial = buffer;
        }
        RegCloseKey(hKey);
    }
    return serial.empty() ? "unknown_mobo" : serial;
#else
    std::ifstream board("/sys/class/dmi/id/board_serial");
    if (board.is_open()) {
        std::string serial;
        std::getline(board, serial);
        if (!serial.empty() && serial != "To be filled by O.E.M.")
            return serial;
    }
    std::ifstream product("/sys/class/dmi/id/product_uuid");
    if (product.is_open()) {
        std::string uuid;
        std::getline(product, uuid);
        if (!uuid.empty()) return uuid;
    }
    return "unknown_mobo";
#endif
}

static std::vector<std::string> getMacAddresses() {
    std::vector<std::string> macs;
#ifdef _WIN32
    DWORD bufSize = 0;
    if (GetAdaptersInfo(nullptr, &bufSize) == ERROR_BUFFER_OVERFLOW) {
        std::vector<IP_ADAPTER_INFO> adapters(bufSize / sizeof(IP_ADAPTER_INFO) + 1);
        if (GetAdaptersInfo(adapters.data(), &bufSize) == NO_ERROR) {
            for (auto* p = adapters.data(); p; p = p->Next) {
                std::ostringstream oss;
                oss << std::hex << std::setfill('0');
                for (UINT i = 0; i < p->AddressLength; ++i)
                    oss << std::setw(2) << static_cast<int>(p->Address[i]);
                std::string mac = oss.str();
                if (mac.size() >= 12 && mac != "000000000000")
                    macs.push_back(mac);
            }
        }
    }
#else
    struct ifaddrs* ifap = nullptr;
    if (getifaddrs(&ifap) == 0) {
        for (struct ifaddrs* ifa = ifap; ifa; ifa = ifa->ifa_next) {
            if (!ifa->ifa_addr || ifa->ifa_addr->sa_family != AF_PACKET) continue;
            struct sockaddr_ll* sll = reinterpret_cast<struct sockaddr_ll*>(ifa->ifa_addr);
            if (sll->sll_halen == 0) continue;
            std::ostringstream oss;
            oss << std::hex << std::setfill('0');
            for (unsigned char i = 0; i < sll->sll_halen; ++i)
                oss << std::setw(2) << static_cast<int>(sll->sll_addr[i]);
            std::string mac = oss.str();
            if (mac.size() >= 12 && mac != "000000000000")
                macs.push_back(mac);
        }
        freeifaddrs(ifap);
    }
#endif
    if (macs.empty()) macs.push_back("00:00:00:00:00:00");
    return macs;
}

static json generateFingerprint() {
    json result;
    std::string cpuId = getCpuId();
    std::string moboSerial = getMotherboardSerial();
    std::vector<std::string> macs = getMacAddresses();

    std::string combined = cpuId + "|" + moboSerial;
    for (auto& m : macs) combined += "|" + m;
    std::string fp = sha256Hex(combined);

    result["fingerprint"] = fp;
    result["cpu_id"] = cpuId;
    result["motherboard_serial"] = moboSerial;
    result["macs"] = json(macs);

#ifdef _WIN32
    result["os"] = "windows";
#elif defined(__APPLE__)
    result["os"] = "macos";
#elif defined(__linux__)
    result["os"] = "linux";
#else
    result["os"] = "unknown";
#endif

    return result;
}

class CacheManager {
public:
    explicit CacheManager(const std::string& productId = "${product_id}")
        : m_productId(productId), m_defaultTtl(3600) {
        const char* home = std::getenv("HOME");
#ifdef _WIN32
        if (!home) home = std::getenv("USERPROFILE");
#endif
        if (home)
            m_cacheDir = fs::path(home) / ".websmith" / productId;
        else
            m_cacheDir = fs::path(".websmith") / productId;
        fs::create_directories(m_cacheDir);
    }

    void setTtl(int seconds) { m_defaultTtl = seconds; }

    bool has(const std::string& key) const {
        fs::path path = m_cacheDir / (key + ".json");
        if (!fs::exists(path)) return false;
        auto ftp = fs::last_write_time(path);
        auto now = fs::file_time_type::clock::now();
        auto age = std::chrono::duration_cast<std::chrono::seconds>(now - ftp).count();
        return age < m_defaultTtl;
    }

    json get(const std::string& key) const {
        fs::path path = m_cacheDir / (key + ".json");
        if (!has(key)) return json();
        std::ifstream file(path);
        if (!file.is_open()) return json();
        json data;
        try { file >> data; } catch (...) { return json(); }
        return data;
    }

    void set(const std::string& key, const json& data) {
        fs::path path = m_cacheDir / (key + ".json");
        fs::path tmpPath = m_cacheDir / (key + ".tmp." + generateNonce() + ".json");
        {
            std::ofstream tmp(tmpPath);
            if (!tmp.is_open()) return;
            tmp << data.dump(2);
            tmp.flush();
        }
        std::error_code ec;
        fs::rename(tmpPath, path, ec);
    }

    void remove(const std::string& key) {
        fs::path path = m_cacheDir / (key + ".json");
        std::error_code ec;
        fs::remove(path, ec);
    }

    void clear() {
        std::error_code ec;
        for (auto& entry : fs::directory_iterator(m_cacheDir, ec)) {
            if (entry.path().extension() == ".json")
                fs::remove(entry.path(), ec);
        }
    }

    fs::path cacheDir() const { return m_cacheDir; }

private:
    std::string m_productId;
    fs::path m_cacheDir;
    int m_defaultTtl;
};

class LicenseEngine {
public:
    LicenseEngine(const std::string& apiKey, const std::string& apiSecret = "",
                  const json& config = json::object())
        : m_client(std::make_unique<Client>(apiKey, apiSecret, config))
        , m_cache(std::make_unique<CacheManager>(
              config.value("product_id", "${product_id}"))) {
        m_fingerprint = generateFingerprint();

        json cfg = loadConfig("config/api-config.json");
        if (config.contains("product_id")) cfg["product_id"] = config["product_id"];
        if (config.contains("timeout")) cfg["timeout"] = config["timeout"];
        if (config.contains("retries")) cfg["retries"] = config["retries"];

        if (!cfg.is_null() && cfg.contains("cache_ttl"))
            m_cache->setTtl(cfg["cache_ttl"].get<int>());
    }

    void initialize() {
        // load any cached license data
        json cached = m_cache->get("license_data");
        if (!cached.is_null()) {
            m_licenseData = cached;
        }
    }

    json validate(const std::string& licenseKey) {
        std::string deviceId = m_fingerprint["fingerprint"];
        auto result = m_client->validateLicense(licenseKey, deviceId);
        if (result.contains("license")) {
            m_licenseData = result["license"];
            m_cache->set("license_data", m_licenseData);
        }
        return result;
    }

    json activate(const std::string& licenseKey, const std::string& deviceName) {
        std::string deviceId = m_fingerprint["fingerprint"];
        auto result = m_client->activateLicense(licenseKey, deviceId, deviceName);
        if (result.contains("license")) {
            m_licenseData = result["license"];
            m_cache->set("license_data", m_licenseData);
            m_cache->set("license_key", licenseKey);
        }
        return result;
    }

    json deactivate(const std::string& licenseKey) {
        std::string deviceId = m_fingerprint["fingerprint"];
        auto result = m_client->deactivateLicense(licenseKey, deviceId);
        m_licenseData = json();
        m_cache->remove("license_data");
        m_cache->remove("license_key");
        return result;
    }

    json renew(const std::string& licenseKey) {
        std::string deviceId = m_fingerprint["fingerprint"];
        auto result = m_client->renewLicense(licenseKey, deviceId);
        if (result.contains("license")) {
            m_licenseData = result["license"];
            m_cache->set("license_data", m_licenseData);
        }
        return result;
    }

    json startTrial(const std::string& email, const std::string& customerName, const json& customerData = nullptr) {
        auto result = m_client->startTrial(email, customerName, customerData);
        if (result.contains("license")) {
            m_licenseData = result["license"];
            m_cache->set("license_data", m_licenseData);
        }
        return result;
    }

    json checkTrial() {
        std::string hardwareId = m_fingerprint["fingerprint"];
        auto result = m_client->checkTrial(hardwareId);
        if (result.contains("trial")) {
            m_licenseData = result["trial"];
            m_cache->set("license_data", m_licenseData);
        }
        return result;
    }

    json convertTrial(const std::string& plan, const std::string& name, const std::string& email) {
        std::string hardwareId = m_fingerprint["fingerprint"];
        auto result = m_client->convertTrial(hardwareId, plan, name, email);
        if (result.contains("license")) {
            m_licenseData = result["license"];
            m_cache->set("license_data", m_licenseData);
        }
        return result;
    }

    json viewHardwareStatus() {
        json result;
        std::string currentHw = deviceId();
        json validateResult = validate();
        if (!validateResult["success"]) { return validateResult; }
        std::string registeredHw = validateResult["data"]["hardware_id"];
        result["matched"] = (currentHw == registeredHw);
        result["current_hardware_id"] = currentHw;
        result["registered_hardware_id"] = registeredHw;
        result["message"] = "Hardware replacement requires administrator approval. Please contact support.";
        return result;
    }

    json bindDevice(const std::string& licenseKey, const std::string& deviceName) {
        std::string deviceId = m_fingerprint["fingerprint"];
        auto result = m_client->bindDevice(licenseKey, deviceId, deviceName);
        if (result.contains("license")) {
            m_licenseData = result["license"];
            m_cache->set("license_data", m_licenseData);
        }
        return result;
    }

    bool hasLicenseKey() const {
        json cached = m_cache->get("license_key");
        return !cached.is_null() && cached.is_string() && !cached.get<std::string>().empty();
    }

    bool isValid() {
        if (hasLicenseKey()) {
            json cached = m_cache->get("license_key");
            std::string key = cached.get<std::string>();
            try {
                auto result = validate(key);
                return result.contains("license") &&
                       result["license"].value("status", "") == "active";
            } catch (...) {
                // fallback to cached data
            }
        }
        if (m_licenseData.is_null()) return false;
        if (m_licenseData.value("status", "") != "active") return false;
        if (m_licenseData.contains("expires_at") && !m_licenseData["expires_at"].is_null()) {
            std::string expiresAt = m_licenseData["expires_at"].get<std::string>();
            if (expiresAt.size() >= 19) {
                struct std::tm tm = {};
                tm.tm_year = std::stoi(expiresAt.substr(0, 4)) - 1900;
                tm.tm_mon  = std::stoi(expiresAt.substr(5, 2)) - 1;
                tm.tm_mday = std::stoi(expiresAt.substr(8, 2));
                tm.tm_hour = std::stoi(expiresAt.substr(11, 2));
                tm.tm_min  = std::stoi(expiresAt.substr(14, 2));
                tm.tm_sec  = std::stoi(expiresAt.substr(17, 2));
                tm.tm_isdst = -1;
                auto tp = std::chrono::system_clock::from_time_t(mktime(&tm));
                if (tp < std::chrono::system_clock::now())
                    return false;
            }
        }
        return true;
    }

    json getLicenseInfo() const {
        if (!m_licenseData.is_null())
            return m_licenseData;
        return m_cache->get("license_data");
    }

    Client& client() { return *m_client; }

    std::string deviceId() const {
        return m_fingerprint["fingerprint"].get<std::string>();
    }

    json fingerprint() const { return m_fingerprint; }

private:
    std::unique_ptr<Client> m_client;
    std::unique_ptr<CacheManager> m_cache;
    json m_licenseData;
    json m_fingerprint;
};

class WelcomeDialog {
public:
    WelcomeDialog(const std::string& productName, const std::string& supportEmail)
        : m_productName(productName), m_supportEmail(supportEmail) {}

    void showWelcome() const {
        std::cout << "\n========================================\n";
        std::cout << "  Welcome to " << m_productName << "!\n";
        std::cout << "========================================\n\n";

        if (!m_licenseKey.empty()) {
            std::cout << "License Key: " << m_licenseKey << "\n";
            std::cout << "Status: " << (m_isValid ? "Active" : "Inactive") << "\n\n";
        }

        std::cout << "What would you like to do?\n";
        std::cout << "  1. Activate License\n";
        std::cout << "  2. Start Trial\n";
        std::cout << "  3. Check License Status\n";
        std::cout << "  4. Deactivate License\n";
        std::cout << "  5. Exit\n";
        std::cout << "Enter choice (1-5): ";
    }

    void showActivated() const {
        std::cout << "\nLicense activated successfully!\n";
        std::cout << "Thank you for choosing " << m_productName << ".\n\n";
    }

    void showError(const std::string& message) const {
        std::cout << "\nError: " << message << "\n";
        std::cout << "Please contact support: " << m_supportEmail << "\n\n";
    }

    int promptChoice() {
        int choice = 0;
        std::cin >> choice;
        return choice;
    }

    std::string promptLicenseKey() {
        std::cout << "Enter license key: ";
        std::string key;
        std::cin >> key;
        return key;
    }

    std::string promptDeviceName() {
        std::cout << "Enter device name (optional): ";
        std::string name;
        std::cin.ignore();
        std::getline(std::cin, name);
        return name;
    }

    std::string promptEmail() {
        std::cout << "Enter email address: ";
        std::string email;
        std::cin >> email;
        return email;
    }

    std::string promptCustomerName() {
        std::cout << "Enter your name: ";
        std::string name;
        std::cin.ignore();
        std::getline(std::cin, name);
        return name;
    }

    std::string promptPlan() {
        std::cout << "Enter plan name (e.g. basic, pro, enterprise): ";
        std::string plan;
        std::cin >> plan;
        return plan;
    }

    std::string getLicenseKey() const { return m_licenseKey; }
    void setLicenseKey(const std::string& key) { m_licenseKey = key; }
    bool isValid() const { return m_isValid; }
    void setValid(bool valid) { m_isValid = valid; }

private:
    std::string m_productName;
    std::string m_supportEmail;
    std::string m_licenseKey;
    bool m_isValid = false;
};

} // namespace websmith
#endif
