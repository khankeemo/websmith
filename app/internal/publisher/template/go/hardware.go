package wsd

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net"
	"os/exec"
	"runtime"
	"strings"
)

type HardwareDetector struct {
	fingerprint string
	identifiers map[string]string
}

func NewHardwareDetector() *HardwareDetector {
	return &HardwareDetector{}
}

func (h *HardwareDetector) GetFingerprint() string {
	if h.fingerprint != "" {
		return h.fingerprint
	}
	identifiers := h.collectIdentifiers()
	combined := h.buildCombinedString(identifiers)
	h.fingerprint = h.hashIdentifiers(combined)
	h.identifiers = identifiers
	return h.fingerprint
}

func (h *HardwareDetector) GetIdentifiers() map[string]string {
	if h.identifiers == nil {
		h.GetFingerprint()
	}
	result := make(map[string]string)
	for k, v := range h.identifiers {
		result[k] = v
	}
	return result
}

func (h *HardwareDetector) collectIdentifiers() map[string]string {
	identifiers := make(map[string]string)
	cpuID := h.getCPUID()
	if cpuID != "" {
		identifiers["cpu_id"] = cpuID
	}
	mbID := h.getMotherboardID()
	if mbID != "" {
		identifiers["motherboard_id"] = mbID
	}
	if mbID == "" {
		netID := h.getNetworkID()
		if netID != "" {
			identifiers["network_id"] = netID
		}
	}
	osInfo := h.getOSInfo()
	if osInfo != "" {
		identifiers["os_info"] = osInfo
	}
	return identifiers
}

func (h *HardwareDetector) getCPUID() string {
	switch runtime.GOOS {
	case "windows":
		out, err := exec.Command("wmic", "cpu", "get", "ProcessorId", "/value").Output()
		if err == nil {
			output := string(out)
			for _, line := range strings.Split(output, "\n") {
				line = strings.TrimSpace(line)
				if strings.HasPrefix(line, "ProcessorId=") {
					val := strings.TrimPrefix(line, "ProcessorId=")
					if val != "" {
						return val
					}
				}
			}
		}
	case "darwin":
		out, err := exec.Command("sysctl", "-n", "hw.model").Output()
		if err == nil {
			model := strings.TrimSpace(string(out))
			if model != "" {
				return "mac-" + model
			}
		}
		out, err = exec.Command("sysctl", "-n", "machdep.cpu.brand_string").Output()
		if err == nil {
			brand := strings.TrimSpace(string(out))
			if brand != "" {
				hash := sha256.Sum256([]byte(brand))
				return hex.EncodeToString(hash[:16])
			}
		}
	case "linux":
		out, err := exec.Command("sh", "-c", "cat /proc/cpuinfo").Output()
		if err == nil {
			content := string(out)
			for _, line := range strings.Split(content, "\n") {
				line = strings.TrimSpace(line)
				if strings.HasPrefix(line, "Serial") && strings.Contains(line, ":") {
					parts := strings.SplitN(line, ":", 2)
					val := strings.TrimSpace(parts[1])
					if val != "" {
						return "cpu-" + val
					}
				}
			}
			var vendor, family string
			for _, line := range strings.Split(content, "\n") {
				line = strings.TrimSpace(line)
				if strings.HasPrefix(line, "vendor_id") && strings.Contains(line, ":") {
					parts := strings.SplitN(line, ":", 2)
					vendor = strings.TrimSpace(parts[1])
				} else if strings.HasPrefix(line, "cpu family") && strings.Contains(line, ":") {
					parts := strings.SplitN(line, ":", 2)
					family = strings.TrimSpace(parts[1])
				}
			}
			if vendor != "" && family != "" {
				return vendor + "-" + family
			}
		}
	}
	return ""
}

func (h *HardwareDetector) getMotherboardID() string {
	switch runtime.GOOS {
	case "windows":
		out, err := exec.Command("wmic", "baseboard", "get", "SerialNumber", "/value").Output()
		if err == nil {
			output := string(out)
			for _, line := range strings.Split(output, "\n") {
				line = strings.TrimSpace(line)
				if strings.HasPrefix(line, "SerialNumber=") {
					val := strings.TrimPrefix(line, "SerialNumber=")
					val = strings.TrimSpace(val)
					if val != "" && val != "To be filled by O.E.M." && val != "Default string" {
						return "mb-" + val
					}
				}
			}
		}
	case "linux":
		out, err := exec.Command("dmidecode", "-s", "baseboard-serial-number").Output()
		if err == nil {
			serial := strings.TrimSpace(string(out))
			if serial != "" && serial != "To be filled by O.E.M." && serial != "Default string" {
				return "mb-" + serial
			}
		}
	}
	return ""
}

func (h *HardwareDetector) getNetworkID() string {
	interfaces, err := net.Interfaces()
	if err != nil {
		return ""
	}
	for _, iface := range interfaces {
		if iface.Flags&net.FlagLoopback == 0 && len(iface.HardwareAddr) > 0 {
			mac := iface.HardwareAddr.String()
			hash := sha256.Sum256([]byte("net-" + mac))
			return hex.EncodeToString(hash[:16])
		}
	}
	return ""
}

func (h *HardwareDetector) getOSInfo() string {
	return runtime.GOOS + "-" + runtime.GOARCH
}

func (h *HardwareDetector) buildCombinedString(identifiers map[string]string) string {
	parts := []string{}
	order := []string{"cpu_id", "motherboard_id", "network_id"}
	for _, key := range order {
		if val, ok := identifiers[key]; ok {
			parts = append(parts, val)
		}
	}
	return strings.Join(parts, "|")
}

func (h *HardwareDetector) hashIdentifiers(data string) string {
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:])
}
