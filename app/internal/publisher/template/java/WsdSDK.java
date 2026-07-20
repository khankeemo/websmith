package com.websmith.sdk;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.io.File;
import java.io.FileReader;

public class WsdSDK {

    private static LicenseEngine engine;
    private static JsonObject config;

    public static synchronized LicenseEngine init(String configPath) {
        if (engine == null) {
            engine = new LicenseEngine(configPath);
        }
        return engine;
    }

    public static synchronized LicenseEngine init() {
        return init("config/api-config.json");
    }

    public static LicenseEngine getEngine() {
        return engine;
    }

    public static synchronized JsonObject getConfig() {
        if (config == null) {
            config = loadConfig();
        }
        return config;
    }

    private static JsonObject loadConfig() {
        String[] paths = {"config/api-config.json", "config/api-config.json"};
        for (String path : paths) {
            File f = new File(path);
            if (f.exists()) {
                try (FileReader reader = new FileReader(f)) {
                    return JsonParser.parseReader(reader).getAsJsonObject();
                } catch (Exception ignored) {}
            }
        }
        return new JsonObject();
    }

    public static String version() {
        return "${kit_version}";
    }

    public static String runtime() {
        return "${runtime}";
    }

    public static ActivationDialogResult showActivationDialog() throws Exception {
        ActivationDialog dialog = new ActivationDialog(engine != null ? engine.getClient() : null);
        return dialog.show();
    }

    public static WelcomeDialogResult showWelcomeDialog() throws Exception {
        JsonObject cfg = getConfig();
        String productName = cfg.has("product") && cfg.getAsJsonObject("product").has("name")
            ? cfg.getAsJsonObject("product").get("name").getAsString() : "";
        boolean trialEnabled = cfg.has("trial") && cfg.getAsJsonObject("trial").has("enabled")
            ? cfg.getAsJsonObject("trial").get("enabled").getAsBoolean() : false;
        ApiClient client = engine != null ? engine.getClient() : new ApiClient();
        WelcomeDialog dialog = new WelcomeDialog(client, productName, trialEnabled);
        return dialog.show();
    }

    public static RenewalDialogResult showRenewalDialog() throws Exception {
        RenewalDialog dialog = new RenewalDialog(engine != null ? engine.getClient() : null);
        return dialog.show(null);
    }

    public static DeviceReplaceDialogResult showDeviceReplaceDialog() throws Exception {
        DeviceReplaceDialog dialog = new DeviceReplaceDialog(engine != null ? engine.getClient() : null);
        return dialog.show(null);
    }
}
