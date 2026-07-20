#include "hardware.h"
#include "crypto.h"
#include <cstdlib>
#include <fstream>
#include <sstream>
#include <algorithm>
#include <regex>
#ifdef _WIN32
#include <windows.h>
#include <intrin.h>
#include <iphlpapi.h>
#include <wbemidl.h>
#pragma comment(lib, "iphlpapi.lib")
#pragma comment(lib, "wbemuuid.lib")
#else
#include <unistd.h>
#include <sys/utsname.h>
#include <cstring>
#endif

HardwareDetector::HardwareDetector() {}

std::string HardwareDetector::exec_command(const std::string& cmd) {
#ifdef _WIN32
    FILE* pipe = _popen(cmd.c_str(), "r");
#else
    FILE* pipe = popen(cmd.c_str(), "r");
#endif
    if (!pipe) return "";
    std::string result;
    char buf[128];
    while (fgets(buf, sizeof(buf), pipe) != nullptr) {
        result += buf;
    }
#ifdef _WIN32
    _pclose(pipe);
#else
    pclose(pipe);
#endif
    return result;
}

std::string HardwareDetector::get_fingerprint() {
    if (!initialized_) {
        auto ids = collect_identifiers();
        auto combined = build_combined_string(ids);
        fingerprint_ = hash_identifiers(combined);
        identifiers_ = ids;
        initialized_ = true;
    }
    return fingerprint_;
}

std::map<std::string, std::string> HardwareDetector::get_identifiers() {
    if (!initialized_) get_fingerprint();
    return identifiers_;
}

std::map<std::string, std::string> HardwareDetector::collect_identifiers() {
    std::map<std::string, std::string> ids;
    std::string cpu = get_cpu_id();
    if (!cpu.empty()) ids["cpu_id"] = cpu;
    std::string mb = get_motherboard_id();
    if (!mb.empty()) ids["motherboard_id"] = mb;
    if (mb.empty()) {
        std::string net = get_network_id();
        if (!net.empty()) ids["network_id"] = net;
    }
    std::string os = get_os_info();
    if (!os.empty()) ids["os_info"] = os;
    return ids;
}

std::string HardwareDetector::get_cpu_id() {
#ifdef _WIN32
    return get_cpu_id_windows();
#elif defined(__APPLE__)
    return get_cpu_id_darwin();
#else
    return get_cpu_id_linux();
#endif
}

#ifdef _WIN32
std::string HardwareDetector::get_cpu_id_windows() {
    std::string out = exec_command("wmic cpu get ProcessorId /value");
    std::smatch match;
    if (std::regex_search(out, match, std::regex(R"(ProcessorId=(.+))"))) {
        std::string id = match[1];
        id.erase(std::remove_if(id.begin(), id.end(), ::isspace), id.end());
        if (!id.empty()) return id;
    }
    SYSTEM_INFO sysInfo;
    GetSystemInfo(&sysInfo);
    std::ostringstream os;
    os << "cpu-" << sysInfo.dwOemId << "-" << sysInfo.wProcessorArchitecture;
    return os.str();
}
#else
std::string HardwareDetector::get_cpu_id_windows() { return ""; }
#endif

#ifdef __APPLE__
std::string HardwareDetector::get_cpu_id_darwin() {
    std::string model = exec_command("sysctl -n hw.model");
    if (!model.empty()) {
        model.erase(std::remove_if(model.begin(), model.end(), ::isspace), model.end());
        if (!model.empty()) return "mac-" + model;
    }
    std::string brand = exec_command("sysctl -n machdep.cpu.brand_string");
    if (!brand.empty()) {
        brand.erase(std::remove_if(brand.begin(), brand.end(), ::isspace), brand.end());
        if (!brand.empty()) return sha256_hex(brand).substr(0, 16);
    }
    return "";
}
#else
std::string HardwareDetector::get_cpu_id_darwin() { return ""; }
#endif

#ifndef _WIN32
std::string HardwareDetector::get_cpu_id_linux() {
    std::ifstream f("/proc/cpuinfo");
    if (!f.is_open()) return "";
    std::string content((std::istreambuf_iterator<char>(f)),
                         std::istreambuf_iterator<char>());
    f.close();
    std::smatch match;
    if (std::regex_search(content, match, std::regex(R"(Serial\s*:\s*([0-9a-fA-F]+))"))) {
        return "cpu-" + match[1];
    }
    std::string vendor, family;
    std::istringstream stream(content);
    std::string line;
    while (std::getline(stream, line)) {
        if (line.find("vendor_id") == 0) {
            auto pos = line.find(':');
            if (pos != std::string::npos) vendor = line.substr(pos + 1);
        } else if (line.find("cpu family") == 0) {
            auto pos = line.find(':');
            if (pos != std::string::npos) family = line.substr(pos + 1);
        }
    }
    vendor.erase(std::remove_if(vendor.begin(), vendor.end(), ::isspace), vendor.end());
    family.erase(std::remove_if(family.begin(), family.end(), ::isspace), family.end());
    if (!vendor.empty() && !family.empty()) return vendor + "-" + family;
    return "";
}
#endif

std::string HardwareDetector::get_motherboard_id() {
#ifdef _WIN32
    std::string out = exec_command("wmic baseboard get SerialNumber /value");
    std::smatch match;
    if (std::regex_search(out, match, std::regex(R"(SerialNumber=(.+))"))) {
        std::string serial = match[1];
        serial.erase(std::remove_if(serial.begin(), serial.end(), ::isspace), serial.end());
        if (!serial.empty() && serial != "To be filled by O.E.M." && serial != "Default string") {
            return "mb-" + serial;
        }
    }
#elif defined(__linux__)
    std::string out = exec_command("dmidecode -s baseboard-serial-number 2>/dev/null");
    if (!out.empty()) {
        out.erase(std::remove_if(out.begin(), out.end(), ::isspace), out.end());
        if (!out.empty() && out != "To be filled by O.E.M." && out != "Default string") {
            return "mb-" + out;
        }
    }
#endif
    return "";
}

std::string HardwareDetector::get_network_id() {
#ifdef _WIN32
    IP_ADAPTER_INFO adapterInfo[16];
    DWORD bufLen = sizeof(adapterInfo);
    if (GetAdaptersInfo(adapterInfo, &bufLen) == ERROR_SUCCESS) {
        for (auto* p = adapterInfo; p; p = p->Next) {
            if (p->AddressLength >= 6) {
                std::ostringstream os;
                for (UINT i = 0; i < p->AddressLength; ++i) {
                    os << std::hex << std::setw(2) << std::setfill('0')
                       << (int)p->Address[i];
                }
                std::string mac = os.str();
                if (mac.size() >= 12 && (mac[1] - '0') % 2 == 0) {
                    return sha256_hex("net-" + mac).substr(0, 16);
                }
            }
        }
    }
#else
    std::vector<std::string> paths = {
        "/sys/class/net/eth0/address",
        "/sys/class/net/enp0s3/address",
        "/sys/class/net/wlan0/address"
    };
    for (const auto& p : paths) {
        std::ifstream f(p);
        if (f.is_open()) {
            std::string mac;
            std::getline(f, mac);
            f.close();
            if (!mac.empty()) {
                std::string clean;
                for (char c : mac) {
                    if (std::isxdigit(c)) clean += c;
                }
                if (clean.size() >= 12 && ((clean[1] - '0') % 2 == 0)) {
                    return sha256_hex("net-" + clean).substr(0, 16);
                }
            }
        }
    }
#endif
    return "";
}

std::string HardwareDetector::get_os_info() {
#ifdef _WIN32
    OSVERSIONINFOEXW osvi = {sizeof(osvi)};
    auto RtlGetVersion = (LONG(WINAPI*)(PRTL_OSVERSIONINFOW))
        GetProcAddress(GetModuleHandleA("ntdll"), "RtlGetVersion");
    if (RtlGetVersion) RtlGetVersion((PRTL_OSVERSIONINFOW)&osvi);
    std::ostringstream os;
    os << "Windows-" << osvi.dwMajorVersion << "." << osvi.dwMinorVersion;
    return os.str();
#elif defined(__APPLE__)
    struct utsname un;
    uname(&un);
    return std::string("Darwin-") + un.release;
#else
    struct utsname un;
    uname(&un);
    return std::string("Linux-") + un.release;
#endif
}

std::string HardwareDetector::build_combined_string(
    const std::map<std::string, std::string>& ids) {
    std::vector<std::string> keys = {"cpu_id", "motherboard_id", "network_id"};
    std::vector<std::string> parts;
    for (const auto& k : keys) {
        auto it = ids.find(k);
        if (it != ids.end()) parts.push_back(it->second);
    }
    std::string result;
    for (size_t i = 0; i < parts.size(); ++i) {
        if (i > 0) result += "|";
        result += parts[i];
    }
    return result;
}

std::string HardwareDetector::hash_identifiers(const std::string& data) {
    return sha256_hex(data);
}
