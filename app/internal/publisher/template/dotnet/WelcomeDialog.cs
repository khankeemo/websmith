using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;

namespace WebsmithSDK;

public class WelcomeDialog
{
    private readonly ApiClient _client;
    private readonly HardwareDetector _hardware;
    private readonly CacheManager _cache;
    private readonly string _productName;
    private readonly bool _trialEnabled;
    private readonly string _supportEmail;

    public class WelcomeDialogResult
    {
        public bool Skipped { get; set; }
        public string? Message { get; set; }
        public string? Name { get; set; }
        public string? Email { get; set; }
        public string? HardwareId { get; set; }
        public bool OnboardingComplete { get; set; }
    }

    public WelcomeDialog(ApiClient client, string? productName = null, bool? trialEnabled = null)
    {
        _client = client;
        _hardware = new HardwareDetector();
        _cache = client?.GetCache() ?? new CacheManager();
        _productName = productName ?? "";
        bool trialEnabledVal = trialEnabled ?? LoadTrialEnabled();
        _trialEnabled = trialEnabledVal;
        _supportEmail = LoadSupportEmail();
    }

    public WelcomeDialog(ApiClient client) : this(client, null, null) { }

    private static bool LoadTrialEnabled()
    {
        try
        {
            var path = "config/api-config.json";
            if (File.Exists(path))
            {
                var doc = JsonDocument.Parse(File.ReadAllText(path));
                if (doc.RootElement.TryGetProperty("trial", out var trial)
                    && trial.TryGetProperty("enabled", out var enabled))
                {
                    return enabled.GetBoolean();
                }
            }
        }
        catch { }
        return false;
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

    public bool IsOnboardingComplete() => _cache.IsOnboardingComplete();

    public WelcomeDialogResult Show()
    {
        var result = new WelcomeDialogResult();

        if (!_trialEnabled)
        {
            Console.WriteLine("Trial onboarding is not enabled for this product.");
            result.Skipped = true;
            result.Message = "Trial not enabled";
            return result;
        }

        if (IsOnboardingComplete())
        {
            Console.WriteLine("Onboarding has already been completed.");
            result.Skipped = true;
            result.Message = "Already completed";
            return result;
        }

        Console.WriteLine($"\n=== Welcome to {(string.IsNullOrEmpty(_productName) ? "Software" : _productName)} ===\n");
        Console.WriteLine("Complete your registration to start the trial.\n");

        Console.Write("Name *: ");
        var name = Console.ReadLine()?.Trim() ?? "";
        while (string.IsNullOrEmpty(name))
        {
            Console.Write("Name is required. Please enter your name: ");
            name = Console.ReadLine()?.Trim() ?? "";
        }

        Console.Write("Email *: ");
        var email = Console.ReadLine()?.Trim() ?? "";
        while (string.IsNullOrEmpty(email) || !email.Contains('@'))
        {
            Console.Write("Valid email is required. Please enter your email: ");
            email = Console.ReadLine()?.Trim() ?? "";
        }

        Console.Write("Company (optional): ");
        var company = Console.ReadLine()?.Trim() ?? "";

        Console.WriteLine($"\nStarting trial for: {name} <{email}>...\n");

        try
        {
            var hardwareId = _hardware.GetFingerprint();
            var customerData = new Dictionary<string, object>
            {
                ["company_name"] = company,
                ["hardware_id"] = hardwareId
            };

            var trialResult = _client.StartTrial(email, name, hardwareId, customerData).Result;

            if (trialResult.RootElement.TryGetProperty("success", out var s) && s.GetBoolean())
            {
                _cache.SetOnboardingComplete();
                Console.WriteLine("\nTrial activated successfully! You can now use the software.\n");
                result.Name = name;
                result.Email = email;
                result.HardwareId = hardwareId;
                result.OnboardingComplete = true;
                return result;
            }

            var errorMsg = trialResult.RootElement.TryGetProperty("error", out var err)
                ? err.GetString()
                : trialResult.RootElement.TryGetProperty("message", out var msg)
                    ? msg.GetString() : "Unknown error";
            Console.WriteLine($"\nFailed to start trial: {errorMsg}");
            result.Skipped = true;
            result.Message = errorMsg;
            return result;
        }
        catch (Exception e)
        {
            Console.WriteLine($"\nError: {e.Message}");
            result.Skipped = true;
            result.Message = e.Message;
            return result;
        }
    }
}
