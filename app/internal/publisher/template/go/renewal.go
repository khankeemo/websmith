package wsd

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

type RenewalDialog struct {
	engine     *LicenseEngine
	licenseKey string
}

func NewRenewalDialog(engine *LicenseEngine, licenseKey string) *RenewalDialog {
	return &RenewalDialog{
		engine:     engine,
		licenseKey: licenseKey,
	}
}

func (d *RenewalDialog) Show() map[string]interface{} {
	reader := bufio.NewReader(os.Stdin)
	fmt.Println(strings.Repeat("=", 60))
	fmt.Println("RENEW LICENSE")
	fmt.Println(strings.Repeat("=", 60))
	if d.licenseKey != "" {
		fmt.Printf("License Key: %s\n", d.licenseKey)
	}
	status := d.engine.GetStatus()
	if status != nil {
		fmt.Printf("Current Plan: %s\n", status.Plan)
		fmt.Printf("Expires: %s\n", status.ExpiresAt)
	} else {
		d.engine.Initialize()
		status = d.engine.GetStatus()
		if status != nil {
			fmt.Printf("Current Plan: %s\n", status.Plan)
			fmt.Printf("Expires: %s\n", status.ExpiresAt)
		}
	}
	fmt.Println()
	fmt.Print("Enter extra days to renew (or press Enter for default): ")
	input, _ := reader.ReadString('\n')
	input = strings.TrimSpace(input)
	var result map[string]interface{}
	var err error
	if input != "" {
		var extraDays int
		if _, scanErr := fmt.Sscanf(input, "%d", &extraDays); scanErr == nil && extraDays > 0 {
			result, err = d.engine.Renew(extraDays)
		} else {
			result, err = d.engine.Renew()
		}
	} else {
		result, err = d.engine.Renew()
	}
	if err != nil {
		fmt.Printf("Renewal failed: %s\n", err.Error())
		return map[string]interface{}{"action": "failed", "error": err.Error()}
	}
	if success, ok := result["success"].(bool); ok && success {
		fmt.Println("License renewed successfully!")
		return map[string]interface{}{"action": "renewed"}
	}
	msg, _ := result["message"].(string)
	if msg == "" {
		msg = "Renewal failed"
	}
	fmt.Printf("Renewal failed: %s\n", msg)
	return map[string]interface{}{"action": "failed", "error": msg}
}
