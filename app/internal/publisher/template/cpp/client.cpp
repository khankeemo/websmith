#include "client.h"
#include "hardware.h"
#include "cache.h"
#include "crypto.h"
#include <curl/curl.h>
#include <thread>
#include <chrono>
#include <sstream>

static size_t write_callback(void* contents, size_t size, size_t nmemb, void* userp) {
    size_t total = size * nmemb;
    ((std::string*)userp)->append((char*)contents, total);
    return total;
}

ApiClient::ApiClient(const std::map<std::string, std::string>& config,
                      std::shared_ptr<HardwareDetector> hardware,
                      std::shared_ptr<CacheManager> cache)
    : config_(config), hardware_(hardware), cache_(cache) {
    api_config_ = json_parse(config_.at("api_json"));
    base_url_ = api_config_["url"];
    if (!base_url_.empty() && base_url_.back() == '/')
        base_url_.pop_back();
    api_version_ = api_config_["version"];
    if (api_version_.empty()) api_version_ = "v1";
    api_key_ = api_config_["public_key"];
    api_secret_ = api_config_["secret"];
    std::string to = api_config_["timeout"];
    timeout_ = to.empty() ? 30.0 : std::stod(to) / 1000.0;
    std::string rc = api_config_["retry_count"];
    retry_count_ = rc.empty() ? 3 : std::stoi(rc);
    auto prod = json_parse(config_.at("product_json"));
    product_id_ = prod["id"];
    curl_global_init(CURL_GLOBAL_ALL);
}

ApiClient::~ApiClient() {
    curl_global_cleanup();
}

std::string ApiClient::get_hardware_id() {
    return hardware_->get_fingerprint();
}

std::map<std::string, std::string> ApiClient::sign_request(
    const std::map<std::string, std::string>& payload,
    const std::string& method,
    const std::string& path,
    const std::string& query) {
    std::string timestamp = generate_timestamp();
    std::string nonce = generate_nonce();
    std::string signature = ::sign_request(payload, api_secret_, timestamp,
                                            nonce, method, path, query);
    std::map<std::string, std::string> headers;
    headers["x-api-key"] = api_key_;
    headers["x-timestamp"] = timestamp;
    headers["x-nonce"] = nonce;
    headers["x-signature"] = signature;
    return headers;
}

std::string ApiClient::http_post(const std::string& url,
                                  const std::string& body,
                                  const std::map<std::string, std::string>& headers,
                                  int& status_code) {
    CURL* curl = curl_easy_init();
    if (!curl) return "";
    std::string response;
    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    curl_easy_setopt(curl, CURLOPT_POST, 1L);
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, body.c_str());
    curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, (long)body.size());
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, write_callback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT_MS, (long)(timeout_ * 1000));
    curl_easy_setopt(curl, CURLOPT_SSL_VERIFYPEER, 0L);

    struct curl_slist* slist = nullptr;
    for (const auto& [k, v] : headers) {
        std::string h = k + ": " + v;
        slist = curl_slist_append(slist, h.c_str());
    }
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, slist);

    CURLcode res = curl_easy_perform(curl);
    if (res == CURLE_OK) {
        curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &status_code);
    } else {
        status_code = 0;
    }
    curl_slist_free_all(slist);
    curl_easy_cleanup(curl);
    return response;
}

std::string ApiClient::http_get(const std::string& url,
                                 const std::map<std::string, std::string>& headers,
                                 int& status_code) {
    CURL* curl = curl_easy_init();
    if (!curl) return "";
    std::string response;
    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    curl_easy_setopt(curl, CURLOPT_HTTPGET, 1L);
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, write_callback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT_MS, (long)(timeout_ * 1000));
    curl_easy_setopt(curl, CURLOPT_SSL_VERIFYPEER, 0L);

    struct curl_slist* slist = nullptr;
    for (const auto& [k, v] : headers) {
        std::string h = k + ": " + v;
        slist = curl_slist_append(slist, h.c_str());
    }
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, slist);

    CURLcode res = curl_easy_perform(curl);
    if (res == CURLE_OK) {
        curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &status_code);
    } else {
        status_code = 0;
    }
    curl_slist_free_all(slist);
    curl_easy_cleanup(curl);
    return response;
}

std::map<std::string, std::string> ApiClient::request(
    const std::string& endpoint,
    const std::map<std::string, std::string>& payload,
    int retries) {
    std::string url = base_url_ + "/api/" + api_version_ + "/" + endpoint;
    int max_retries = (retries >= 0) ? retries : retry_count_;

    auto req_payload = payload;
    if (!product_id_.empty() && req_payload.find("product_id") == req_payload.end()) {
        req_payload["product_id"] = product_id_;
    }

    for (int attempt = 0; attempt <= max_retries; ++attempt) {
        std::string api_path = "/api/" + api_version_ + "/" + endpoint;
        auto headers = sign_request(req_payload, "POST", api_path, "");
        headers["Content-Type"] = "application/json";
        std::string body = json_stringify(req_payload);

        int status_code = 0;
        std::string response_body = http_post(url, body, headers, status_code);

        if (!response_body.empty()) {
            auto data = json_parse(response_body);
            if (status_code >= 200 && status_code < 300) return data;
            if (status_code == 429 && attempt < max_retries) {
                int retry_after = 5;
                std::this_thread::sleep_for(std::chrono::seconds(retry_after));
                continue;
            }
            if ((status_code == 500 || status_code == 502 || status_code == 503 || status_code == 504) &&
                attempt < max_retries) {
                std::this_thread::sleep_for(std::chrono::seconds((attempt + 1) * 2));
                continue;
            }
            std::map<std::string, std::string> err;
            err["success"] = "false";
            auto mit = data.find("message");
            if (mit != data.end()) err["message"] = mit->second;
            else {
                mit = data.find("error");
                if (mit != data.end()) err["message"] = mit->second;
                else err["message"] = "HTTP " + std::to_string(status_code);
            }
            return err;
        }
        if (attempt < max_retries) {
            std::this_thread::sleep_for(std::chrono::seconds((attempt + 1) * 2));
        }
    }
    std::map<std::string, std::string> err;
    err["success"] = "false";
    err["message"] = "Failed after " + std::to_string(max_retries) + " retries";
    return err;
}

std::map<std::string, std::string> ApiClient::validate_license(
    const std::string& license_key, const std::string& hardware_id) {
    std::string hw = hardware_id.empty() ? get_hardware_id() : hardware_id;
    std::map<std::string, std::string> payload;
    payload["action"] = "validate";
    payload["license_key"] = license_key;
    payload["hardware_id"] = hw;
    if (cache_ && cache_->is_valid()) {
        auto cached = cache_->get_license_status();
        if (cached) return *cached;
    }
    auto response = request("license", payload);
    if (cache_ && response["success"] == "true") {
        auto data = json_parse(response["data_json"]);
        if (data["valid"] == "true") cache_->set_license_status(response);
    }
    return response;
}

std::map<std::string, std::string> ApiClient::activate_license(
    const std::string& license_key, const std::string& hardware_id) {
    std::string hw = hardware_id.empty() ? get_hardware_id() : hardware_id;
    std::map<std::string, std::string> payload;
    payload["action"] = "activate";
    payload["license_key"] = license_key;
    payload["hardware_id"] = hw;
    auto response = request("license", payload);
    if (cache_) cache_->invalidate_license_status();
    return response;
}

std::map<std::string, std::string> ApiClient::deactivate_license(
    const std::string& license_key, const std::string& hardware_id) {
    std::string hw = hardware_id.empty() ? get_hardware_id() : hardware_id;
    std::map<std::string, std::string> payload;
    payload["action"] = "deactivate";
    payload["license_key"] = license_key;
    payload["hardware_id"] = hw;
    auto response = request("license", payload);
    if (cache_) cache_->invalidate_license_status();
    return response;
}

std::map<std::string, std::string> ApiClient::renew_license(
    const std::string& license_key, int extra_days) {
    std::map<std::string, std::string> payload;
    payload["action"] = "renew";
    payload["license_key"] = license_key;
    if (extra_days >= 0) payload["extra_days"] = std::to_string(extra_days);
    auto response = request("license", payload);
    if (cache_) cache_->invalidate_license_status();
    return response;
}

std::map<std::string, std::string> ApiClient::start_trial(
    const std::string& email, const std::string& customer_name,
    const std::map<std::string, std::string>& customer_data) {
    std::string hw = get_hardware_id();
    std::map<std::string, std::string> payload;
    payload["action"] = "start";
    payload["customer_email"] = email;
    payload["customer_name"] = customer_name;
    payload["hardware_id"] = hw;
    if (!customer_data.empty()) {
        payload["customer_data_json"] = json_stringify(customer_data);
    }
    return request("trial", payload);
}

std::map<std::string, std::string> ApiClient::get_trial_status(
    const std::string& hardware_id) {
    std::string hw = hardware_id.empty() ? get_hardware_id() : hardware_id;
    std::map<std::string, std::string> payload;
    payload["action"] = "status";
    payload["hardware_id"] = hw;
    return request("trial", payload);
}

std::map<std::string, std::string> ApiClient::convert_trial(
    const std::string& hardware_id, const std::string& plan,
    const std::string& customer_name, const std::string& customer_email) {
    std::string hw = hardware_id.empty() ? get_hardware_id() : hardware_id;
    std::map<std::string, std::string> payload;
    payload["action"] = "convert";
    payload["hardware_id"] = hw;
    if (!plan.empty()) payload["plan"] = plan;
    if (!customer_name.empty()) payload["customer_name"] = customer_name;
    if (!customer_email.empty()) payload["customer_email"] = customer_email;
    auto response = request("trial", payload);
    if (cache_) cache_->invalidate_license_status();
    return response;
}

std::map<std::string, std::string> ApiClient::bind_device(
    const std::string& license_key, const std::string& hardware_id,
    const std::string& device_name) {
    std::string hw = hardware_id.empty() ? get_hardware_id() : hardware_id;
    std::map<std::string, std::string> payload;
    payload["action"] = "bind";
    payload["license_key"] = license_key;
    payload["hardware_id"] = hw;
    if (!device_name.empty()) payload["device_name"] = device_name;
    return request("device", payload);
}

std::map<std::string, std::string> ApiClient::replace_device(
    const std::string& license_key, const std::string& new_hardware_id,
    const std::string& old_hardware_id) {
    std::string new_hw = new_hardware_id.empty() ? get_hardware_id() : new_hardware_id;
    std::map<std::string, std::string> payload;
    payload["action"] = "replace";
    payload["license_key"] = license_key;
    payload["old_hardware_id"] = old_hardware_id;
    payload["new_hardware_id"] = new_hw;
    auto response = request("device", payload);
    if (cache_) cache_->invalidate_license_status();
    return response;
}

std::map<std::string, std::string> ApiClient::get_products() {
    std::map<std::string, std::string> payload;
    payload["action"] = "list";
    return request("store/products", payload);
}

std::map<std::string, std::string> ApiClient::update_customer(
    const std::string& name, const std::string& email,
    const std::string& phone, const std::string& hardware_id) {
    std::string hw = hardware_id.empty() ? get_hardware_id() : hardware_id;
    std::map<std::string, std::string> payload;
    payload["name"] = name;
    payload["email"] = email;
    payload["mobile"] = phone;
    payload["hardware_id"] = hw;
    auto response = request("customer/register", payload);
    if (response["success"] == "true" && cache_) cache_->invalidate_license_status();
    return response;
}
