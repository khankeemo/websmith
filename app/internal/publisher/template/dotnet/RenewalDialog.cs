using System;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;

namespace WebsmithSDK;

public class RenewalDialog
{
    private readonly ApiClient _client;
    private readonly CacheManager _cache;
    private readonly string _supportEmail;

    public class RenewalDialogResult
    {
        public bool Renewed { get; set; }
        public bool Cancelled { get; set; }
        public string? LicenseKey { get; set; }
        public string? Expiry { get; set; }
        public string? Error { get; set; }
    }

    public RenewalDialog(ApiClient? client)
    {
        _client = client ?? new ApiClient();
        _cache = _client.GetCache();
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

    public RenewalDialogResult Show(string? licenseKey)
    {
        if (string.IsNullOrEmpty(licenseKey))
        {
            Console.WriteLine("\n=== License Renewal ===\n");
            Console.Write("Enter License Key to renew: ");
            licenseKey = Console.ReadLine()?.Trim();
            if (string.IsNullOrEmpty(licenseKey))
            {
                Console.WriteLine("License key is required.");
                return new RenewalDialogResult { Cancelled = true, Error = "No license key entered" };
            }
        }

        Console.Write("\nHow many days to renew? (leave empty for default): ");
        var input = Console.ReadLine()?.Trim() ?? "";
        int? extraDays = null;
        if (!string.IsNullOrEmpty(input) && int.TryParse(input, out var days))
        {
            extraDays = days;
        }

        Console.WriteLine($"\nProcessing renewal for license key: {licenseKey}");
        if (extraDays.HasValue)
            Console.WriteLine($"Extra days: {extraDays.Value}");

        try
        {
            var result = _client.RenewLicense(licenseKey, extraDays).Result;
            if (result.RootElement.TryGetProperty("success", out var s) && s.GetBoolean())
            {
                JsonElement data;
                if (result.RootElement.TryGetProperty("data", out var d))
                    data = d;
                else
                    data = result.RootElement;

                var expiry = data.TryGetProperty("expiry_date", out var ed)
                    ? ed.GetString()
                    : data.TryGetProperty("expires_at", out var ea) ? ea.GetString() : "N/A";

                Console.WriteLine($"\nLicense renewed successfully!");
                Console.WriteLine($"New expiry: {expiry}");
                _cache.InvalidateLicenseStatus();
                return new RenewalDialogResult { Renewed = true, LicenseKey = licenseKey, Expiry = expiry };
            }
            else
            {
                var errMsg = result.RootElement.TryGetProperty("message", out var msg)
                    ? msg.GetString()
                    : result.RootElement.TryGetProperty("error", out var e)
                        ? e.GetString() : "Renewal failed";
                Console.WriteLine($"\nRenewal failed: {errMsg}");
                return new RenewalDialogResult { Error = errMsg };
            }
        }
        catch (Exception e)
        {
            Console.WriteLine($"\nError: {e.Message}");
            return new RenewalDialogResult { Cancelled = true, Error = e.Message };
        }
    }
}
