#include "crypto.h"
#include <openssl/hmac.h>
#include <openssl/sha.h>
#include <chrono>
#include <iomanip>
#include <sstream>
#include <random>
#include <cstring>

std::string generate_timestamp() {
    auto now = std::chrono::system_clock::now();
    auto tt = std::chrono::system_clock::to_time_t(now);
    auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(
        now.time_since_epoch()) % 1000;
    std::tm gmt{};
#ifdef _WIN32
    gmtime_s(&gmt, &tt);
#else
    gmtime_r(&tt, &gmt);
#endif
    std::ostringstream os;
    os << std::put_time(&gmt, "%Y-%m-%dT%H:%M:%S.")
       << std::setfill('0') << std::setw(3) << ms.count()
       << "Z";
    return os.str();
}

std::string generate_nonce() {
    static std::random_device rd;
    static std::mt19937_64 gen(rd());
    static std::uniform_int_distribution<uint64_t> dis;
    std::ostringstream os;
    os << std::hex << dis(gen) << dis(gen) << dis(gen);
    return os.str();
}

std::string hmac_sha256(const std::string& key, const std::string& message) {
    unsigned char result[SHA256_DIGEST_LENGTH];
    unsigned int len = SHA256_DIGEST_LENGTH;
    HMAC(EVP_sha256(), key.c_str(), (int)key.size(),
         (const unsigned char*)message.c_str(), message.size(),
         result, &len);
    return base64_encode(result, len);
}

std::string sha256_hex(const std::string& data) {
    unsigned char hash[SHA256_DIGEST_LENGTH];
    SHA256((const unsigned char*)data.c_str(), data.size(), hash);
    std::ostringstream os;
    for (int i = 0; i < SHA256_DIGEST_LENGTH; ++i) {
        os << std::hex << std::setw(2) << std::setfill('0') << (int)hash[i];
    }
    return os.str();
}

std::string base64_encode(const unsigned char* data, size_t length) {
    if (length == 0) return "";
    BIO* bio = BIO_new(BIO_s_mem());
    BIO* b64 = BIO_new(BIO_f_base64());
    BIO_set_flags(b64, BIO_FLAGS_BASE64_NO_NL);
    bio = BIO_push(b64, bio);
    BIO_write(bio, data, (int)length);
    (void)BIO_flush(bio);
    char* buf = nullptr;
    long len = BIO_get_mem_data(bio, &buf);
    std::string result(buf, len);
    BIO_free_all(bio);
    return result;
}

std::string sign_request(const std::map<std::string, std::string>& payload,
                          const std::string& secret,
                          const std::string& timestamp,
                          const std::string& nonce,
                          const std::string& method,
                          const std::string& path,
                          const std::string& query) {
    std::string payload_json = json_stringify(payload);
    std::string body_hash = sha256_hex(payload_json);
    std::string message = method + "\n" + path + "\n" + query + "\n" +
                          body_hash + "\n" + timestamp + "\n" + nonce;
    return hmac_sha256(secret, message);
}

std::string json_escape(const std::string& s) {
    std::string out;
    out.reserve(s.size() + 2);
    for (char c : s) {
        switch (c) {
            case '"': out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default: out += c;
        }
    }
    return out;
}

std::string json_stringify(const std::map<std::string, std::string>& m) {
    std::string result = "{";
    bool first = true;
    for (const auto& [k, v] : m) {
        if (!first) result += ",";
        first = false;
        result += "\"" + json_escape(k) + "\":\"" + json_escape(v) + "\"";
    }
    result += "}";
    return result;
}

static std::string trim(const std::string& s) {
    size_t start = s.find_first_not_of(" \t\r\n");
    if (start == std::string::npos) return "";
    size_t end = s.find_last_not_of(" \t\r\n");
    return s.substr(start, end - start + 1);
}

std::map<std::string, std::string> json_parse(const std::string& json) {
    std::map<std::string, std::string> result;
    size_t pos = 0;
    auto skip_ws = [&]() {
        while (pos < json.size() && (json[pos] == ' ' || json[pos] == '\t' ||
               json[pos] == '\n' || json[pos] == '\r')) ++pos;
    };
    skip_ws();
    if (pos >= json.size() || json[pos] != '{') return result;
    ++pos;
    while (pos < json.size()) {
        skip_ws();
        if (pos >= json.size() || json[pos] == '}') break;
        if (json[pos] != '"') { ++pos; continue; }
        ++pos;
        std::string key;
        while (pos < json.size() && json[pos] != '"') {
            if (json[pos] == '\\' && pos + 1 < json.size()) {
                key += json[pos + 1]; pos += 2;
            } else {
                key += json[pos]; ++pos;
            }
        }
        if (pos < json.size()) ++pos;
        skip_ws();
        if (pos < json.size() && json[pos] == ':') ++pos;
        skip_ws();
        std::string val;
        if (pos < json.size() && json[pos] == '"') {
            ++pos;
            while (pos < json.size() && json[pos] != '"') {
                if (json[pos] == '\\' && pos + 1 < json.size()) {
                    val += json[pos + 1]; pos += 2;
                } else {
                    val += json[pos]; ++pos;
                }
            }
            if (pos < json.size()) ++pos;
        } else {
            while (pos < json.size() && json[pos] != ',' && json[pos] != '}' &&
                   json[pos] != ' ' && json[pos] != '\n' && json[pos] != '\r' && json[pos] != '\t') {
                val += json[pos]; ++pos;
            }
        }
        result[trim(key)] = trim(val);
        skip_ws();
        if (pos < json.size() && json[pos] == ',') ++pos;
    }
    return result;
}
