package com.websmith.sdk;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.io.File;
import java.io.FileReader;
import java.nio.file.Path;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.Map;

public class LicenseEngine {
    private final Client client;
    private final CacheManager cache;
    private final String hardwareId;
    private JsonObject licenseData;
    private String licenseKey;

    public LicenseEngine() {
        this("config/api-config.json");
    }

    public LicenseEngine(String configPath) {
        JsonObject config = loadConfig(configPath);
        this.client = new Client(configPath);
        this.cache = new CacheManager(config);
        this.hardwareId = HardwareFingerprint.generate();
        this.licenseData = null;
        this.licenseKey = null;
    }

    private static JsonObject loadConfig(String path) {
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

    public JsonObject validate(String licenseKey) throws Client.ApiException {
        this.licenseKey = licenseKey;
        String cachedStatus = (String) cache.get("license_status");
        if (cachedStatus != null) {
            try {
                JsonObject cached = JsonParser.parseString(cachedStatus).getAsJsonObject();
                if (cached.has("valid") && cached.get("valid").getAsBoolean()) {
                    this.licenseData = cached;
                    return cached;
                }
            } catch (Exception ignored) {}
        }
        JsonObject result = client.validateLicense(licenseKey, hardwareId);
        if (result.has("license")) {
            this.licenseData = result.getAsJsonObject("license");
        } else {
            this.licenseData = result;
        }
        if (result.has("valid") && result.get("valid").getAsBoolean()) {
            cache.set("license_status", this.licenseData.toString());
        }
        return result;
    }

    public JsonObject activate(String licenseKey, String deviceName) throws Client.ApiException {
        this.licenseKey = licenseKey;
        JsonObject result = client.activateLicense(licenseKey, hardwareId, deviceName);
        if (result.has("license")) {
            this.licenseData = result.getAsJsonObject("license");
        } else if (result.has("valid") && result.get("valid").getAsBoolean()) {
            this.licenseData = result;
        }
        if (result.has("valid") && result.get("valid").getAsBoolean()) {
            cache.set("license_status", this.licenseData.toString());
        } else {
            cache.remove("license_status");
        }
        return result;
    }

    public JsonObject deactivate(String licenseKey) throws Client.ApiException {
        String key = licenseKey != null ? licenseKey : this.licenseKey;
        if (key == null || key.isEmpty()) {
            throw new IllegalArgumentException("License key is required");
        }
        JsonObject result = client.deactivateLicense(key, hardwareId);
        this.licenseData = null;
        if (licenseKey == null || licenseKey.equals(this.licenseKey)) {
            this.licenseKey = null;
        }
        cache.remove("license_status");
        return result;
    }

    public JsonObject renew(String licenseKey, Integer extraDays) throws Client.ApiException {
        String key = licenseKey != null ? licenseKey : this.licenseKey;
        if (key == null || key.isEmpty()) {
            throw new IllegalArgumentException("License key is required");
        }
        JsonObject result = client.renewLicense(key, extraDays);
        if (result.has("license")) {
            this.licenseData = result.getAsJsonObject("license");
        }
        cache.remove("license_status");
        return result;
    }

    public JsonObject startTrial(String email, String customerName) throws Client.ApiException {
        return startTrial(email, customerName, null);
    }

    public JsonObject startTrial(String email, String customerName, JsonObject customerData) throws Client.ApiException {
        JsonObject result = client.startTrial(email, customerName, hardwareId, customerData);
        if (result.has("license")) {
            this.licenseData = result.getAsJsonObject("license");
        }
        cache.remove("license_status");
        return result;
    }

    public JsonObject checkTrial() throws Client.ApiException {
        JsonObject result = client.checkTrial(hardwareId);
        if (result.has("license")) {
            this.licenseData = result.getAsJsonObject("license");
        }
        return result;
    }

    public JsonObject convertTrial(String plan, String name, String email) throws Client.ApiException {
        JsonObject result = client.convertTrial(hardwareId, plan, name, email);
        if (result.has("license_key")) {
            this.licenseKey = result.get("license_key").getAsString();
        }
        if (result.has("license")) {
            this.licenseData = result.getAsJsonObject("license");
        }
        cache.remove("license_status");
        return result;
    }

    public JsonObject viewHardwareStatus() throws Client.ApiException {
        String currentHw = HardwareDetector.getHardwareId();
        JsonObject validateResult = validate();
        JsonObject data = validateResult.getAsJsonObject("data");
        String registeredHw = data != null && data.has("hardware_id") ? data.get("hardware_id").getAsString() : "";
        JsonObject result = new JsonObject();
        result.addProperty("matched", currentHw.equals(registeredHw));
        result.addProperty("current_hardware_id", currentHw);
        result.addProperty("registered_hardware_id", registeredHw);
        result.addProperty("message", "Hardware replacement requires administrator approval. Please contact support.");
        return result;
    }

    public JsonObject bindDevice(String licenseKey, String deviceName) throws Client.ApiException {
        String key = licenseKey != null ? licenseKey : this.licenseKey;
        if (key == null || key.isEmpty()) {
            throw new IllegalArgumentException("License key is required");
        }
        JsonObject result = client.bindDevice(key, hardwareId, deviceName);
        if (result.has("license")) {
            this.licenseData = result.getAsJsonObject("license");
        }
        cache.remove("license_status");
        return result;
    }

    public boolean hasLicenseKey() {
        return licenseKey != null && !licenseKey.isEmpty();
    }

    public boolean isValid() {
        if (licenseData == null) {
            String cached = (String) cache.get("license_status");
            if (cached != null) {
                try {
                    licenseData = JsonParser.parseString(cached).getAsJsonObject();
                } catch (Exception ignored) {}
            }
        }
        if (licenseData == null) return false;
        if (!licenseData.has("status")) return false;
        String status = licenseData.get("status").getAsString();
        if (!"active".equals(status)) return false;
        if (licenseData.has("expires_at") && !licenseData.get("expires_at").isJsonNull()) {
            try {
                String expiresAt = licenseData.get("expires_at").getAsString();
                Instant expiry = Instant.from(DateTimeFormatter.ISO_INSTANT.parse(expiresAt));
                if (expiry.isBefore(Instant.now())) return false;
            } catch (Exception ignored) {}
        }
        return true;
    }

    public JsonObject getLicenseInfo() {
        return licenseData;
    }
}
