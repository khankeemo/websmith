package com.websmith.sdk.widgets;

import com.websmith.sdk.ApiClient;
import com.websmith.sdk.CacheManager;
import com.websmith.sdk.HardwareDetector;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.io.File;
import java.io.FileReader;
import java.util.Scanner;

public class ActivationButtonWidget {
    public static void render() {
        System.out.println("\n--- Activation Widget ---\n");
        JsonObject config = loadConfig();
        if (config == null || config.entrySet().isEmpty()) {
            System.out.println("Error: api-config.json not found.");
            return;
        }
        CacheManager cache = new CacheManager(config);
        HardwareDetector hardware = new HardwareDetector();
        String hardwareId;
        try {
            hardwareId = hardware.getFingerprint();
            System.out.println("Hardware ID: " + hardwareId + "\n");
        } catch (Exception e) {
            System.out.println("Hardware detection failed: " + e.getMessage());
            return;
        }
        Scanner scanner = new Scanner(System.in);
        System.out.print("Enter License Key: ");
        String licenseKey = scanner.nextLine().trim();
        if (licenseKey.isEmpty()) {
            System.out.println("License key is required.");
            return;
        }
        try {
            ApiClient client = new ApiClient(config, hardware, cache);
            System.out.println("Activating license...");
            JsonObject result = client.activateLicense(licenseKey, hardwareId);
            if ((result.has("success") && result.get("success").getAsBoolean())
                || (result.has("data") && result.getAsJsonObject("data").has("success")
                    && result.getAsJsonObject("data").get("success").getAsBoolean())) {
                System.out.println("License activated successfully!");
                cache.invalidateLicenseStatus();
            } else {
                String err = result.has("message") ? result.get("message").getAsString()
                    : result.has("error") ? result.get("error").getAsString()
                    : "Activation failed";
                System.out.println("Failed: " + err);
            }
        } catch (Exception e) {
            System.out.println("Error: " + e.getMessage());
        }
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
        return null;
    }
}
