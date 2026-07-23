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
        public String action;

        public DeviceReplaceDialogResult(boolean replaced, boolean cancelled, String licenseKey,
                                           String oldHardwareId, String newHardwareId, String error) {
            this.replaced = replaced;
            this.cancelled = cancelled;
            this.licenseKey = licenseKey;
            this.oldHardwareId = oldHardwareId;
            this.newHardwareId = newHardwareId;
            this.error = error;
        }

        public DeviceReplaceDialogResult(String action) {
            this.action = action;
            this.cancelled = true;
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
        System.out.println("\n=== Device Replacement ===\n");
        System.out.println("Device reactivation requires Websmith Support approval.\n");
        System.out.println("Please contact support at: " + supportEmail);
        System.out.println("The application will remain locked until reactivation is approved.\n");
        return new DeviceReplaceDialogResult("contact_support");
    }
}
