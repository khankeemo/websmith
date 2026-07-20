package com.websmith.sdk;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.io.File;
import java.io.FileReader;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.Map;

public class LicenseEngine {

    private ApiClient client;
    private CacheManager cache;
    private HardwareDetector hardware;
    private String hardwareId;
    private JsonObject status;
    private String licenseKey;

    public static class LicenseStatus {
        public boolean valid;
        public String status;
        public String expiresAt;
        public int daysRemaining;
        public String plan;
        public String hardwareId;
        public String message;
        public String licenseKey;
        public boolean trialActive;

        public LicenseStatus(
                boolean valid, String status, String expiresAt, int daysRemaining,
                String plan, String hardwareId, String message, String licenseKey, boolean trialActive) {
            this.valid = valid;
            this.status = status;
            this.expiresAt = expiresAt;
            this.daysRemaining = daysRemaining;
            this.plan = plan;
            this.hardwareId = hardwareId;
            this.message = message;
            this.licenseKey = licenseKey;
            this.trialActive = trialActive;
        }

        public LicenseStatus(boolean valid, String status, String hardwareId, String message) {
            this(valid, status, null, 0, null, hardwareId, message, null, status.equals("trial"));
        }

        public static LicenseStatus fromJson(JsonObject data) {
            String stat = data.has("status") ? data.get("status").getAsString() : "unlicensed";
            return new LicenseStatus(
                data.has("valid") && data.get("valid").getAsBoolean(),
                stat,
                data.has("expires_at") && !data.get("expires_at").isJsonNull() ? data.get("expires_at").getAsString() : null,
                data.has("days_remaining") ? data.get("days_remaining").getAsInt() : 0,
                data.has("plan") && !data.get("plan").isJsonNull() ? data.get("plan").getAsString() : null,
                data.has("hardware_id") && !data.get("hardware_id").isJsonNull() ? data.get("hardware_id").getAsString() : null,
                data.has("message") && !data.get("message").isJsonNull() ? data.get("message").getAsString() : null,
                data.has("license_key") && !data.get("license_key").isJsonNull() ? data.get("license_key").getAsString() : null,
                data.has("trial_active") ? data.get("trial_active").getAsBoolean() : stat.equals("trial")
            );
        }

        public JsonObject toJson() {
            JsonObject obj = new JsonObject();
            obj.addProperty("valid", valid);
            obj.addProperty("status", status);
            if (expiresAt != null) obj.addProperty("expires_at", expiresAt);
            obj.addProperty("days_remaining", daysRemaining);
            if (plan != null) obj.addProperty("plan", plan);
            if (hardwareId != null) obj.addProperty("hardware_id", hardwareId);
            if (message != null) obj.addProperty("message", message);
            if (licenseKey != null) obj.addProperty("license_key", licenseKey);
            obj.addProperty("trial_active", trialActive);
            return obj;
        }
    }

    public LicenseEngine() {
        this("config/api-config.json");
    }

    public LicenseEngine(String configPath) {
        JsonObject config = loadConfigFile(configPath);
        this.hardware = new HardwareDetector();
        this.cache = new CacheManager(config);
        this.client = new ApiClient(config, this.hardware, this.cache);
        this.hardwareId = this.hardware.getFingerprint();
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

    public ApiClient getClient() { return client; }

    public LicenseStatus initialize() {
        if (cache.isValid()) {
            Object cached = cache.getLicenseStatus();
            if (cached instanceof String) {
                try {
                    JsonObject json = JsonParser.parseString((String) cached).getAsJsonObject();
                    LicenseStatus ls = LicenseStatus.fromJson(json);
                    this.status = json;
                    return ls;
                } catch (Exception ignored) {}
            }
        }
        try {
            JsonObject trialResponse = client.getTrialStatus(hardwareId);
            JsonObject trialData = trialResponse.has("data") ? trialResponse.getAsJsonObject("data") : trialResponse;
            if (trialData.has("has_trial") && trialData.get("has_trial").getAsBoolean()) {
                String statusStr = trialData.has("status") ? trialData.get("status").getAsString() : "trial";
                LicenseStatus ls = new LicenseStatus(
                    statusStr.equals("active"), statusStr,
                    trialData.has("expiry_date") && !trialData.get("expiry_date").isJsonNull()
                        ? trialData.get("expiry_date").getAsString() : null,
                    trialData.has("days_left") ? trialData.get("days_left").getAsInt() : 0,
                    trialData.has("plan") && !trialData.get("plan").isJsonNull()
                        ? trialData.get("plan").getAsString() : null,
                    hardwareId, "Trial is " + statusStr, null, statusStr.equals("trial")
                );
                if (ls.valid) {
                    cache.setLicenseStatus(ls.toJson().toString());
                }
                this.status = ls.toJson();
                return ls;
            }
            LicenseStatus unlicensed = new LicenseStatus(false, "unlicensed", hardwareId,
                "No license or trial found");
            this.status = unlicensed.toJson();
            return unlicensed;
        } catch (Exception e) {
            Object cached = cache.getLicenseStatus();
            if (cached instanceof String) {
                try {
                    JsonObject json = JsonParser.parseString((String) cached).getAsJsonObject();
                    this.status = json;
                    return LicenseStatus.fromJson(json);
                } catch (Exception ignored) {}
            }
            LicenseStatus err = new LicenseStatus(false, "error", null,
                "Unexpected error: " + e.getMessage());
            this.status = err.toJson();
            return err;
        }
    }

    public String getHardwareId() { return hardwareId; }

    public LicenseStatus getStatus() {
        if (status == null) return null;
        return LicenseStatus.fromJson(status);
    }

    public String getLicenseKey() { return licenseKey; }

    public boolean hasLicenseKey() { return licenseKey != null && !licenseKey.isEmpty(); }

    public boolean isValid() {
        LicenseStatus s = getStatus();
        if (s == null) return false;
        if (!s.valid) return false;
        if (!s.status.equals("active")) return false;
        if (s.expiresAt != null && !s.expiresAt.isEmpty()) {
            try {
                Instant expiry = Instant.from(DateTimeFormatter.ISO_INSTANT.parse(s.expiresAt));
                if (expiry.isBefore(Instant.now())) return false;
            } catch (Exception ignored) {}
        }
        return true;
    }

    public JsonObject validate(String licenseKey) throws ApiClient.ApiException {
        String key = licenseKey != null ? licenseKey : this.licenseKey;
        if (key == null || key.isEmpty()) {
            throw new IllegalArgumentException("License key unavailable. Please activate first.");
        }
        JsonObject result = client.validateLicense(key, hardwareId);
        JsonObject data = result.has("data") ? result.getAsJsonObject("data") : result;
        if (data.has("valid") && data.get("valid").getAsBoolean()) {
            if (data.has("license_key") && !data.get("license_key").isJsonNull()) {
                this.licenseKey = data.get("license_key").getAsString();
            }
            initialize();
        }
        return result;
    }

    public JsonObject activate(String licenseKey) throws ApiClient.ApiException {
        JsonObject result = client.activateLicense(licenseKey, hardwareId);
        if (result.has("success") && result.get("success").getAsBoolean()) {
            this.licenseKey = licenseKey;
            initialize();
        }
        return result;
    }

    public JsonObject startTrial(String email, String customerName, JsonObject customerData)
            throws ApiClient.ApiException {
        JsonObject result = client.startTrial(email, customerName, hardwareId, customerData);
        if (result.has("success") && result.get("success").getAsBoolean()) {
            initialize();
        }
        return result;
    }

    public JsonObject convertTrial(String plan, String customerName, String customerEmail)
            throws ApiClient.ApiException {
        LicenseStatus s = getStatus();
        if (s == null || !s.status.equals("trial")) {
            throw new RuntimeException("No active trial to convert.");
        }
        JsonObject result = client.convertTrial(hardwareId, plan, customerName, customerEmail);
        if (result.has("success") && result.get("success").getAsBoolean()) {
            if (result.has("license_key")) {
                this.licenseKey = result.get("license_key").getAsString();
            }
            initialize();
        }
        return result;
    }

    public JsonObject renew(Integer extraDays) throws ApiClient.ApiException {
        if (licenseKey == null || licenseKey.isEmpty()) {
            throw new IllegalArgumentException("License key unavailable. Please activate first.");
        }
        JsonObject result = client.renewLicense(licenseKey, extraDays);
        if (result.has("success") && result.get("success").getAsBoolean()) {
            initialize();
        }
        return result;
    }

    public JsonObject deactivate(String licenseKey) throws ApiClient.ApiException {
        String key = licenseKey != null ? licenseKey : this.licenseKey;
        if (key == null || key.isEmpty()) {
            throw new IllegalArgumentException("License key unavailable. Please provide a key.");
        }
        JsonObject result = client.deactivateLicense(key, hardwareId);
        if (result.has("success") && result.get("success").getAsBoolean()) {
            cache.invalidateLicenseStatus();
            this.status = null;
            if (licenseKey == null) {
                this.licenseKey = null;
            }
        }
        return result;
    }

    public JsonObject replaceHardware() throws ApiClient.ApiException {
        if (licenseKey == null || licenseKey.isEmpty()) {
            throw new IllegalArgumentException("License key unavailable. Please activate first.");
        }
        String newHardwareId = hardware.getFingerprint();
        String oldHardwareId = null;
        if (status != null && status.has("hardware_id") && !status.get("hardware_id").isJsonNull()) {
            oldHardwareId = status.get("hardware_id").getAsString();
        }
        if (oldHardwareId == null) {
            Object cached = cache.getLicenseStatus();
            if (cached instanceof String) {
                try {
                    JsonObject cachedJson = JsonParser.parseString((String) cached).getAsJsonObject();
                    if (cachedJson.has("hardware_id")) {
                        oldHardwareId = cachedJson.get("hardware_id").getAsString();
                    }
                } catch (Exception ignored) {}
            }
        }
        if (oldHardwareId == null) {
            throw new RuntimeException("Current hardware_id unavailable. Cannot replace device.");
        }
        if (oldHardwareId.equals(newHardwareId)) {
            JsonObject err = new JsonObject();
            err.addProperty("success", false);
            err.addProperty("message", "Old and new hardware IDs are identical.");
            return err;
        }
        JsonObject result = client.replaceDevice(licenseKey, oldHardwareId, newHardwareId);
        if (result.has("success") && result.get("success").getAsBoolean()) {
            cache.invalidateLicenseStatus();
            this.status = null;
            this.hardwareId = newHardwareId;
            initialize();
        }
        return result;
    }

    public JsonObject bindDevice(String licenseKey, String deviceName) throws ApiClient.ApiException {
        String key = licenseKey != null ? licenseKey : this.licenseKey;
        if (key == null || key.isEmpty()) {
            throw new IllegalArgumentException("License key unavailable.");
        }
        JsonObject result = client.bindDevice(key, hardwareId, deviceName);
        if (result.has("success") && result.get("success").getAsBoolean()) {
            initialize();
        }
        return result;
    }
}
