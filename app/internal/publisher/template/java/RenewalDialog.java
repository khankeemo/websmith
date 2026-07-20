package com.websmith.sdk;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.io.File;
import java.io.FileReader;
import java.util.Scanner;

public class RenewalDialog {

    private ApiClient client;
    private CacheManager cache;
    private String productName;
    private String supportEmail;

    public static class RenewalDialogResult {
        public boolean renewed;
        public boolean cancelled;
        public String licenseKey;
        public String expiry;
        public String error;

        public RenewalDialogResult(boolean renewed, boolean cancelled, String licenseKey,
                                    String expiry, String error) {
            this.renewed = renewed;
            this.cancelled = cancelled;
            this.licenseKey = licenseKey;
            this.expiry = expiry;
            this.error = error;
        }
    }

    public RenewalDialog(ApiClient client, String productName) {
        this.client = client;
        this.cache = client != null ? client.getCache() : new CacheManager(loadConfig());
        this.productName = productName != null ? productName : "";
        JsonObject config = loadConfig();
        if (config.has("branding")) {
            JsonObject branding = config.getAsJsonObject("branding");
            this.supportEmail = branding.has("support_email") ? branding.get("support_email").getAsString() : "support@websmithdigital.com";
        } else {
            this.supportEmail = "support@websmithdigital.com";
        }
    }

    public RenewalDialog(ApiClient client) {
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

    public RenewalDialogResult show(String licenseKey) {
        Scanner scanner = new Scanner(System.in);

        if (licenseKey == null || licenseKey.isEmpty()) {
            System.out.println("\n=== License Renewal ===\n");
            System.out.print("Enter License Key to renew: ");
            licenseKey = scanner.nextLine().trim();
            if (licenseKey.isEmpty()) {
                System.out.println("License key is required.");
                return new RenewalDialogResult(false, true, null, null, "No license key entered");
            }
        }

        System.out.print("\nHow many days to renew? (leave empty for default): ");
        String input = scanner.nextLine().trim();
        Integer extraDays = null;
        if (!input.isEmpty()) {
            try {
                extraDays = Integer.parseInt(input);
            } catch (NumberFormatException e) {
                System.out.println("Invalid number. Using default duration.");
            }
        }

        System.out.println("\nProcessing renewal for license key: " + licenseKey);
        if (extraDays != null) {
            System.out.println("Extra days: " + extraDays);
        }

        try {
            JsonObject result = client.renewLicense(licenseKey, extraDays);
            if (result.has("success") && result.get("success").getAsBoolean()) {
                JsonObject data = result.has("data") ? result.getAsJsonObject("data") : result;
                String expiry = data.has("expiry_date") ? data.get("expiry_date").getAsString()
                    : data.has("expires_at") ? data.get("expires_at").getAsString() : "N/A";
                System.out.println("\nLicense renewed successfully!");
                System.out.println("New expiry: " + expiry);
                cache.invalidateLicenseStatus();
                return new RenewalDialogResult(true, false, licenseKey, expiry, null);
            } else {
                String errMsg = result.has("message") ? result.get("message").getAsString()
                    : result.has("error") ? result.get("error").getAsString()
                    : "Renewal failed";
                System.out.println("\nRenewal failed: " + errMsg);
                return new RenewalDialogResult(false, false, null, null, errMsg);
            }
        } catch (Exception e) {
            System.out.println("\nError: " + e.getMessage());
            return new RenewalDialogResult(false, true, null, null, e.getMessage());
        }
    }
}
