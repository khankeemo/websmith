package com.websmith.sdk.widgets;

import com.websmith.sdk.LicenseEngine;
import com.websmith.sdk.LicenseEngine.LicenseStatus;

public class StatusWidget {
    public static void render() {
        System.out.println("\n--- License Status ---\n");
        try {
            LicenseEngine engine = new LicenseEngine();
            LicenseStatus status = engine.initialize();
            System.out.println("Status: " + status.status.toUpperCase());
            System.out.println("Valid: " + (status.valid ? "YES" : "NO"));
            String line = "----------------------------------------";
            System.out.println(line);
            System.out.println("Expires At: " + (status.expiresAt != null ? status.expiresAt : "N/A"));
            System.out.println("Days Remaining: " + status.daysRemaining);
            System.out.println("Plan: " + (status.plan != null ? status.plan : "N/A"));
            System.out.println("Hardware ID: " + (status.hardwareId != null ? status.hardwareId : "N/A"));
            System.out.println("License Key: " + (status.licenseKey != null ? status.licenseKey : "N/A"));
            System.out.println(line);
            System.out.println("Message: " + (status.message != null ? status.message : "N/A"));
            System.out.println("Trial Active: " + (status.trialActive ? "Yes" : "No"));
            System.out.println(line);
            if (status.valid) {
                System.out.println("License is ACTIVE");
                if (status.daysRemaining > 0 && status.daysRemaining <= 7) {
                    System.out.println("WARNING: License expires in " + status.daysRemaining + " day(s)!");
                }
            } else if (status.status.equals("trial")) {
                System.out.println("Trial is active with " + status.daysRemaining + " day(s) remaining.");
            } else if (status.status.equals("expired")) {
                System.out.println("License has expired. Please renew.");
            } else if (status.status.equals("unlicensed")) {
                System.out.println("No license found. Please activate or start a trial.");
            } else {
                System.out.println("Status: " + status.status);
                if (status.message != null) {
                    System.out.println(status.message);
                }
            }
        } catch (Exception e) {
            System.out.println("Status check failed: " + e.getMessage());
        }
    }
}
