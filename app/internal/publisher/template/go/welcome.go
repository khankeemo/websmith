package wsd

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

type WelcomeDialog struct {
	engine      *LicenseEngine
	productName string
}

func NewWelcomeDialog(engine *LicenseEngine, productName string) *WelcomeDialog {
	return &WelcomeDialog{
		engine:      engine,
		productName: productName,
	}
}

func (d *WelcomeDialog) IsOnboardingComplete() bool {
	return d.engine.cache.IsOnboardingComplete()
}

func (d *WelcomeDialog) Show() map[string]interface{} {
	if d.IsOnboardingComplete() {
		fmt.Println("Onboarding already completed.")
		return map[string]interface{}{"skipped": true, "message": "Onboarding already completed"}
	}
	if !d.engine.config.Trial.Enabled {
		fmt.Println("Trial onboarding is not enabled.")
		return map[string]interface{}{"skipped": true, "message": "Trial onboarding is not enabled"}
	}
	reader := bufio.NewReader(os.Stdin)
	fmt.Println(strings.Repeat("=", 60))
	title := d.productName
	if title == "" {
		title = d.engine.config.Product.Name
	}
	if title == "" {
		title = "Software"
	}
	fmt.Printf("Welcome to %s\n", title)
	fmt.Println("Complete your registration to start the trial")
	fmt.Println(strings.Repeat("=", 60))
	fmt.Print("Name *: ")
	name, _ := reader.ReadString('\n')
	name = strings.TrimSpace(name)
	if name == "" {
		fmt.Println("Name is required.")
		return map[string]interface{}{"skipped": true, "error": "Name is required"}
	}
	fmt.Print("Email *: ")
	email, _ := reader.ReadString('\n')
	email = strings.TrimSpace(email)
	if email == "" || !strings.Contains(email, "@") {
		fmt.Println("Valid email is required.")
		return map[string]interface{}{"skipped": true, "error": "Valid email is required"}
	}
	fmt.Print("Mobile Number *: ")
	mobile, _ := reader.ReadString('\n')
	mobile = strings.TrimSpace(mobile)
	if mobile == "" || len(mobile) < 4 {
		fmt.Println("Valid mobile number is required.")
		return map[string]interface{}{"skipped": true, "error": "Valid mobile number is required"}
	}
	fmt.Print("Company (optional): ")
	company, _ := reader.ReadString('\n')
	company = strings.TrimSpace(company)
	fmt.Println()
	fmt.Println("Sending OTP to your email...")
	otpResult, err := d.engine.client.request("auth/otp/send", map[string]interface{}{
		"email": email,
	})
	if err != nil || otpResult == nil || !otpResult["success"].(bool) {
		fmt.Println("Failed to send OTP. Continuing directly...")
	}
	fmt.Print("Enter OTP (or press Enter to skip): ")
	otp, _ := reader.ReadString('\n')
	otp = strings.TrimSpace(otp)
	if otp != "" {
		verifyResult, err := d.engine.client.request("auth/otp/verify", map[string]interface{}{
			"email": email,
			"otp":   otp,
		})
		if err == nil && verifyResult != nil {
			if success, ok := verifyResult["success"].(bool); ok && success {
				fmt.Println("OTP verified!")
			} else {
				fmt.Println("OTP verification failed, but continuing...")
			}
		}
	}
	fmt.Println("Activating trial...")
	hardwareID := d.engine.GetHardwareID()
	customerData := map[string]interface{}{
		"mobile":      mobile,
		"hardware_id": hardwareID,
	}
	if company != "" {
		customerData["company_name"] = company
	}
	_, err = d.engine.client.request("customer/register", map[string]interface{}{
		"name":        name,
		"email":       email,
		"mobile":      mobile,
		"hardware_id": hardwareID,
	})
	if err != nil {
		fmt.Printf("Warning: Customer registration issue: %s\n", err.Error())
	}
	trialResult, err := d.engine.StartTrial(email, name, customerData)
	if err != nil {
		fmt.Printf("Trial activation failed: %s\n", err.Error())
		return map[string]interface{}{
			"skipped":  false,
			"error":    err.Error(),
			"name":     name,
			"email":    email,
		}
	}
	if success, ok := trialResult["success"].(bool); ok && success {
		d.engine.cache.SetOnboardingComplete()
		fmt.Println("Trial activated! You can now use the software.")
		return map[string]interface{}{
			"name":               name,
			"email":              email,
			"hardware_id":        hardwareID,
			"onboarding_complete": true,
		}
	}
	fmt.Println("Trial activation had issues, but setup completed.")
	d.engine.cache.SetOnboardingComplete()
	return map[string]interface{}{
		"name":               name,
		"email":              email,
		"hardware_id":        hardwareID,
		"onboarding_complete": true,
	}
}
