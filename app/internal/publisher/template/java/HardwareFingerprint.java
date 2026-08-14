package com.websmith.sdk;

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
