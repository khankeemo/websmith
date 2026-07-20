using System;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;

namespace WebsmithSDK;

public class DeviceReplaceDialog
{
    private readonly ApiClient _client;
    private readonly CacheManager _cache;
    private readonly HardwareDetector _hardware;
    private readonly string _supportEmail;

    public class DeviceReplaceDialogResult
    {
        public bool Replaced { get; set; }
        public bool Cancelled { get; set; }
        public string? LicenseKey { get; set; }
        public string? OldHardwareId { get; set; }
        public string? NewHardwareId { get; set; }
        public string? Error { get; set; }
    }

    public DeviceReplaceDialog(ApiClient? client)
    {
        _client = client ?? new ApiClient();
        _cache = _client.GetCache();
        _hardware = new HardwareDetector();
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

    public DeviceReplaceDialogResult Show(string? licenseKey)
    {
        Console.WriteLine("\n=== Device Replacement ===\n");

        if (string.IsNullOrEmpty(licenseKey))
        {
            Console.Write("Enter License Key: ");
            licenseKey = Console.ReadLine()?.Trim();
            if (string.IsNullOrEmpty(licenseKey))
            {
                Console.WriteLine("License key is required.");
                return new DeviceReplaceDialogResult { Cancelled = true, Error = "No license key entered" };
            }
        }

        Console.Write("Enter OLD Hardware ID: ");
        var oldHardwareId = Console.ReadLine()?.Trim() ?? "";
        if (string.IsNullOrEmpty(oldHardwareId))
        {
            Console.WriteLine("Old hardware ID is required.");
            return new DeviceReplaceDialogResult { Cancelled = true, Error = "No old hardware ID entered" };
        }

        Console.WriteLine("\nDetecting new hardware...");
        string newHardwareId;
        try
        {
            newHardwareId = _hardware.GetFingerprint();
            Console.WriteLine($"New Hardware ID: {newHardwareId}\n");
        }
        catch (Exception e)
        {
            Console.WriteLine($"Unable to detect new hardware: {e.Message}");
            Console.WriteLine($"Please contact support: {_supportEmail}");
            return new DeviceReplaceDialogResult { Cancelled = true, Error = "Hardware detection failed" };
        }

        if (oldHardwareId == newHardwareId)
        {
            Console.WriteLine("Old and new hardware IDs are identical. No replacement needed.");
            return new DeviceReplaceDialogResult { Cancelled = true, Error = "Identical hardware IDs" };
        }

        Console.WriteLine("Replace device from:");
        Console.WriteLine($"  Old: {oldHardwareId}");
        Console.WriteLine($"  New: {newHardwareId}");
        Console.Write("Proceed? (y/n): ");
        var confirm = Console.ReadLine()?.Trim().ToLower() ?? "";
        if (confirm != "y" && confirm != "yes")
        {
            Console.WriteLine("Device replacement cancelled.");
            return new DeviceReplaceDialogResult { Cancelled = true };
        }

        Console.WriteLine("\nReplacing device...");
        try
        {
            var result = _client.ReplaceDevice(licenseKey, oldHardwareId, newHardwareId).Result;
            if (result.RootElement.TryGetProperty("success", out var s) && s.GetBoolean())
            {
                Console.WriteLine("Device replaced successfully!");
                _cache.InvalidateLicenseStatus();
                return new DeviceReplaceDialogResult
                {
                    Replaced = true,
                    LicenseKey = licenseKey,
                    OldHardwareId = oldHardwareId,
                    NewHardwareId = newHardwareId
                };
            }
            else
            {
                var errMsg = result.RootElement.TryGetProperty("message", out var msg)
                    ? msg.GetString()
                    : result.RootElement.TryGetProperty("error", out var e)
                        ? e.GetString() : "Replacement failed";
                Console.WriteLine($"Replacement failed: {errMsg}");
                return new DeviceReplaceDialogResult { Error = errMsg };
            }
        }
        catch (Exception e)
        {
            Console.WriteLine($"Error: {e.Message}");
            return new DeviceReplaceDialogResult { Cancelled = true, Error = e.Message };
        }
    }
}
