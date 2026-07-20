using System;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;

namespace WebsmithSDK;

public class ActivationDialog
{
    private readonly ApiClient _client;
    private readonly CacheManager _cache;
    private readonly HardwareDetector _hardware;
    private readonly string _productName;
    private readonly string _supportEmail;

    public class ActivationDialogResult
    {
        public bool Activated { get; set; }
        public bool Cancelled { get; set; }
        public string? LicenseKey { get; set; }
        public string? HardwareId { get; set; }
        public string? Error { get; set; }
    }

    public ActivationDialog(ApiClient? client, string? productName = null)
    {
        _client = client ?? new ApiClient();
        _cache = _client.GetCache();
        _hardware = new HardwareDetector();
        _productName = productName ?? "";
        _supportEmail = LoadSupportEmail();
    }

    private static string LoadSupportEmail()
    {
        try
        {
            var path = "config/api-config.json";
            if (File.Exists(path))
            {
                var doc = JsonDocument.Parse(File.ReadAllText(path));
                if (doc.RootElement.TryGetProperty("branding", out var branding)
                    && branding.TryGetProperty("support_email", out var email))
                {
                    return email.GetString() ?? "support@websmithdigital.com";
                }
            }
        }
        catch { }
        return "support@websmithdigital.com";
    }

    public ActivationDialogResult Show()
    {
        Console.WriteLine($"\n=== {(string.IsNullOrEmpty(_productName) ? "License" : _productName)} Activation ===\n");

        Console.WriteLine("Detecting hardware...");
        string hardwareId;
        try
        {
            hardwareId = _hardware.GetFingerprint();
            Console.WriteLine($"Hardware ID: {hardwareId}\n");
        }
        catch (Exception e)
        {
            Console.WriteLine($"Unable to detect hardware: {e.Message}");
            Console.WriteLine($"Please contact support: {_supportEmail}");
            return new ActivationDialogResult { Activated = false, Cancelled = true, Error = "Hardware detection failed" };
        }

        Console.Write("Enter License Key: ");
        var licenseKey = Console.ReadLine()?.Trim() ?? "";
        if (string.IsNullOrEmpty(licenseKey))
        {
            Console.WriteLine("License key is required.");
            return new ActivationDialogResult { Activated = false, Cancelled = true, Error = "No license key entered" };
        }

        Console.WriteLine("\nValidating license...");
        try
        {
            var result = _client.ValidateLicense(licenseKey, hardwareId).Result;
            JsonElement data;
            if (result.RootElement.TryGetProperty("data", out var d))
                data = d;
            else
                data = result.RootElement;

            bool valid = (data.TryGetProperty("valid", out var v) && v.GetBoolean())
                || (result.RootElement.TryGetProperty("valid", out var rv) && rv.GetBoolean());

            if (!valid)
            {
                var errMsg = result.RootElement.TryGetProperty("message", out var msg)
                    ? msg.GetString()
                    : result.RootElement.TryGetProperty("error", out var e)
                        ? e.GetString() : "License validation failed";
                Console.WriteLine($"Validation failed: {errMsg}");
                return new ActivationDialogResult { Activated = false, Cancelled = true, Error = errMsg };
            }

            int maxDev = data.TryGetProperty("max_devices", out var md) ? md.GetInt32() : 0;
            int devCount = data.TryGetProperty("device_count", out var dc)
                ? dc.GetInt32()
                : data.TryGetProperty("active_devices", out var ad) ? ad.GetInt32() : 0;

            if (maxDev > 0 && devCount >= maxDev)
            {
                Console.WriteLine($"Device limit reached ({devCount}/{maxDev}). Deactivate another device first.");
                Console.WriteLine($"Contact support: {_supportEmail}");
                return new ActivationDialogResult { Activated = false, Cancelled = true, Error = "Device limit reached" };
            }

            Console.WriteLine("\nLicense validated successfully!");
            if (data.TryGetProperty("expiry_date", out var expiry) && expiry.ValueKind == JsonValueKind.String)
                Console.WriteLine($"Expires: {expiry.GetString()}");
            if (data.TryGetProperty("plan", out var plan) && plan.ValueKind == JsonValueKind.String)
                Console.WriteLine($"Plan: {plan.GetString()}");

            Console.Write("\nActivate this license on this device? (y/n): ");
            var confirm = Console.ReadLine()?.Trim().ToLower() ?? "";
            if (confirm != "y" && confirm != "yes")
            {
                Console.WriteLine("Activation cancelled.");
                return new ActivationDialogResult { Activated = false, Cancelled = true };
            }

            Console.WriteLine("\nActivating license...");
            var activateResult = _client.ActivateLicense(licenseKey, hardwareId).Result;
            if ((activateResult.RootElement.TryGetProperty("success", out var s) && s.GetBoolean())
                || (activateResult.RootElement.TryGetProperty("data", out var ad2)
                    && ad2.TryGetProperty("success", out var s2) && s2.GetBoolean()))
            {
                Console.WriteLine("License activated successfully!");
                _cache.InvalidateLicenseStatus();
                return new ActivationDialogResult
                {
                    Activated = true,
                    LicenseKey = licenseKey,
                    HardwareId = hardwareId
                };
            }
            else
            {
                var errMsg = activateResult.RootElement.TryGetProperty("message", out var msg)
                    ? msg.GetString()
                    : activateResult.RootElement.TryGetProperty("error", out var er)
                        ? er.GetString() : "Activation failed";
                Console.WriteLine($"Activation failed: {errMsg}");
                return new ActivationDialogResult { Activated = false, Error = errMsg };
            }
        }
        catch (Exception e)
        {
            Console.WriteLine($"Error: {e.Message}");
            return new ActivationDialogResult { Activated = false, Cancelled = true, Error = e.Message };
        }
    }
}
