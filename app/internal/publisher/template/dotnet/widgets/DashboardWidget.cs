using System;

namespace WebsmithSDK.Widgets;

public static class DashboardWidget
{
    public static void Render()
    {
        Console.WriteLine("\n=== License Dashboard ===\n");
        try
        {
            var engine = new LicenseEngine();
            var status = engine.Initialize();
            var validStates = new HashSet<string> { "active", "trial", "trial_active" };
            Console.WriteLine($"License Status: {status.Status}");
            Console.WriteLine($"Valid: {(status.Valid && validStates.Contains(status.Status) ? "Yes" : "No")}");
            if (status.ExpiresAt != null)
                Console.WriteLine($"Expires: {status.ExpiresAt}");
            Console.WriteLine($"Days Remaining: {status.DaysRemaining}");
            if (status.Plan != null)
                Console.WriteLine($"Plan: {status.Plan}");
            if (status.HardwareId != null)
                Console.WriteLine($"Hardware ID: {status.HardwareId}");
            if (status.LicenseKey != null)
                Console.WriteLine($"License Key: {status.LicenseKey}");
            if (status.Message != null)
                Console.WriteLine($"Message: {status.Message}");
            Console.WriteLine($"Trial Active: {(status.TrialActive ? "Yes" : "No")}");
            Console.WriteLine("\n---");
            Console.WriteLine($"License Key Available: {(engine.HasLicenseKey() ? "Yes" : "No")}");
            Console.WriteLine($"Hardware ID: {engine.GetHardwareId()}");
        }
        catch (Exception e)
        {
            Console.WriteLine($"Dashboard error: {e.Message}");
        }
    }
}
