import { PublisherContext } from '../index';

export function getJavaTemplates(context: PublisherContext): Record<string, string> {
  const safeProductName = context.productName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const pomVersion = context.kitVersion;
  return {
    'Client.java': `package com.websmith.sdk;

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
        String canonical = method + "\\n" + path + "\\n" + query + "\\n" + bodyHash + "\\n" + timestamp + "\\n" + nonce;
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

    public JsonObject replaceHardware(String licenseKey, String oldHardwareId, String newHardwareId) throws ApiException {
        JsonObject data = new JsonObject();
        data.addProperty("action", "replace");
        data.addProperty("license_key", licenseKey);
        data.addProperty("old_hardware_id", oldHardwareId);
        data.addProperty("new_hardware_id", newHardwareId);
        return request("device", data);
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
}
`,
    'HardwareFingerprint.java': `package com.websmith.sdk;

import java.net.NetworkInterface;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class HardwareFingerprint {

    public static String generate() {
        Map<String, String> identifiers = collectIdentifiers();
        String combined = buildCombinedString(identifiers);
        return hashIdentifiers(combined);
    }

    public static Map<String, Object> generateFingerprint() {
        try {
            Map<String, String> identifiers = collectIdentifiers();
            String combined = buildCombinedString(identifiers);
            String fingerprint = hashIdentifiers(combined);

            Map<String, Object> result = new HashMap<>();
            result.put("fingerprint", fingerprint);
            if (identifiers.containsKey("mac")) {
                result.put("macAddresses", Collections.singletonList(identifiers.get("mac")));
            }
            result.put("os", System.getProperty("os.name"));
            result.put("arch", System.getProperty("os.arch"));
            return result;
        } catch (Exception e) {
            // Degraded but deterministic fallback: hash available system properties
            String degraded = System.getProperty("os.name", "unknown")
                + System.getProperty("os.version", "unknown")
                + System.getProperty("user.name", "unknown")
                + Runtime.getRuntime().availableProcessors();
            try {
                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                Map<String, Object> result = new HashMap<>();
                result.put("fingerprint", bytesToHex(digest.digest(degraded.getBytes())));
                result.put("os", System.getProperty("os.name"));
                return result;
            } catch (Exception e2) {
                // Absolute fallback: hash a hostname-based string (still deterministic)
                Map<String, Object> result = new HashMap<>();
                String hostname;
                try { hostname = java.net.InetAddress.getLocalHost().getHostName(); }
                catch (Exception e3) { hostname = "unknown-host"; }
                result.put("fingerprint", bytesToHex(
                    java.security.MessageDigest.getInstance("SHA-256")
                        .digest((hostname + degraded).getBytes())));
                result.put("os", System.getProperty("os.name"));
                return result;
            }
        }
    }

    private static Map<String, String> collectIdentifiers() {
        Map<String, String> ids = new HashMap<>();

        String cpuId = getCpuId();
        if (cpuId != null) {
            ids.put("cpu", cpuId);
        }

        String motherboardId = getMotherboardId();
        if (motherboardId != null) {
            ids.put("motherboard", motherboardId);
            ids.remove("mac");
            return ids;
        }

        String macId = getMacId();
        if (macId != null) {
            ids.put("mac", macId);
        }

        return ids;
    }

    private static String getCpuId() {
        StringBuilder sb = new StringBuilder();
        sb.append(System.getProperty("os.arch", "unknown"));
        sb.append("-");
        sb.append(Runtime.getRuntime().availableProcessors());
        return sb.toString();
    }

    private static String getMotherboardId() {
        String os = System.getProperty("os.name", "").toLowerCase();
        try {
            if (os.contains("win")) {
                Process process = Runtime.getRuntime().exec(
                    new String[]{"wmic", "baseboard", "get", "SerialNumber", "/value"});
                java.io.BufferedReader reader = new java.io.BufferedReader(
                    new java.io.InputStreamReader(process.getInputStream()));
                String line;
                while ((line = reader.readLine()) != null) {
                    if (line.startsWith("SerialNumber=")) {
                        String serial = line.substring("SerialNumber=".length()).trim();
                        if (!serial.isEmpty() && !"To be filled by O.E.M.".equalsIgnoreCase(serial)
                            && !"Default string".equalsIgnoreCase(serial)) {
                            return "mb-" + serial;
                        }
                    }
                }
            } else if (os.contains("linux")) {
                Process process = Runtime.getRuntime().exec(
                    new String[]{"dmidecode", "-s", "baseboard-serial-number"});
                java.io.BufferedReader reader = new java.io.BufferedReader(
                    new java.io.InputStreamReader(process.getInputStream()));
                String serial = reader.readLine();
                if (serial != null) {
                    serial = serial.trim();
                    if (!serial.isEmpty() && !"To be filled by O.E.M.".equalsIgnoreCase(serial)
                        && !"Default string".equalsIgnoreCase(serial)) {
                        return "mb-" + serial;
                    }
                }
            }
        } catch (Exception ignored) {}
        return null;
    }

    private static String getMacId() {
        try {
            List<String> macs = new ArrayList<>();
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            while (interfaces.hasMoreElements()) {
                NetworkInterface ni = interfaces.nextElement();
                if (ni.isLoopback() || ni.isVirtual()) continue;
                byte[] mac = ni.getHardwareAddress();
                if (mac != null) {
                    StringBuilder sb = new StringBuilder();
                    for (byte b : mac) {
                        sb.append(String.format("%02x:", b));
                    }
                    if (sb.length() > 0) sb.deleteCharAt(sb.length() - 1);
                    macs.add(sb.toString());
                }
            }
            if (!macs.isEmpty()) {
                return macs.get(0);
            }
        } catch (Exception ignored) {}
        return null;
    }

    private static String buildCombinedString(Map<String, String> identifiers) {
        StringBuilder sb = new StringBuilder();
        if (identifiers.containsKey("cpu")) sb.append(identifiers.get("cpu"));
        if (identifiers.containsKey("motherboard")) sb.append("|").append(identifiers.get("motherboard"));
        if (identifiers.containsKey("mac")) sb.append("|").append(identifiers.get("mac"));
        sb.append("|").append(System.getProperty("os.name", "unknown"));
        sb.append("|").append(System.getProperty("os.version", "unknown"));
        return sb.toString();
    }

    private static String hashIdentifiers(String data) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(data.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            return "fallback-" + UUID.randomUUID().toString();
        }
    }
}
`,
    'CacheManager.java': `package com.websmith.sdk;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.HashMap;
import java.util.Map;

public class CacheManager {
    private final Path cacheDir;
    private final Path cacheFile;
    private final Path tmpFile;
    private final Path corruptFile;
    private final long ttlMillis;
    private final Gson gson;
    private Map<String, CacheEntry> cache;

    private static class CacheEntry {
        Object value;
        long cachedAt;

        CacheEntry() {}

        CacheEntry(Object value, long cachedAt) {
            this.value = value;
            this.cachedAt = cachedAt;
        }
    }

    public CacheManager(JsonObject config) {
        JsonObject offline = config != null && config.has("offline")
            ? config.getAsJsonObject("offline") : new JsonObject();
        int ttlDays = 0;
        if (offline.has("cache_days")) {
            try { ttlDays = offline.get("cache_days").getAsInt(); } catch (Exception ignored) {}
        }
        this.ttlMillis = ttlDays * 24L * 60L * 60L * 1000L;

        String productId = "";
        if (config != null && config.has("product") && config.getAsJsonObject("product").has("id")) {
            productId = config.getAsJsonObject("product").get("id").getAsString();
        }
        String safeName = productId.replaceAll("[^a-zA-Z0-9_-]", "_");
        if (safeName.isEmpty()) safeName = "unknown";

        String home = System.getProperty("user.home", ".");
        this.cacheDir = new File(home, ".websmith/" + safeName).toPath();
        this.cacheFile = cacheDir.resolve("cache.json");
        this.tmpFile = cacheDir.resolve("cache.tmp");
        this.corruptFile = cacheDir.resolve("cache.corrupt");
        this.gson = new Gson();
        this.cache = null;
    }

    public CacheManager() {
        this(null);
    }

    private void ensureCacheDir() {
        try {
            Files.createDirectories(cacheDir);
        } catch (IOException ignored) {}
    }

    private Map<String, CacheEntry> loadCache() {
        if (cache != null) return cache;
        ensureCacheDir();
        if (!Files.exists(cacheFile)) {
            cache = new HashMap<>();
            return cache;
        }
        try {
            String content = new String(Files.readAllBytes(cacheFile));
            @SuppressWarnings("unchecked")
            Map<String, Object> raw = gson.fromJson(content, Map.class);
            cache = new HashMap<>();
            if (raw != null) {
                for (Map.Entry<String, Object> entry : raw.entrySet()) {
                    if (entry.getValue() instanceof Map) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> m = (Map<String, Object>) entry.getValue();
                        CacheEntry ce = new CacheEntry();
                        ce.value = m.get("value");
                        if (m.get("cachedAt") instanceof Number) {
                            ce.cachedAt = ((Number) m.get("cachedAt")).longValue();
                        }
                        cache.put(entry.getKey(), ce);
                    }
                }
            }
            return cache;
        } catch (Exception e) {
            preserveCorruptCache();
            cache = new HashMap<>();
            return cache;
        }
    }

    private void preserveCorruptCache() {
        if (Files.exists(cacheFile)) {
            try {
                Files.move(cacheFile, corruptFile, StandardCopyOption.REPLACE_EXISTING);
            } catch (IOException e) {
                try { Files.delete(cacheFile); } catch (IOException ignored) {}
            }
        }
    }

    private void saveCache() {
        if (cache == null) return;
        ensureCacheDir();
        try {
            String json = gson.toJson(cache);
            Files.write(tmpFile, json.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            Files.move(tmpFile, cacheFile, StandardCopyOption.ATOMIC_MOVE);
        } catch (IOException e) {
            try { Files.deleteIfExists(tmpFile); } catch (IOException ignored) {}
        }
    }

    public Object get(String key) {
        Map<String, CacheEntry> c = loadCache();
        CacheEntry entry = c.get(key);
        if (entry == null) return null;
        if (isExpired(entry)) {
            c.remove(key);
            saveCache();
            return null;
        }
        return entry.value;
    }

    public void set(String key, Object value) {
        Map<String, CacheEntry> c = loadCache();
        c.put(key, new CacheEntry(value, System.currentTimeMillis()));
        saveCache();
    }

    public void remove(String key) {
        Map<String, CacheEntry> c = loadCache();
        if (c.containsKey(key)) {
            c.remove(key);
            saveCache();
        }
    }

    public void clear() {
        cache = new HashMap<>();
        saveCache();
    }

    public Path getCacheDir() {
        return cacheDir;
    }

    private boolean isExpired(CacheEntry entry) {
        return (System.currentTimeMillis() - entry.cachedAt) > ttlMillis;
    }
}
`,
    'LicenseEngine.java': `package com.websmith.sdk;

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

    public JsonObject replaceHardware(String licenseKey, String oldHardwareId) throws Client.ApiException {
        String key = licenseKey != null ? licenseKey : this.licenseKey;
        if (key == null || key.isEmpty()) {
            throw new IllegalArgumentException("License key is required");
        }
        String newHardwareId = HardwareFingerprint.generate();
        String oldId = oldHardwareId != null ? oldHardwareId : hardwareId;
        JsonObject result = client.replaceHardware(key, oldId, newHardwareId);
        if (result.has("license")) {
            this.licenseData = result.getAsJsonObject("license");
        }
        cache.remove("license_status");
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
`,
    'pom.xml': `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.websmith</groupId>
  <artifactId>${safeProductName}-sdk</artifactId>
  <version>${pomVersion}</version>
  <packaging>jar</packaging>
  <name>${context.productName} SDK</name>
  <description>Websmith License SDK for ${context.productName}</description>
  <url>${process.env.WEBSMITH_API_URL || process.env.NEXT_PUBLIC_API_URL || ''}</url>
  <properties>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    <maven.compiler.source>11</maven.compiler.source>
    <maven.compiler.target>11</maven.compiler.target>
  </properties>
  <dependencies>
    <dependency>
      <groupId>com.google.code.gson</groupId>
      <artifactId>gson</artifactId>
      <version>2.10.1</version>
    </dependency>
  </dependencies>
  <build>
    <plugins>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-compiler-plugin</artifactId>
        <version>3.11.0</version>
        <configuration>
          <source>11</source>
          <target>11</target>
        </configuration>
      </plugin>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-source-plugin</artifactId>
        <version>3.3.0</version>
        <executions>
          <execution>
            <id>attach-sources</id>
            <goals><goal>jar</goal></goals>
          </execution>
        </executions>
      </plugin>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-javadoc-plugin</artifactId>
        <version>3.6.0</version>
        <executions>
          <execution>
            <id>attach-javadocs</id>
            <goals><goal>jar</goal></goals>
          </execution>
        </executions>
      </plugin>
    </plugins>
  </build>
</project>
`,
    'README.md': `# ${context.productName} SDK (Java)

## Version
${context.kitVersion}

## Requirements
- Java 11+
- Apache Maven 3.6+
- Gson 2.10.1 (included via Maven)

## Installation

### Via Maven
Add the following dependency to your \`pom.xml\`:
\`\`\`xml
<dependency>
  <groupId>com.websmith</groupId>
  <artifactId>${safeProductName}-sdk</artifactId>
  <version>${context.kitVersion}</version>
</dependency>
\`\`\`

### Manual
Compile the source files with Gson on your classpath:
\`\`\`
javac -cp gson-2.10.1.jar src/com/websmith/sdk/*.java -d out
\`\`\`

## Configuration
Create \`config/api-config.json\` in your working directory:
\`\`\`json
{
  "api": {
    "public_key": "YOUR_PUBLIC_API_KEY",
    "secret": "YOUR_API_SECRET",
    "url": "${process.env.WEBSMITH_API_URL || process.env.NEXT_PUBLIC_API_URL || ''}",
    "timeout": 30000,
    "retry_count": 3
  },
  "product": {
    "id": "${context.productId}"
  }
}
\`\`\`

## Quick Start
\`\`\`java
import com.websmith.sdk.LicenseEngine;
import com.websmith.sdk.Client;
import com.google.gson.JsonObject;

public class Main {
    public static void main(String[] args) {
        LicenseEngine engine = new LicenseEngine();

        try {
            JsonObject result = engine.validate("YOUR_LICENSE_KEY");
            System.out.println("Valid: " + engine.isValid());
            System.out.println("License info: " + engine.getLicenseInfo());
        } catch (Client.ApiException e) {
            System.err.println("Error: " + e.getMessage());
        }
    }
}
\`\`\`

## Lifecycle

### 1. Initialize
\`\`\`java
LicenseEngine engine = new LicenseEngine();
\`\`\`

### 2. Start Trial
\`\`\`java
JsonObject result = engine.startTrial("user@example.com", "John Doe");
String licenseKey = result.get("license_key").getAsString();
\`\`\`

### 3. Check Trial Status
\`\`\`java
JsonObject trial = engine.checkTrial();
String status = trial.get("status").getAsString();
\`\`\`

### 4. Convert Trial to License
\`\`\`java
JsonObject result = engine.convertTrial("premium", "John Doe", "user@example.com");
\`\`\`

### 5. Validate License
\`\`\`java
engine.validate("LICENSE_KEY");
boolean valid = engine.isValid();
\`\`\`

### 6. Activate License
\`\`\`java
engine.activate("LICENSE_KEY", "My Workstation");
\`\`\`

### 7. Renew License
\`\`\`java
engine.renew("LICENSE_KEY", 365);
\`\`\`

### 8. Replace Hardware
\`\`\`java
JsonObject result = engine.replaceHardware("LICENSE_KEY", "old-hardware-id");
\`\`\`

### 9. Bind Device
\`\`\`java
JsonObject result = engine.bindDevice("LICENSE_KEY", "My Laptop");
\`\`\`

### 10. Deactivate License
\`\`\`java
engine.deactivate("LICENSE_KEY");
\`\`\`

## API Endpoints
- \`POST /api/v1/license\` - License management (validate, activate, deactivate, renew)
- \`POST /api/v1/trial\` - Trial management (start, status, convert)
- \`POST /api/v1/device\` - Device management (bind, replace)
- \`POST /api/v1/countries\` - Get country codes
- \`POST /api/v1/status\` - API status check

## HMAC Signing
All API requests are signed using HMAC-SHA256 with the following headers:
- \`X-API-Key\` - Public API key
- \`X-Timestamp\` - ISO 8601 UTC timestamp
- \`X-Nonce\` - UUID v4 nonce
- \`X-Signature\` - Base64-encoded HMAC-SHA256 signature

The canonical string format is:
\`\`\`
METHOD\\nPATH\\nQUERY\\nBODY_HASH\\nTIMESTAMP\\nNONCE
\`\`\`

## License
Generated by Websmith License API Center
Copyright (c) ${new Date().getFullYear()}
`
  };
}
