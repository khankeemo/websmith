using System;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;

namespace WebsmithSDK.Widgets;

public static class ActivationButtonWidget
{
    public static void Render()
    {
        Console.WriteLine("\n--- Activation Widget ---\n");
        var config = LoadConfig();
        if (config == null)
        {
            Console.WriteLine("Error: api-config.json not found.");
            return;
        }
        var cache = new CacheManager(config);
        var hardware = new HardwareDetector();
        string hardwareId;
        try
        {
            hardwareId = hardware.GetFingerprint();
            Console.WriteLine($"Hardware ID: {hardwareId}\n");
        }
        catch (Exception e)
        {
            Console.WriteLine($"Hardware detection failed: {e.Message}");
            return;
        }
        Console.Write("Enter License Key: ");
        var licenseKey = Console.ReadLine()?.Trim();
        if (string.IsNullOrEmpty(licenseKey))
        {
            Console.WriteLine("License key is required.");
            return;
        }
        try
        {
            var client = new ApiClient(config, hardware, cache);
            Console.WriteLine("Activating license...");
            var result = client.ActivateLicense(licenseKey, hardwareId).Result;
            if ((result.RootElement.TryGetProperty("success", out var s) && s.GetBoolean())
                || (result.RootElement.TryGetProperty("data", out var d)
                    && d.TryGetProperty("success", out var s2) && s2.GetBoolean()))
            {
                Console.WriteLine("License activated successfully!");
                cache.InvalidateLicenseStatus();
            }
            else
            {
                var err = result.RootElement.TryGetProperty("message", out var m)
                    ? m.GetString()
                    : result.RootElement.TryGetProperty("error", out var e)
                        ? e.GetString() : "Activation failed";
                Console.WriteLine($"Failed: {err}");
            }
        }
        catch (Exception e)
        {
            Console.WriteLine($"Error: {e.Message}");
        }
    }

    private static JsonDocument? LoadConfig()
    {
        var paths = new[] { "config/api-config.json", "config/api-config.json" };
        foreach (var path in paths)
        {
            if (File.Exists(path))
            {
                try
                {
                    var text = File.ReadAllText(path);
                    return JsonDocument.Parse(text);
                }
                catch { }
            }
        }
        return null;
    }
}
