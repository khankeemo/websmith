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
        public string? Action { get; set; }
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
        Console.WriteLine("Device reactivation requires Websmith Support approval.\n");
        Console.WriteLine($"Please contact support at: {_supportEmail}");
        Console.WriteLine("The application will remain locked until reactivation is approved.\n");
        return new DeviceReplaceDialogResult { Action = "contact_support", Cancelled = true };
    }
}
