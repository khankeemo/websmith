package wsd

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

type DeviceReplaceDialog struct {
	engine     *LicenseEngine
	licenseKey string
}

func NewDeviceReplaceDialog(engine *LicenseEngine, licenseKey string) *DeviceReplaceDialog {
	return &DeviceReplaceDialog{
		engine:     engine,
		licenseKey: licenseKey,
	}
}

func (d *DeviceReplaceDialog) Show() map[string]interface{} {
	reader := bufio.NewReader(os.Stdin)
	fmt.Println(strings.Repeat("=", 60))
	fmt.Println("REPLACE DEVICE")
	fmt.Println(strings.Repeat("=", 60))
	if d.licenseKey != "" {
		fmt.Printf("License Key: %s\n", d.licenseKey)
	}
	status := d.engine.GetStatus()
	oldHW := ""
	if status != nil && status.HardwareID != "" {
		oldHW = status.HardwareID
	} else {
		cached := d.engine.cache.GetLicenseStatus()
		if cached != nil {
			if hwID, ok := cached["hardware_id"].(string); ok {
				oldHW = hwID
			}
		}
	}
	if oldHW != "" {
		fmt.Printf("Old Hardware ID: %s\n", oldHW)
	} else {
		fmt.Println("Old Hardware ID: Unknown")
	}
	newHW := d.engine.GetHardwareID()
	fmt.Printf("New Hardware ID: %s\n", newHW)
	fmt.Println()
	fmt.Print("Enter device name (optional): ")
	devName, _ := reader.ReadString('\n')
	devName = strings.TrimSpace(devName)
	fmt.Print("Proceed with device replacement? (y/N): ")
	confirm, _ := reader.ReadString('\n')
	confirm = strings.TrimSpace(strings.ToLower(confirm))
	if confirm != "y" && confirm != "yes" {
		fmt.Println("Device replacement cancelled.")
		return map[string]interface{}{"action": "cancelled"}
	}
	fmt.Println("Replacing device...")
	if d.licenseKey != "" {
		d.engine.licenseKey = d.licenseKey
	}
	result, err := d.engine.ReplaceHardware()
	if err != nil {
		fmt.Printf("Device replacement failed: %s\n", err.Error())
		return map[string]interface{}{"action": "failed", "error": err.Error()}
	}
	if success, ok := result["success"].(bool); ok && success {
		fmt.Println("Device replaced successfully!")
		if devName != "" {
			d.engine.BindDevice("", devName)
		}
		return map[string]interface{}{"action": "device_replaced"}
	}
	msg, _ := result["message"].(string)
	if msg == "" {
		msg = "Device replacement failed"
	}
	fmt.Printf("Device replacement failed: %s\n", msg)
	return map[string]interface{}{"action": "failed", "error": msg}
}
