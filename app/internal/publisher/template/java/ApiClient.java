package com.websmith.sdk;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.io.File;
import java.io.FileReader;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HashSet;
import java.util.Set;

public class ApiClient {

    private static final Set<Integer> RETRYABLE_STATUSES = new HashSet<>();
    static {
        RETRYABLE_STATUSES.add(500);
        RETRYABLE_STATUSES.add(502);
        RETRYABLE_STATUSES.add(503);
        RETRYABLE_STATUSES.add(504);
    }

    private final String apiKey;
    private final String apiSecret;
    private final String baseUrl;
    private final String apiVersion;
    private final String productId;
    private final int retryCount;
    private final int timeoutMs;
    private final HttpClient httpClient;
    private final Gson gson;
    private HardwareDetector hardware;
    private CacheManager cache;

    public ApiClient() {
        this("config/api-config.json");
    }

    public ApiClient(String configPath) {
        JsonObject config = loadConfigFile(configPath);
        JsonObject api = config.has("api") ? config.getAsJsonObject("api") : new JsonObject();
        JsonObject product = config.has("product") ? config.getAsJsonObject("product") : new JsonObject();
        this.apiKey = getJsonString(api, "public_key");
        this.apiSecret = getJsonString(api, "secret");
        String envUrl = System.getenv("WEBSMITH_API_URL");
        this.baseUrl = (envUrl != null ? envUrl : getJsonString(api, "url")).replaceAll("/+$", "");
        this.apiVersion = getJsonString(api, "version");
        if (this.apiVersion.isEmpty()) this.apiVersion = "v1";
        this.productId = getJsonString(product, "id");
        this.retryCount = getJsonInt(api, "retry_count", 3);
        this.timeoutMs = getJsonInt(api, "timeout", 30000);
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofMillis(this.timeoutMs))
            .build();
        this.gson = new Gson();
        this.hardware = new HardwareDetector();
        this.cache = new CacheManager(config);
    }

    public ApiClient(JsonObject config, HardwareDetector hardware, CacheManager cache) {
        JsonObject api = config.has("api") ? config.getAsJsonObject("api") : new JsonObject();
        JsonObject product = config.has("product") ? config.getAsJsonObject("product") : new JsonObject();
        this.apiKey = getJsonString(api, "public_key");
        this.apiSecret = getJsonString(api, "secret");
        String envUrl = System.getenv("WEBSMITH_API_URL");
        this.baseUrl = (envUrl != null ? envUrl : getJsonString(api, "url")).replaceAll("/+$", "");
        this.apiVersion = getJsonString(api, "version");
        if (this.apiVersion.isEmpty()) this.apiVersion = "v1";
        this.productId = getJsonString(product, "id");
        this.retryCount = getJsonInt(api, "retry_count", 3);
        this.timeoutMs = getJsonInt(api, "timeout", 30000);
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofMillis(this.timeoutMs))
            .build();
        this.gson = new Gson();
        this.hardware = hardware;
        this.cache = cache;
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
        try (InputStreamReader reader = new InputStreamReader(
                ApiClient.class.getClassLoader().getResourceAsStream(path))) {
            if (reader != null) {
                return JsonParser.parseReader(reader).getAsJsonObject();
            }
        } catch (Exception ignored) {}
        JsonObject fallback = new JsonObject();
        JsonObject api = new JsonObject();
        api.addProperty("public_key", "");
        api.addProperty("secret", "");
        api.addProperty("url", "");
        api.addProperty("version", "v1");
        api.addProperty("retry_count", 3);
        api.addProperty("timeout", 30000);
        fallback.add("api", api);
        fallback.add("product", new JsonObject());
        return fallback;
    }

    private static String getJsonString(JsonObject obj, String key) {
        if (obj != null && obj.has(key) && !obj.get(key).isJsonNull()) {
            return obj.get(key).getAsString();
        }
        return "";
    }

    private static int getJsonInt(JsonObject obj, String key, int def) {
        if (obj != null && obj.has(key) && !obj.get(key).isJsonNull()) {
            try { return obj.get(key).getAsInt(); } catch (Exception ignored) {}
        }
        return def;
    }

    public static class ApiException extends Exception {
        private final int statusCode;
        private final JsonObject responseData;

        public ApiException(int statusCode, String message) {
            this(statusCode, message, null);
        }

        public ApiException(int statusCode, String message, JsonObject data) {
            super(message);
            this.statusCode = statusCode;
            this.responseData = data;
        }

        public int getStatusCode() { return statusCode; }
        public JsonObject getResponseData() { return responseData; }
    }

    private String getHardwareId() {
        return hardware.getFingerprint();
    }

    public HardwareDetector getHardware() {
        return hardware;
    }

    public CacheManager getCache() {
        return cache;
    }

    private JsonObject signRequestHeaders(JsonObject payload, String method, String path, String query)
            throws Exception {
        String timestamp = CryptoUtils.generateTimestamp();
        String nonce = CryptoUtils.generateNonce();
        String signature = CryptoUtils.signRequest(payload, apiSecret, timestamp, nonce, method, path, query);
        JsonObject headers = new JsonObject();
        headers.addProperty("x-api-key", apiKey);
        headers.addProperty("x-timestamp", timestamp);
        headers.addProperty("x-nonce", nonce);
        headers.addProperty("x-signature", signature);
        return headers;
    }

    private JsonObject request(String endpoint, JsonObject data) throws ApiException {
        String url = baseUrl + "/api/" + apiVersion + "/" + endpoint;
        String apiPath = "/api/" + apiVersion + "/" + endpoint;
        int maxRetries = retryCount;

        if (productId != null && !productId.isEmpty() && !data.has("product_id")) {
            data.addProperty("product_id", productId);
        }

        for (int attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                String timestamp = CryptoUtils.generateTimestamp();
                String nonce = CryptoUtils.generateNonce();
                String signature = CryptoUtils.signRequest(data, apiSecret, timestamp, nonce, "POST", apiPath, "");

                String bodyJson = gson.toJson(data);
                HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Content-Type", "application/json")
                    .header("X-API-Key", apiKey)
                    .header("X-Timestamp", timestamp)
                    .header("X-Nonce", nonce)
                    .header("X-Signature", signature)
                    .method("POST", HttpRequest.BodyPublishers.ofString(bodyJson, StandardCharsets.UTF_8))
                    .build();

                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                int status = response.statusCode();
                String responseBody = response.body();

                JsonObject result;
                try {
                    result = JsonParser.parseString(responseBody).getAsJsonObject();
                } catch (Exception e) {
                    result = new JsonObject();
                    result.addProperty("message", responseBody);
                }

                if (status >= 200 && status < 300) {
                    return result;
                }

                if (status == 429) {
                    if (attempt < maxRetries) {
                        int retryAfter = 5;
                        if (result.has("retry_after")) {
                            try { retryAfter = result.get("retry_after").getAsInt(); } catch (Exception ignored) {}
                        }
                        Thread.sleep(retryAfter * 1000L);
                        continue;
                    }
                    throw new ApiException(status, "Rate limit exceeded", result);
                }

                if (RETRYABLE_STATUSES.contains(status)) {
                    if (attempt < maxRetries) {
                        Thread.sleep((long) ((attempt + 1) * 2 * 1000L));
                        continue;
                    }
                }

                String msg = result.has("message") ? result.get("message").getAsString()
                    : result.has("error") ? result.get("error").getAsString()
                    : "HTTP " + status;
                throw new ApiException(status, msg, result);

            } catch (ApiException e) {
                throw e;
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new ApiException(500, "Request interrupted");
            } catch (Exception e) {
                if (attempt < maxRetries) {
                    try { Thread.sleep((long) ((attempt + 1) * 2 * 1000L)); } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        throw new ApiException(500, "Request interrupted");
                    }
                    continue;
                }
                throw new ApiException(500, "Request failed after " + maxRetries + " retries: " + e.getMessage());
            }
        }
        throw new ApiException(500, "Request failed after " + maxRetries + " retries");
    }

    public JsonObject validateLicense(String licenseKey, String hardwareId) throws ApiException {
        JsonObject data = new JsonObject();
        data.addProperty("action", "validate");
        data.addProperty("license_key", licenseKey);
        data.addProperty("hardware_id", hardwareId);
        if (cache != null && cache.isValid()) {
            Object cached = cache.get("license_status");
            if (cached instanceof String) {
                try {
                    return JsonParser.parseString((String) cached).getAsJsonObject();
                } catch (Exception ignored) {}
            }
        }
        JsonObject response = request("license", data);
        if (cache != null && response.has("success") && response.get("success").getAsBoolean()
            && response.has("data") && response.getAsJsonObject("data").has("valid")
            && response.getAsJsonObject("data").get("valid").getAsBoolean()) {
            cache.set("license_status", response.toString());
        }
        return response;
    }

    public JsonObject activateLicense(String licenseKey, String hardwareId) throws ApiException {
        JsonObject data = new JsonObject();
        data.addProperty("action", "activate");
        data.addProperty("license_key", licenseKey);
        data.addProperty("hardware_id", hardwareId);
        JsonObject response = request("license", data);
        if (cache != null) {
            cache.remove("license_status");
        }
        return response;
    }

    public JsonObject deactivateLicense(String licenseKey, String hardwareId) throws ApiException {
        JsonObject data = new JsonObject();
        data.addProperty("action", "deactivate");
        data.addProperty("license_key", licenseKey);
        data.addProperty("hardware_id", hardwareId);
        JsonObject response = request("license", data);
        if (cache != null) {
            cache.remove("license_status");
        }
        return response;
    }

    public JsonObject renewLicense(String licenseKey, Integer extraDays) throws ApiException {
        JsonObject data = new JsonObject();
        data.addProperty("action", "renew");
        data.addProperty("license_key", licenseKey);
        if (extraDays != null) {
            data.addProperty("extra_days", extraDays);
        }
        JsonObject response = request("license", data);
        if (cache != null) {
            cache.remove("license_status");
        }
        return response;
    }

    public JsonObject startTrial(String email, String customerName, String hardwareId, JsonObject customerData)
            throws ApiException {
        JsonObject data = new JsonObject();
        data.addProperty("action", "start");
        data.addProperty("customer_email", email);
        data.addProperty("customer_name", customerName != null ? customerName : "");
        data.addProperty("hardware_id", hardwareId);
        if (customerData != null) {
            for (var entry : customerData.entrySet()) {
                data.add(entry.getKey(), entry.getValue());
            }
        }
        return request("trial", data);
    }

    public JsonObject getTrialStatus(String hardwareId) throws ApiException {
        return request("trial", createPayload("status", "hardware_id", hardwareId));
    }

    public JsonObject convertTrial(String hardwareId, String plan, String name, String email) throws ApiException {
        JsonObject data = new JsonObject();
        data.addProperty("action", "convert");
        data.addProperty("hardware_id", hardwareId);
        if (plan != null) data.addProperty("plan", plan);
        if (name != null && !name.isEmpty()) data.addProperty("customer_name", name);
        if (email != null && !email.isEmpty()) data.addProperty("customer_email", email);
        return request("trial", data);
    }

    public JsonObject replaceDevice(String licenseKey, String oldHardwareId, String newHardwareId)
            throws ApiException {
        JsonObject data = new JsonObject();
        data.addProperty("action", "replace");
        data.addProperty("license_key", licenseKey);
        data.addProperty("old_hardware_id", oldHardwareId);
        data.addProperty("new_hardware_id", newHardwareId);
        JsonObject response = request("device", data);
        if (cache != null) {
            cache.remove("license_status");
        }
        return response;
    }

    public JsonObject bindDevice(String licenseKey, String hardwareId, String deviceName) throws ApiException {
        JsonObject data = new JsonObject();
        data.addProperty("action", "bind");
        data.addProperty("license_key", licenseKey);
        data.addProperty("hardware_id", hardwareId);
        if (deviceName != null && !deviceName.isEmpty()) {
            data.addProperty("device_name", deviceName);
        }
        return request("device", data);
    }

    public JsonObject getProducts() {
        JsonObject payload = new JsonObject();
        payload.addProperty("action", "list");
        if (productId != null && !productId.isEmpty()) {
            payload.addProperty("product_id", productId);
        }
        try {
            return request("store/products", payload);
        } catch (ApiException e) {
            JsonObject fallback = new JsonObject();
            fallback.addProperty("success", false);
            return fallback;
        }
    }

    private static JsonObject createPayload(String action, String key, String value) {
        JsonObject obj = new JsonObject();
        obj.addProperty("action", action);
        obj.addProperty(key, value);
        return obj;
    }
}
