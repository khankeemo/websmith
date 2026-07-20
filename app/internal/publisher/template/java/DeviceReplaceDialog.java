package com.websmith.sdk;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.io.File;
import java.io.FileReader;
import java.util.Scanner;

public class DeviceReplaceDialog {

    private ApiClient client;
    private CacheManager cache;
    private HardwareDetector hardware;
    private String productName;
    private String supportEmail;

    public static class DeviceReplaceDialogResult {
        public boolean replaced;
        public boolean cancelled;
        public String licenseKey;
        public String oldHardwareId;
        public String newHardwareId;
        public String error;

        public DeviceReplaceDialogResult(boolean replaced, boolean cancelled, String licenseKey,
                                           String oldHardwareId, String newHardwareId, String error) {
            this.replaced = replaced;
            this.cancelled = cancelled;
            this.licenseKey = licenseKey;
            this.oldHardwareId = oldHardwareId;
            this.newHardwareId = newHardwareId;
            this.error = error;
        }
    }

    public DeviceReplaceDialog(ApiClient client, String productName) {
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

    public DeviceReplaceDialog(ApiClient client) {
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

    public DeviceReplaceDialogResult show(String licenseKey) {
        Scanner scanner = new Scanner(System.in);
        System.out.println("\n=== Device Replacement ===\n");

        if (licenseKey == null || licenseKey.isEmpty()) {
            System.out.print("Enter License Key: ");
            licenseKey = scanner.nextLine().trim();
            if (licenseKey.isEmpty()) {
                System.out.println("License key is required.");
                return new DeviceReplaceDialogResult(false, true, null, null, null,
                    "No license key entered");
            }
        }

        System.out.print("Enter OLD Hardware ID: ");
        String oldHardwareId = scanner.nextLine().trim();
        if (oldHardwareId.isEmpty()) {
            System.out.println("Old hardware ID is required.");
            return new DeviceReplaceDialogResult(false, true, null, null, null,
                "No old hardware ID entered");
        }

        System.out.println("\nDetecting new hardware...");
        String newHardwareId;
        try {
            newHardwareId = hardware.getFingerprint();
            System.out.println("New Hardware ID: " + newHardwareId + "\n");
        } catch (Exception e) {
            System.out.println("Unable to detect new hardware: " + e.getMessage());
            System.out.println("Please contact support: " + supportEmail);
            return new DeviceReplaceDialogResult(false, true, null, null, null,
                "Hardware detection failed");
        }

        if (oldHardwareId.equals(newHardwareId)) {
            System.out.println("Old and new hardware IDs are identical. No replacement needed.");
            return new DeviceReplaceDialogResult(false, true, null, null, null,
                "Identical hardware IDs");
        }

        System.out.println("Replace device from:");
        System.out.println("  Old: " + oldHardwareId);
        System.out.println("  New: " + newHardwareId);
        System.out.print("Proceed? (y/n): ");
        String confirm = scanner.nextLine().trim().toLowerCase();
        if (!confirm.equals("y") && !confirm.equals("yes")) {
            System.out.println("Device replacement cancelled.");
            return new DeviceReplaceDialogResult(false, true, null, null, null, null);
        }

        System.out.println("\nReplacing device...");
        try {
            JsonObject result = client.replaceDevice(licenseKey, oldHardwareId, newHardwareId);
            if (result.has("success") && result.get("success").getAsBoolean()) {
                System.out.println("Device replaced successfully!");
                cache.invalidateLicenseStatus();
                return new DeviceReplaceDialogResult(true, false, licenseKey, oldHardwareId,
                    newHardwareId, null);
            } else {
                String errMsg = result.has("message") ? result.get("message").getAsString()
                    : result.has("error") ? result.get("error").getAsString()
                    : "Replacement failed";
                System.out.println("Replacement failed: " + errMsg);
                return new DeviceReplaceDialogResult(false, false, null, null, null, errMsg);
            }
        } catch (Exception e) {
            System.out.println("Error: " + e.getMessage());
            return new DeviceReplaceDialogResult(false, true, null, null, null, e.getMessage());
        }
    }
}
