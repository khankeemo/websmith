package com.websmith.sdk;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.io.File;
import java.io.FileReader;
import java.util.HashMap;
import java.util.Map;
import java.util.Scanner;

public class ActivationDialog {

    private ApiClient client;
    private CacheManager cache;
    private HardwareDetector hardware;
    private String productName;
    private String supportEmail;

    public static class ActivationDialogResult {
        public boolean activated;
        public boolean cancelled;
        public String licenseKey;
        public String hardwareId;
        public String error;

        public ActivationDialogResult(boolean activated, boolean cancelled, String licenseKey,
                                       String hardwareId, String error) {
            this.activated = activated;
            this.cancelled = cancelled;
            this.licenseKey = licenseKey;
            this.hardwareId = hardwareId;
            this.error = error;
        }
    }

    public ActivationDialog(ApiClient client, String productName) {
        this.client = client;
        this.cache = client != null ? client.getCache() : new CacheManager(loadConfig());
        this.hardware = new HardwareDetector();
        this.productName = productName != null ? productName : "";
        JsonObject config = loadConfig();
        if (config.has("branding")) {
            JsonObject branding = config.getAsJsonObject("branding");
            this.supportEmail = branding.has("support_email") ? branding.get("support_email").getAsString() : "support@websmithdigital.com";
        } else {
            this.supportEmail = "support@websmithdigital.com";
        }
    }

    public ActivationDialog(ApiClient client) {
        this(client, null);
    }

    private static JsonObject loadConfig() {
        String[] paths = {"config/api-config.json", "config/api-config.json"};
        for (String path : paths) {
            try {
                File f = new File(path);
                if (f.exists()) {
                    try (FileReader reader = new FileReader(f)) {
                        return JsonParser.parseReader(reader).getAsJsonObject();
                    }
                }
            } catch (Exception ignored) {}
        }
        return new JsonObject();
    }

    public ActivationDialogResult show() {
        System.out.println("\n=== " + (productName.isEmpty() ? "License" : productName) + " Activation ===\n");

        System.out.println("Detecting hardware...");
        String hardwareId;
        try {
            hardwareId = hardware.getFingerprint();
            System.out.println("Hardware ID: " + hardwareId + "\n");
        } catch (Exception e) {
            System.out.println("Unable to detect hardware: " + e.getMessage());
            System.out.println("Please contact support: " + supportEmail);
            return new ActivationDialogResult(false, true, null, null, "Hardware detection failed");
        }

        Scanner scanner = new Scanner(System.in);
        System.out.print("Enter License Key: ");
        String licenseKey = scanner.nextLine().trim();
        if (licenseKey.isEmpty()) {
            System.out.println("License key is required.");
            return new ActivationDialogResult(false, true, null, null, "No license key entered");
        }

        System.out.println("\nValidating license...");
        try {
            JsonObject result = client.validateLicense(licenseKey, hardwareId);
            JsonObject data = result.has("data") ? result.getAsJsonObject("data") : result;
            boolean valid = (data.has("valid") && data.get("valid").getAsBoolean())
                || (result.has("valid") && result.get("valid").getAsBoolean());

            if (!valid) {
                String errMsg = result.has("message") ? result.get("message").getAsString()
                    : result.has("error") ? result.get("error").getAsString()
                    : "License validation failed";
                System.out.println("Validation failed: " + errMsg);
                return new ActivationDialogResult(false, true, null, null, errMsg);
            }

            int maxDev = data.has("max_devices") ? data.get("max_devices").getAsInt() : 0;
            int devCount = data.has("device_count") ? data.get("device_count").getAsInt()
                : data.has("active_devices") ? data.get("active_devices").getAsInt() : 0;
            if (maxDev > 0 && devCount >= maxDev) {
                System.out.println("Device limit reached (" + devCount + "/" + maxDev + "). Deactivate another device first.");
                System.out.println("Contact support: " + supportEmail);
                return new ActivationDialogResult(false, true, null, null, "Device limit reached");
            }

            System.out.println("\nLicense validated successfully!");
            if (data.has("expiry_date") && !data.get("expiry_date").isJsonNull()) {
                System.out.println("Expires: " + data.get("expiry_date").getAsString());
            }
            if (data.has("plan") && !data.get("plan").isJsonNull()) {
                System.out.println("Plan: " + data.get("plan").getAsString());
            }

            System.out.print("\nActivate this license on this device? (y/n): ");
            String confirm = scanner.nextLine().trim().toLowerCase();
            if (!confirm.equals("y") && !confirm.equals("yes")) {
                System.out.println("Activation cancelled.");
                return new ActivationDialogResult(false, true, null, null, null);
            }

            System.out.println("\nActivating license...");
            JsonObject activateResult = client.activateLicense(licenseKey, hardwareId);
            if ((activateResult.has("success") && activateResult.get("success").getAsBoolean())
                || (activateResult.has("data") && activateResult.getAsJsonObject("data").has("success")
                    && activateResult.getAsJsonObject("data").get("success").getAsBoolean())) {
                System.out.println("License activated successfully!");
                cache.invalidateLicenseStatus();
                return new ActivationDialogResult(true, false, licenseKey, hardwareId, null);
            } else {
                String errMsg = activateResult.has("message") ? activateResult.get("message").getAsString()
                    : activateResult.has("error") ? activateResult.get("error").getAsString()
                    : "Activation failed";
                System.out.println("Activation failed: " + errMsg);
                return new ActivationDialogResult(false, false, null, null, errMsg);
            }
        } catch (Exception e) {
            System.out.println("Error: " + e.getMessage());
            return new ActivationDialogResult(false, true, null, null, e.getMessage());
        }
    }
}
