#pragma once
#include <string>
#include <vector>
#include <map>

std::string generate_timestamp();
std::string generate_nonce();
std::string hmac_sha256(const std::string& key, const std::string& message);
std::string sha256_hex(const std::string& data);
std::string base64_encode(const unsigned char* data, size_t length);
std::string sign_request(const std::map<std::string, std::string>& payload,
                          const std::string& secret,
                          const std::string& timestamp,
                          const std::string& nonce,
                          const std::string& method = "POST",
                          const std::string& path = "",
                          const std::string& query = "");
std::string json_stringify(const std::map<std::string, std::string>& m);
std::map<std::string, std::string> json_parse(const std::string& json);
std::string json_escape(const std::string& s);
