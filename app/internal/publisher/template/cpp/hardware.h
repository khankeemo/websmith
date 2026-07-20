#pragma once
#include <string>
#include <map>

class HardwareDetector {
public:
    HardwareDetector();
    std::string get_fingerprint();
    std::map<std::string, std::string> get_identifiers();

private:
    std::string fingerprint_;
    std::map<std::string, std::string> identifiers_;
    bool initialized_ = false;

    std::map<std::string, std::string> collect_identifiers();
    std::string get_cpu_id();
    std::string get_cpu_id_windows();
    std::string get_cpu_id_darwin();
    std::string get_cpu_id_linux();
    std::string get_motherboard_id();
    std::string get_network_id();
    std::string get_os_info();
    std::string build_combined_string(const std::map<std::string, std::string>& ids);
    std::string hash_identifiers(const std::string& data);
    std::string exec_command(const std::string& cmd);
};
