package wsd

import (
	"fmt"
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
	fmt.Println(strings.Repeat("=", 60))
	fmt.Println("REPLACE DEVICE")
	fmt.Println(strings.Repeat("=", 60))
	fmt.Println()
	fmt.Println("Device reactivation requires Websmith Support approval.")
	fmt.Println()
	supportEmail := "support@websmithdigital.com"
	if d.engine != nil && d.engine.config != nil {
		if b, ok := d.engine.config["branding"].(map[string]interface{}); ok {
			if e, ok := b["support_email"].(string); ok && e != "" {
				supportEmail = e
			}
		}
	}
	fmt.Printf("Please contact support at: %s\n", supportEmail)
	fmt.Println("The application will remain locked until reactivation is approved.")
	fmt.Println()
	return map[string]interface{}{"action": "contact_support", "support_email": supportEmail}
}
