package com.websmith.sdk;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.io.File;
import java.io.FileReader;
import java.util.HashMap;
import java.util.Map;
import java.util.Scanner;

public class WelcomeDialog {

    private final ApiClient client;
    private final HardwareDetector hardware;
    private final CacheManager cache;
    private final String productName;
    private final boolean trialEnabled;
    private final String supportEmail;

    public WelcomeDialog(ApiClient client, String productName, boolean trialEnabled) {
        this.client = client;
        this.hardware = new HardwareDetector();
        this.cache = client != null ? client.getCache() : new CacheManager();
        this.productName = productName != null ? productName : "";
        this.trialEnabled = trialEnabled;
        this.supportEmail = "support@websmithdigital.com";
    }

    public WelcomeDialog(ApiClient client, String productName) {
        this(client, productName, true);
    }

    public WelcomeDialog(ApiClient client) {
        this(client, loadProductName(client), loadTrialEnabled(client));
    }

    private static String loadProductName(ApiClient client) {
        if (client == null) return "";
        try {
            JsonObject config = loadConfigFile("config/api-config.json");
            if (config.has("product")) {
                JsonObject product = config.getAsJsonObject("product");
                if (product.has("name")) {
                    return product.get("name").getAsString();
                }
            }
        } catch (Exception ignored) {}
        return "";
    }

    private static boolean loadTrialEnabled(ApiClient client) {
        if (client == null) return false;
        try {
            JsonObject config = loadConfigFile("config/api-config.json");
            if (config.has("trial")) {
                JsonObject trial = config.getAsJsonObject("trial");
                if (trial.has("enabled")) {
                    return trial.get("enabled").getAsBoolean();
                }
            }
        } catch (Exception ignored) {}
        return false;
    }

    private static JsonObject loadConfigFile(String path) {
        try {
            File f = new File(path);
            if (f.exists()) {
                try (FileReader reader = new FileReader(f)) {
                    return JsonParser.parseReader(reader).getAsJsonObject();
                }
            }
        } catch (Exception ignored) {}
        return new JsonObject();
    }

    public boolean isOnboardingComplete() {
        return cache.isOnboardingComplete();
    }

    public Map<String, Object> show() {
        Map<String, Object> result = new HashMap<>();
        if (!trialEnabled) {
            System.out.println("Trial onboarding is not enabled for this product.");
            result.put("skipped", true);
            result.put("message", "Trial not enabled");
            return result;
        }
        if (isOnboardingComplete()) {
            System.out.println("Onboarding has already been completed.");
            result.put("skipped", true);
            result.put("message", "Already completed");
            return result;
        }

        System.out.println("\n=== Welcome to " + (productName.isEmpty() ? "Software" : productName) + " ===\n");
        System.out.println("Complete your registration to start the trial.\n");

        Scanner scanner = new Scanner(System.in);
        System.out.print("Name *: ");
        String name = scanner.nextLine().trim();
        while (name.isEmpty()) {
            System.out.print("Name is required. Please enter your name: ");
            name = scanner.nextLine().trim();
        }

        System.out.print("Email *: ");
        String email = scanner.nextLine().trim();
        while (email.isEmpty() || !email.contains("@")) {
            System.out.print("Valid email is required. Please enter your email: ");
            email = scanner.nextLine().trim();
        }

        System.out.print("Company (optional): ");
        String company = scanner.nextLine().trim();

        System.out.println("\nStarting trial for: " + name + " <" + email + ">...\n");

        try {
            String hardwareId = hardware.getFingerprint();
            Map<String, Object> customerData = new HashMap<>();
            customerData.put("company_name", company);
            customerData.put("hardware_id", hardwareId);

            com.google.gson.JsonObject extraData = new com.google.gson.JsonObject();
            extraData.addProperty("company_name", company);
            extraData.addProperty("hardware_id", hardwareId);

            com.google.gson.JsonObject trialResult = client.startTrial(email, name, hardwareId, extraData);

            if (trialResult.has("success") && trialResult.get("success").getAsBoolean()) {
                cache.setOnboardingComplete();
                System.out.println("\nTrial activated successfully! You can now use the software.\n");
                result.put("name", name);
                result.put("email", email);
                result.put("hardware_id", hardwareId);
                result.put("onboarding_complete", true);
                return result;
            }

            String errorMsg = trialResult.has("error") ? trialResult.get("error").getAsString()
                : trialResult.has("message") ? trialResult.get("message").getAsString()
                : "Unknown error";
            System.out.println("\nFailed to start trial: " + errorMsg);
            result.put("skipped", true);
            result.put("message", errorMsg);
            return result;
        } catch (Exception e) {
            System.out.println("\nError: " + e.getMessage());
            result.put("skipped", true);
            result.put("message", e.getMessage());
            return result;
        }
    }
}
