package wsd

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

type ActivationDialog struct {
	engine      *LicenseEngine
	productName string
}

func NewActivationDialog(engine *LicenseEngine, productName string) *ActivationDialog {
	return &ActivationDialog{
		engine:      engine,
		productName: productName,
	}
}

func (d *ActivationDialog) Show() map[string]interface{} {
	reader := bufio.NewReader(os.Stdin)
	fmt.Println(strings.Repeat("=", 60))
	fmt.Println("UNIVERSAL LICENSE ACTIVATION")
	if d.productName != "" {
		fmt.Printf("Product: %s\n", d.productName)
	}
	fmt.Println(strings.Repeat("=", 60))
	hwID := d.engine.GetHardwareID()
	fmt.Printf("Hardware ID: %s\n", hwID)
	fmt.Println()
	fmt.Print("Enter license key: ")
	key, _ := reader.ReadString('\n')
	key = strings.TrimSpace(key)
	if key == "" {
		fmt.Println("No license key entered. Activation cancelled.")
		return map[string]interface{}{
			"activated":   false,
			"cancelled":   true,
			"license_key": nil,
		}
	}
	fmt.Println("Activating license...")
	result, err := d.engine.Activate(key)
	if err != nil {
		fmt.Printf("Activation failed: %s\n", err.Error())
		return map[string]interface{}{
			"activated":   false,
			"cancelled":   false,
			"license_key": key,
		}
	}
	if success, ok := result["success"].(bool); ok && success {
		fmt.Println("License activated successfully!")
		return map[string]interface{}{
			"activated":   true,
			"cancelled":   false,
			"license_key": key,
		}
	}
	msg, _ := result["message"].(string)
	if msg == "" {
		msg, _ = result["error"].(string)
	}
	if msg == "" {
		msg = "Activation failed"
	}
	fmt.Printf("Activation failed: %s\n", msg)
	return map[string]interface{}{
		"activated":   false,
		"cancelled":   false,
		"license_key": key,
	}
}
