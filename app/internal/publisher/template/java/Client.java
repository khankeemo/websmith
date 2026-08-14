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
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

public class Client {
    private final String apiKey;
    private final String apiSecret;
    private final String baseUrl;
    private final String productId;
    private final int retryCount;
    private final int timeoutMs;
    private final HttpClient httpClient;
    private final Gson gson;

    public Client() {
        this("config/api-config.json");
    }

    public Client(String configPath) {
        JsonObject config = loadConfig(configPath);
        JsonObject api = config.getAsJsonObject("api");
        JsonObject product = config.getAsJsonObject("product");
        this.apiKey = getJsonString(api, "public_key");
        this.apiSecret = getJsonString(api, "secret");
        String envUrl = System.getenv("WEBSMITH_API_URL");
        this.baseUrl = (envUrl != null ? envUrl : getJsonString(api, "url")).replaceAll("/+$", "");
        this.productId = getJsonString(product, "id");
        this.retryCount = getJsonInt(api, "retry_count", 3);
        this.timeoutMs = getJsonInt(api, "timeout", 30000);
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(java.time.Duration.ofMillis(this.timeoutMs))
            .build();
        this.gson = new Gson();
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
        try (InputStreamReader reader = new InputStreamReader(
                Client.class.getClassLoader().getResourceAsStream(path))) {
            if (reader != null) {
                return JsonParser.parseReader(reader).getAsJsonObject();
            }
        } catch (Exception ignored) {}
        JsonObject fallback = new JsonObject();
        JsonObject api = new JsonObject();
        api.addProperty("public_key", "");
        api.addProperty("secret", "");
        api.addProperty("url", "");
        api.addProperty("retry_count", 3);
        api.addProperty("timeout", 30000);
        fallback.add("api", api);
        JsonObject product = new JsonObject();
        product.addProperty("id", "");
        fallback.add("product", product);
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

    private String generateTimestamp() {
        return Instant.now().toString();
    }

    private String generateNonce() {
        return UUID.randomUUID().toString();
    }

    private String signPayload(JsonObject payload, String timestamp, String nonce,
                               String method, String path, String query) throws Exception {
        String bodyJson = gson.toJson(payload);
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        String bodyHash = bytesToHex(md.digest(bodyJson.getBytes(StandardCharsets.UTF_8)));
        String canonical = method + "\n" + path + "\n" + query + "\n" + bodyHash + "\n" + timestamp + "\n" + nonce;
        Mac mac = Mac.getInstance("HmacSHA256");
        SecretKeySpec keySpec = new SecretKeySpec(apiSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        mac.init(keySpec);
        return Base64.getEncoder().encodeToString(mac.doFinal(canonical.getBytes(StandardCharsets.UTF_8)));
    }

    private JsonObject request(String endpoint, JsonObject data) throws ApiException {
        String url = baseUrl + endpoint;
        String apiPath = "/api/v1/" + endpoint;
        String method = "POST";
        String query = "";
        int maxRetries = retryCount;

        if (productId != null && !productId.isEmpty() && !data.has("product_id")) {
            data.addProperty("product_id", productId);
        }

        for (int attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                String timestamp = generateTimestamp();
                String nonce = generateNonce();
                String signature = signPayload(data, timestamp, nonce, method, apiPath, query);

                String bodyJson = gson.toJson(data);
                HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Content-Type", "application/json")
                    .header("X-API-Key", apiKey)
                    .header("X-Timestamp", timestamp)
                    .header("X-Nonce", nonce)
                    .header("X-Signature", signature)
                    .method(method, HttpRequest.BodyPublishers.ofString(bodyJson, StandardCharsets.UTF_8))
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

                if (status >= 500) {
                    if (attempt < maxRetries) {
                        Thread.sleep((long) ((attempt + 1) * 2 * 1000L));
                        continue;
                    }
                }

                String msg = "HTTP " + status;
                if (result.has("message")) msg = result.get("message").getAsString();
                else if (result.has("error")) msg = result.get("error").getAsString();
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

    private static String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) sb.append(String.format("%02x", b));
        return sb.toString();
    }

    public JsonObject validateLicense(String licenseKey, String hardwareId) throws ApiException {
        JsonObject data = new JsonObject();
        data.addProperty("action", "validate");
        data.addProperty("license_key", licenseKey);
        data.addProperty("hardware_id", hardwareId);
        return request("license", data);
    }

    public JsonObject activateLicense(String licenseKey, String hardwareId, String deviceName) throws ApiException {
        JsonObject data = new JsonObject();
        data.addProperty("action", "activate");
        data.addProperty("license_key", licenseKey);
        data.addProperty("hardware_id", hardwareId);
        if (deviceName != null && !deviceName.isEmpty()) {
            data.addProperty("device_name", deviceName);
        }
        return request("license", data);
    }

    public JsonObject deactivateLicense(String licenseKey, String hardwareId) throws ApiException {
        JsonObject data = new JsonObject();
        data.addProperty("action", "deactivate");
        data.addProperty("license_key", licenseKey);
        data.addProperty("hardware_id", hardwareId);
        return request("license", data);
    }

    public JsonObject renewLicense(String licenseKey, Integer extraDays) throws ApiException {
        JsonObject data = new JsonObject();
        data.addProperty("action", "renew");
        data.addProperty("license_key", licenseKey);
        if (extraDays != null) {
            data.addProperty("extra_days", extraDays);
        }
        return request("license", data);
    }

    public JsonObject startTrial(String email, String customerName, String hardwareId,
                                  JsonObject customerData) throws ApiException {
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

    public JsonObject checkTrial(String hardwareId) throws ApiException {
        JsonObject data = new JsonObject();
        data.addProperty("action", "status");
        data.addProperty("hardware_id", hardwareId);
        return request("trial", data);
    }

    public JsonObject convertTrial(String hardwareId, String plan, String name, String email) throws ApiException {
        JsonObject data = new JsonObject();
        data.addProperty("action", "convert");
        data.addProperty("hardware_id", hardwareId);
        data.addProperty("plan", plan);
        data.addProperty("customer_name", name);
        data.addProperty("customer_email", email);
        return request("trial", data);
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

    public JsonObject getTrialStatus(String hardwareId) throws ApiException {
        JsonObject data = new JsonObject();
        data.addProperty("action", "status");
        data.addProperty("hardware_id", hardwareId);
        return request("trial", data);
    }

    public JsonObject getProducts() throws ApiException {
        JsonObject data = new JsonObject();
        data.addProperty("action", "list");
        return request("store/products", data);
    }
}
