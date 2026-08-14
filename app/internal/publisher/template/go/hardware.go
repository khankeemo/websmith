package websmith

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

type Fingerprint struct {
	Fingerprint  string   `json:"fingerprint"`
	MacAddresses []string `json:"mac_addresses"`
	OS           string   `json:"os"`
	CPU          string   `json:"cpu"`
	Motherboard  string   `json:"motherboard"`
	GeneratedAt  string   `json:"generated_at"`
}

func GenerateFingerprint() Fingerprint {
	macs := getMACAddresses()
	cpu := getCPUFingerprint()
	mb := getMotherboardSerial()
	parts := []string{
		strings.Join(macs, ":"),
		cpu,
		mb,
		runtime.GOOS,
		runtime.GOARCH,
	}
	combined := strings.Join(parts, "|")
	hash := sha256.Sum256([]byte(combined))
	return Fingerprint{
		Fingerprint:  hex.EncodeToString(hash[:]),
		MacAddresses: macs,
		OS:           runtime.GOOS + "/" + runtime.GOARCH,
		CPU:          cpu,
		Motherboard:  mb,
		GeneratedAt:  time.Now().UTC().Format(time.RFC3339),
	}
}

func getMACAddresses() []string {
	interfaces, err := net.Interfaces()
	if err != nil {
		return nil
	}
	var macs []string
	for _, iface := range interfaces {
		if iface.Flags&net.FlagLoopback == 0 && len(iface.HardwareAddr) > 0 {
			macs = append(macs, iface.HardwareAddr.String())
		}
	}
	if len(macs) > 3 {
		macs = macs[:3]
	}
	return macs
}

func getCPUFingerprint() string {
	if runtime.GOOS == "linux" {
		out, err := exec.Command("sh", "-c", "cat /proc/cpuinfo | grep 'model name' | head -1").Output()
		if err == nil {
			if s := strings.TrimSpace(string(out)); s != "" {
				return s
			}
		}
	}
	return fmt.Sprintf("%s_%d", runtime.GOARCH, runtime.NumCPU())
}

func getMotherboardSerial() string {
	switch runtime.GOOS {
	case "linux":
		out, err := exec.Command("sh", "-c",
			"cat /sys/class/dmi/id/board_serial 2>/dev/null || "+
				"cat /sys/class/dmi/id/product_uuid 2>/dev/null || "+
				"cat /sys/class/dmi/id/product_serial 2>/dev/null",
		).Output()
		if err == nil {
			if s := strings.TrimSpace(string(out)); s != "" {
				return s
			}
		}
	case "windows":
		out, err := exec.Command("powershell", "-Command",
			"Get-WmiObject -Class Win32_BaseBoard | Select-Object -ExpandProperty Serial",
		).Output()
		if err == nil {
			if s := strings.TrimSpace(string(out)); s != "" {
				return s
			}
		}
	case "darwin":
		out, err := exec.Command("sh", "-c",
			"system_profiler SPHardwareDataType | awk '/Serial/ {print $4}'",
		).Output()
		if err == nil {
			if s := strings.TrimSpace(string(out)); s != "" {
				return s
			}
		}
	}
	return ""
}
