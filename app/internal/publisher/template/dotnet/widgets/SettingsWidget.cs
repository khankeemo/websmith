using System;
using System.IO;
using System.Text.Json;

namespace WebsmithSDK.Widgets;

public static class SettingsWidget
{
    public static void Render()
    {
        Console.WriteLine("\n--- SDK Settings ---\n");
        var config = LoadConfig();
        if (config == null)
        {
            Console.WriteLine("No configuration loaded.");
            return;
        }
        var root = config.RootElement;
        Console.WriteLine("API Settings:");
        if (root.TryGetProperty("api", out var api))
        {
            Console.WriteLine($"  URL: {GetString(api, "url", "Not set")}");
            Console.WriteLine($"  Version: {GetString(api, "version", "v1")}");
            Console.WriteLine($"  Timeout: {GetInt(api, "timeout", 30000)}ms");
            Console.WriteLine($"  Retry Count: {GetInt(api, "retry_count", 3)}");
            var pubKey = GetString(api, "public_key", "Not set");
            Console.WriteLine($"  Public Key: {(pubKey.Length > 8 ? pubKey[..8] + "..." : pubKey)}");
        }
        if (root.TryGetProperty("product", out var product))
        {
            Console.WriteLine("\nProduct Settings:");
            Console.WriteLine($"  ID: {GetString(product, "id", "Not set")}");
            Console.WriteLine($"  Name: {GetString(product, "name", "Not set")}");
        }
        if (root.TryGetProperty("trial", out var trial))
        {
            Console.WriteLine("\nTrial Settings:");
            Console.WriteLine($"  Enabled: {(GetBool(trial, "enabled") ? "Yes" : "No")}");
            Console.WriteLine($"  Days: {GetInt(trial, "days", 0)}");
        }
        if (root.TryGetProperty("offline", out var offline))
        {
            Console.WriteLine("\nOffline Settings:");
            Console.WriteLine($"  Cache Days: {GetInt(offline, "cache_days", 0)}");
        }
        if (root.TryGetProperty("branding", out var branding))
        {
            Console.WriteLine("\nBranding:");
            Console.WriteLine($"  Company: {GetString(branding, "company_name", "Not set")}");
            Console.WriteLine($"  Support Email: {GetString(branding, "support_email", "support@websmithdigital.com")}");
        }
    }

    private static string GetString(JsonElement obj, string key, string def)
    {
        return obj.TryGetProperty(key, out var p) && p.ValueKind == JsonValueKind.String
            ? p.GetString() ?? def : def;
    }

    private static int GetInt(JsonElement obj, string key, int def)
    {
        return obj.TryGetProperty(key, out var p) ? p.GetInt32() : def;
    }

    private static bool GetBool(JsonElement obj, string key)
    {
        return obj.TryGetProperty(key, out var p) && p.GetBoolean();
    }

    private static JsonDocument? LoadConfig()
    {
        var paths = new[] { "config/api-config.json", "config/api-config.json" };
        foreach (var path in paths)
        {
            if (File.Exists(path))
            {
                try { return JsonDocument.Parse(File.ReadAllText(path)); }
                catch { }
            }
        }
        return null;
    }
}
