package com.websmith.sdk.widgets;

import com.websmith.sdk.LicenseEngine;
import com.websmith.sdk.LicenseEngine.LicenseStatus;

public class DashboardWidget {
    public static void render() {
        System.out.println("\n=== License Dashboard ===\n");
        try {
            LicenseEngine engine = new LicenseEngine();
            LicenseStatus status = engine.initialize();
            System.out.println("License Status: " + status.status);
            System.out.println("Valid: " + (status.valid ? "Yes" : "No"));
            if (status.expiresAt != null) {
                System.out.println("Expires: " + status.expiresAt);
            }
            System.out.println("Days Remaining: " + status.daysRemaining);
            if (status.plan != null) {
                System.out.println("Plan: " + status.plan);
            }
            if (status.hardwareId != null) {
                System.out.println("Hardware ID: " + status.hardwareId);
            }
            if (status.licenseKey != null) {
                System.out.println("License Key: " + status.licenseKey);
            }
            if (status.message != null) {
                System.out.println("Message: " + status.message);
            }
            System.out.println("Trial Active: " + (status.trialActive ? "Yes" : "No"));
            String line = "----------------------------------------";
            System.out.println("\n" + line);
            System.out.println("License Key Available: " + (engine.hasLicenseKey() ? "Yes" : "No"));
            System.out.println("Hardware ID: " + engine.getHardwareId());
        } catch (Exception e) {
            System.out.println("Dashboard error: " + e.getMessage());
        }
    }
}
