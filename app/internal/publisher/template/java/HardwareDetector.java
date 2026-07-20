package com.websmith.sdk;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public class HardwareDetector {

    private String fingerprint;
    private Map<String, String> identifiers;

    public String getFingerprint() {
        if (fingerprint == null) {
            Map<String, String> ids = collectIdentifiers();
            String combined = buildCombinedString(ids);
            fingerprint = hashIdentifiers(combined);
            identifiers = ids;
        }
        return fingerprint;
    }

    public Map<String, String> getIdentifiers() {
        if (identifiers == null) {
            getFingerprint();
        }
        return identifiers != null ? identifiers : new HashMap<>();
    }

    private Map<String, String> collectIdentifiers() {
        Map<String, String> ids = new HashMap<>();
        String cpuId = getCpuId();
        if (cpuId != null) {
            ids.put("cpu_id", cpuId);
        }
        String motherboardId = getMotherboardId();
        if (motherboardId != null) {
            ids.put("motherboard_id", motherboardId);
        }
        if (!ids.containsKey("motherboard_id")) {
            String networkId = getNetworkId();
            if (networkId != null) {
                ids.put("network_id", networkId);
            }
        }
        String osInfo = getOsInfo();
        if (osInfo != null) {
            ids.put("os_info", osInfo);
        }
        return ids;
    }

    private String getCpuId() {
        String os = System.getProperty("os.name", "").toLowerCase();
        try {
            if (os.contains("win")) {
                return getCpuIdWindows();
            } else if (os.contains("mac")) {
                return getCpuIdDarwin();
            } else if (os.contains("nix") || os.contains("nux")) {
                return getCpuIdLinux();
            }
        } catch (Exception ignored) {}
        return System.getProperty("os.arch");
    }

    private String getCpuIdWindows() {
        try {
            Process process = Runtime.getRuntime().exec(
                new String[]{"wmic", "cpu", "get", "ProcessorId", "/value"});
            BufferedReader reader = new BufferedReader(
                new InputStreamReader(process.getInputStream()));
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.startsWith("ProcessorId=")) {
                    String id = line.substring("ProcessorId=".length()).trim();
                    if (!id.isEmpty()) return id;
                }
            }
        } catch (Exception ignored) {}
        return System.getProperty("os.arch");
    }

    private String getCpuIdDarwin() {
        try {
            Process process = Runtime.getRuntime().exec(
                new String[]{"sysctl", "-n", "hw.model"});
            BufferedReader reader = new BufferedReader(
                new InputStreamReader(process.getInputStream()));
            String model = reader.readLine();
            if (model != null && !model.trim().isEmpty()) {
                return "mac-" + model.trim();
            }
        } catch (Exception ignored) {}
        try {
            Process process = Runtime.getRuntime().exec(
                new String[]{"sysctl", "-n", "machdep.cpu.brand_string"});
            BufferedReader reader = new BufferedReader(
                new InputStreamReader(process.getInputStream()));
            String brand = reader.readLine();
            if (brand != null && !brand.trim().isEmpty()) {
                MessageDigest md = MessageDigest.getInstance("SHA-256");
                byte[] hash = md.digest(brand.trim().getBytes(StandardCharsets.UTF_8));
                return bytesToHex(hash).substring(0, 16);
            }
        } catch (Exception ignored) {}
        return System.getProperty("os.arch");
    }

    private String getCpuIdLinux() {
        try {
            Process process = Runtime.getRuntime().exec(
                new String[]{"cat", "/proc/cpuinfo"});
            BufferedReader reader = new BufferedReader(
                new InputStreamReader(process.getInputStream()));
            String line;
            String serial = null;
            String vendor = "";
            String family = "";
            while ((line = reader.readLine()) != null) {
                if (line.toLowerCase().startsWith("serial")) {
                    String[] parts = line.split(":");
                    if (parts.length > 1) {
                        serial = parts[1].trim();
                    }
                } else if (line.startsWith("vendor_id")) {
                    String[] parts = line.split(":");
                    if (parts.length > 1) vendor = parts[1].trim();
                } else if (line.startsWith("cpu family")) {
                    String[] parts = line.split(":");
                    if (parts.length > 1) family = parts[1].trim();
                }
            }
            if (serial != null && !serial.isEmpty()) {
                return "cpu-" + serial;
            }
            if (!vendor.isEmpty() && !family.isEmpty()) {
                return vendor + "-" + family;
            }
        } catch (Exception ignored) {}
        return System.getProperty("os.arch");
    }

    private String getMotherboardId() {
        String os = System.getProperty("os.name", "").toLowerCase();
        try {
            if (os.contains("win")) {
                Process process = Runtime.getRuntime().exec(
                    new String[]{"wmic", "baseboard", "get", "SerialNumber", "/value"});
                BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream()));
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
            } else if (os.contains("nix") || os.contains("nux")) {
                Process process = Runtime.getRuntime().exec(
                    new String[]{"dmidecode", "-s", "baseboard-serial-number"});
                BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream()));
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

    private String getNetworkId() {
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
                MessageDigest md = MessageDigest.getInstance("SHA-256");
                String combined = "net-" + String.join(":", macs.subList(0, Math.min(3, macs.size())));
                byte[] hash = md.digest(combined.getBytes(StandardCharsets.UTF_8));
                return bytesToHex(hash).substring(0, 16);
            }
        } catch (Exception ignored) {}
        return null;
    }

    private String getOsInfo() {
        return System.getProperty("os.name", "") + "-" + System.getProperty("os.version", "");
    }

    private String buildCombinedString(Map<String, String> identifiers) {
        StringBuilder sb = new StringBuilder();
        String[] keys = {"cpu_id", "motherboard_id", "network_id"};
        for (int i = 0; i < keys.length; i++) {
            if (identifiers.containsKey(keys[i])) {
                if (sb.length() > 0) sb.append("|");
                sb.append(identifiers.get(keys[i]));
            }
        }
        return sb.toString();
    }

    private String hashIdentifiers(String data) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(data.getBytes(StandardCharsets.UTF_8));
            return bytesToHex(hash);
        } catch (Exception e) {
            return "fallback-" + UUID.randomUUID().toString();
        }
    }

    private String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}
