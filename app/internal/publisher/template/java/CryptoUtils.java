package com.websmith.sdk;

import com.google.gson.JsonObject;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

public class CryptoUtils {

    public static String generateTimestamp() {
        return Instant.now().toString();
    }

    public static String generateNonce() {
        return UUID.randomUUID().toString();
    }

    public static String signRequest(
            JsonObject payload,
            String secret,
            String timestamp,
            String nonce,
            String method,
            String path,
            String query
    ) throws Exception {
        String payloadJson = payload.toString();
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        byte[] bodyHash = md.digest(payloadJson.getBytes(StandardCharsets.UTF_8));
        String bodyHashHex = bytesToHex(bodyHash);
        String message = method + "\n" + path + "\n" + query + "\n" + bodyHashHex + "\n" + timestamp + "\n" + nonce;
        Mac mac = Mac.getInstance("HmacSHA256");
        SecretKeySpec keySpec = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        mac.init(keySpec);
        byte[] signature = mac.doFinal(message.getBytes(StandardCharsets.UTF_8));
        return Base64.getEncoder().encodeToString(signature);
    }

    public static String signMessage(String message, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        SecretKeySpec keySpec = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        mac.init(keySpec);
        byte[] signature = mac.doFinal(message.getBytes(StandardCharsets.UTF_8));
        return Base64.getEncoder().encodeToString(signature);
    }

    public static boolean verifySignature(
            String signature,
            JsonObject payload,
            String secret,
            String timestamp,
            String nonce,
            String method,
            String path,
            String query
    ) throws Exception {
        String expected = signRequest(payload, secret, timestamp, nonce, method, path, query);
        return MessageDigest.isEqual(
            expected.getBytes(StandardCharsets.UTF_8),
            signature.getBytes(StandardCharsets.UTF_8)
        );
    }

    public static String sha256Hex(String data) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        byte[] hash = md.digest(data.getBytes(StandardCharsets.UTF_8));
        return bytesToHex(hash);
    }

    public static String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}
