package com.websmith.sdk.widgets;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.io.File;
import java.io.FileReader;

public class SettingsWidget {
    public static void render() {
        System.out.println("\n--- SDK Settings ---\n");
        JsonObject config = loadConfig();
        if (config == null || config.entrySet().isEmpty()) {
            System.out.println("No configuration loaded.");
            return;
        }
        System.out.println("API Settings:");
        if (config.has("api")) {
            JsonObject api = config.getAsJsonObject("api");
            String url = api.has("url") ? api.get("url").getAsString() : "Not set";
            String version = api.has("version") ? api.get("version").getAsString() : "v1";
            int timeout = api.has("timeout") ? api.get("timeout").getAsInt() : 30000;
            int retryCount = api.has("retry_count") ? api.get("retry_count").getAsInt() : 3;
            String pubKey = api.has("public_key") ? api.get("public_key").getAsString() : "Not set";
            String maskedKey = pubKey.length() > 8 ? pubKey.substring(0, 8) + "..." : pubKey;
            System.out.println("  URL: " + url);
            System.out.println("  Version: " + version);
            System.out.println("  Timeout: " + timeout + "ms");
            System.out.println("  Retry Count: " + retryCount);
            System.out.println("  Public Key: " + maskedKey);
        }
        if (config.has("product")) {
            JsonObject product = config.getAsJsonObject("product");
            System.out.println("\nProduct Settings:");
            System.out.println("  ID: " + (product.has("id") ? product.get("id").getAsString() : "Not set"));
            System.out.println("  Name: " + (product.has("name") ? product.get("name").getAsString() : "Not set"));
        }
        if (config.has("trial")) {
            JsonObject trial = config.getAsJsonObject("trial");
            System.out.println("\nTrial Settings:");
            System.out.println("  Enabled: " + (trial.has("enabled") && trial.get("enabled").getAsBoolean() ? "Yes" : "No"));
            System.out.println("  Days: " + (trial.has("days") ? trial.get("days").getAsInt() : 0));
        }
        if (config.has("offline")) {
            JsonObject offline = config.getAsJsonObject("offline");
            System.out.println("\nOffline Settings:");
            System.out.println("  Cache Days: " + (offline.has("cache_days") ? offline.get("cache_days").getAsInt() : 0));
        }
        if (config.has("branding")) {
            JsonObject branding = config.getAsJsonObject("branding");
            System.out.println("\nBranding:");
            System.out.println("  Company: " + (branding.has("company_name") ? branding.get("company_name").getAsString() : "Not set"));
            System.out.println("  Support Email: " + (branding.has("support_email") ? branding.get("support_email").getAsString() : "support@websmithdigital.com"));
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
