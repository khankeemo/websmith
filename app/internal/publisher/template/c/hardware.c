#include "hardware.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#ifdef _WIN32
#include <windows.h>
#include <iphlpapi.h>
#pragma comment(lib, "iphlpapi.lib")
#else
#include <unistd.h>
#include <sys/utsname.h>
#endif

static char* wsd_exec(const char* cmd) {
    FILE* pipe = NULL;
#ifdef _WIN32
    pipe = _popen(cmd, "r");
#else
    pipe = popen(cmd, "r");
#endif
    if (!pipe) return NULL;
    size_t cap = 256, len = 0;
    char* result = malloc(cap);
    if (!result) { pclose(pipe); return NULL; }
    char buf[128];
    while (fgets(buf, sizeof(buf), pipe)) {
        size_t blen = strlen(buf);
        if (len + blen + 1 >= cap) { cap *= 2; result = realloc(result, cap); if (!result) { pclose(pipe); return NULL; } }
        memcpy(result + len, buf, blen + 1);
        len += blen;
    }
#ifdef _WIN32
    _pclose(pipe);
#else
    pclose(pipe);
#endif
    result[len] = '\0';
    return result;
}

static char* trim_c(char* s) {
    if (!s) return NULL;
    while (*s == ' ' || *s == '\t' || *s == '\n' || *s == '\r') s++;
    char* end = s + strlen(s) - 1;
    while (end > s && (*end == ' ' || *end == '\t' || *end == '\n' || *end == '\r')) end--;
    *(end + 1) = '\0';
    return s;
}

static char* get_cpu_id(void) {
#ifdef _WIN32
    char* out = wsd_exec("wmic cpu get ProcessorId /value");
    if (!out) return NULL;
    char* match = strstr(out, "ProcessorId=");
    char* result = NULL;
    if (match) {
        char* val = match + 12;
        char* trimmed = trim_c(val);
        if (trimmed && *trimmed) result = strdup(trimmed);
    }
    free(out);
    if (result) return result;
    SYSTEM_INFO sysInfo;
    GetSystemInfo(&sysInfo);
    char buf[64];
    sprintf(buf, "cpu-%lu-%u", sysInfo.dwOemId, sysInfo.wProcessorArchitecture);
    return strdup(buf);
#elif defined(__APPLE__)
    char* model = wsd_exec("sysctl -n hw.model 2>/dev/null");
    if (model) {
        char* t = trim_c(model);
        if (t && *t) {
            char buf[128];
            sprintf(buf, "mac-%s", t);
            free(model);
            return strdup(buf);
        }
        free(model);
    }
    char* brand = wsd_exec("sysctl -n machdep.cpu.brand_string 2>/dev/null");
    if (brand) {
        char* t = trim_c(brand);
        if (t && *t) {
            char* hash = wsd_sha256_hex(t);
            free(brand);
            if (hash) { hash[16] = '\0'; return hash; }
        }
        free(brand);
    }
    return NULL;
#else
    FILE* f = fopen("/proc/cpuinfo", "r");
    if (!f) return NULL;
    char buf[256];
    char vendor[64] = "", family[64] = "";
    while (fgets(buf, sizeof(buf), f)) {
        if (strncmp(buf, "vendor_id", 9) == 0) {
            char* c = strchr(buf, ':');
            if (c) { strncpy(vendor, trim_c(c + 1), sizeof(vendor) - 1); vendor[sizeof(vendor)-1] = '\0'; }
        } else if (strncmp(buf, "cpu family", 10) == 0) {
            char* c = strchr(buf, ':');
            if (c) { strncpy(family, trim_c(c + 1), sizeof(family) - 1); family[sizeof(family)-1] = '\0'; }
        }
    }
    fclose(f);
    if (vendor[0] && family[0]) {
        char* result = malloc(strlen(vendor) + strlen(family) + 2);
        if (result) sprintf(result, "%s-%s", vendor, family);
        return result;
    }
    return NULL;
#endif
}

static char* get_motherboard_id(void) {
#ifdef _WIN32
    char* out = wsd_exec("wmic baseboard get SerialNumber /value");
    if (!out) return NULL;
    char* match = strstr(out, "SerialNumber=");
    char* result = NULL;
    if (match) {
        char* val = trim_c(match + 13);
        if (val && *val && strcmp(val, "To be filled by O.E.M.") != 0 && strcmp(val, "Default string") != 0) {
            char buf[128];
            sprintf(buf, "mb-%s", val);
            result = strdup(buf);
        }
    }
    free(out);
    return result;
#elif defined(__linux__)
    char* out = wsd_exec("dmidecode -s baseboard-serial-number 2>/dev/null");
    if (!out) return NULL;
    char* t = trim_c(out);
    char* result = NULL;
    if (t && *t && strcmp(t, "To be filled by O.E.M.") != 0 && strcmp(t, "Default string") != 0) {
        char buf[128];
        sprintf(buf, "mb-%s", t);
        result = strdup(buf);
    }
    free(out);
    return result;
#else
    (void)0;
    return NULL;
#endif
}

static char* get_network_id(void) {
#ifdef _WIN32
    IP_ADAPTER_INFO adapters[16];
    DWORD bufLen = sizeof(adapters);
    if (GetAdaptersInfo(adapters, &bufLen) == ERROR_SUCCESS) {
        for (PIP_ADAPTER_INFO p = adapters; p; p = p->Next) {
            if (p->AddressLength >= 6) {
                char mac[64];
                char hex[32] = "";
                for (UINT i = 0; i < p->AddressLength; ++i) {
                    char byte[4];
                    sprintf(byte, "%02x", (unsigned char)p->Address[i]);
                    strcat(hex, byte);
                }
                if (strlen(hex) >= 12 && ((hex[1] - '0') % 2 == 0)) {
                    char combined[128];
                    sprintf(combined, "net-%s", hex);
                    char* hash = wsd_sha256_hex(combined);
                    if (hash) hash[16] = '\0';
                    return hash;
                }
            }
        }
    }
    return NULL;
#else
    const char* paths[] = {
        "/sys/class/net/eth0/address",
        "/sys/class/net/enp0s3/address",
        "/sys/class/net/wlan0/address",
        NULL
    };
    for (int i = 0; paths[i]; ++i) {
        FILE* f = fopen(paths[i], "r");
        if (f) {
            char mac[32] = "";
            if (fgets(mac, sizeof(mac), f)) {
                fclose(f);
                char clean[32] = "";
                int ci = 0;
                for (int j = 0; mac[j] && ci < 30; ++j) {
                    if (isxdigit((unsigned char)mac[j])) clean[ci++] = mac[j];
                }
                clean[ci] = '\0';
                if (strlen(clean) >= 12 && ((clean[1] - '0') % 2 == 0)) {
                    char combined[128];
                    sprintf(combined, "net-%s", clean);
                    char* hash = wsd_sha256_hex(combined);
                    if (hash) hash[16] = '\0';
                    return hash;
                }
            } else fclose(f);
        }
    }
    return NULL;
#endif
}

static char* get_os_info(void) {
#ifdef _WIN32
    OSVERSIONINFOEXW osvi = {sizeof(osvi)};
    typedef LONG (WINAPI *RtlGetVersion_t)(PRTL_OSVERSIONINFOW);
    RtlGetVersion_t RtlGetVersion = (RtlGetVersion_t)GetProcAddress(GetModuleHandleA("ntdll"), "RtlGetVersion");
    if (RtlGetVersion) RtlGetVersion((PRTL_OSVERSIONINFOW)&osvi);
    char buf[64];
    sprintf(buf, "Windows-%lu.%lu", osvi.dwMajorVersion, osvi.dwMinorVersion);
    return strdup(buf);
#elif defined(__APPLE__)
    struct utsname un;
    uname(&un);
    char buf[128];
    sprintf(buf, "Darwin-%s", un.release);
    return strdup(buf);
#else
    struct utsname un;
    uname(&un);
    char buf[128];
    sprintf(buf, "Linux-%s", un.release);
    return strdup(buf);
#endif
}

HardwareDetector* wsd_hardware_new(void) {
    HardwareDetector* hw = calloc(1, sizeof(HardwareDetector));
    if (hw) hw->identifiers = wsd_json_map_new();
    return hw;
}

void wsd_hardware_free(HardwareDetector* hw) {
    if (!hw) return;
    wsd_json_free(hw->identifiers);
    free(hw);
}

const char* wsd_get_fingerprint(HardwareDetector* hw) {
    if (!hw) return "";
    if (hw->initialized) return hw->fingerprint;

    char* cpu = get_cpu_id();
    char* mb = get_motherboard_id();
    char* net = NULL;
    if (!mb || !*mb) net = get_network_id();
    char* os = get_os_info();

    if (cpu) wsd_json_set(hw->identifiers, "cpu_id", cpu);
    if (mb) wsd_json_set(hw->identifiers, "motherboard_id", mb);
    if (net) wsd_json_set(hw->identifiers, "network_id", net);
    if (os) wsd_json_set(hw->identifiers, "os_info", os);

    size_t combined_len = 1;
    if (cpu) combined_len += strlen(cpu);
    if (mb) combined_len += strlen(mb) + 1;
    if (net) combined_len += strlen(net) + 1;
    char* combined = calloc(combined_len + 1, 1);
    if (!combined) { free(cpu); free(mb); free(net); free(os); return ""; }
    if (cpu) strcat(combined, cpu);
    if (mb) { if (strlen(combined) > 0) strcat(combined, "|"); strcat(combined, mb); }
    if (!mb && net) { if (strlen(combined) > 0) strcat(combined, "|"); strcat(combined, net); }

    char* hash = wsd_sha256_hex(combined);
    if (hash) {
        strncpy(hw->fingerprint, hash, 64);
        hw->fingerprint[64] = '\0';
        free(hash);
    }
    free(combined);
    free(cpu);
    free(mb);
    free(net);
    free(os);
    hw->initialized = 1;
    return hw->fingerprint;
}

JsonMap* wsd_get_identifiers(HardwareDetector* hw) {
    if (!hw) return NULL;
    if (!hw->initialized) wsd_get_fingerprint(hw);
    return hw->identifiers;
}
