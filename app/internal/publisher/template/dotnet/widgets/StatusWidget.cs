using System;

namespace WebsmithSDK.Widgets;

public static class StatusWidget
{
    public static void Render()
    {
        Console.WriteLine("\n--- License Status ---\n");
        try
        {
            var engine = new LicenseEngine();
            var status = engine.Initialize();
            Console.WriteLine($"Status: {status.Status.ToUpper()}");
            Console.WriteLine($"Valid: {(status.Valid ? "YES" : "NO")}");
            var line = "----------------------------------------";
            Console.WriteLine(line);
            Console.WriteLine($"Expires At: {status.ExpiresAt ?? "N/A"}");
            Console.WriteLine($"Days Remaining: {status.DaysRemaining}");
            Console.WriteLine($"Plan: {status.Plan ?? "N/A"}");
            Console.WriteLine($"Hardware ID: {status.HardwareId ?? "N/A"}");
            Console.WriteLine($"License Key: {status.LicenseKey ?? "N/A"}");
            Console.WriteLine(line);
            Console.WriteLine($"Message: {status.Message ?? "N/A"}");
            Console.WriteLine($"Trial Active: {(status.TrialActive ? "Yes" : "No")}");
            Console.WriteLine(line);
            if (status.Valid)
            {
                Console.WriteLine("License is ACTIVE");
                if (status.DaysRemaining > 0 && status.DaysRemaining <= 7)
                    Console.WriteLine($"WARNING: License expires in {status.DaysRemaining} day(s)!");
            }
            else if (status.Status == "trial")
            {
                Console.WriteLine($"Trial is active with {status.DaysRemaining} day(s) remaining.");
            }
            else if (status.Status == "expired")
            {
                Console.WriteLine("License has expired. Please renew.");
            }
            else if (status.Status == "unlicensed")
            {
                Console.WriteLine("No license found. Please activate or start a trial.");
            }
            else
            {
                Console.WriteLine($"Status: {status.Status}");
                if (status.Message != null)
                    Console.WriteLine(status.Message);
            }
        }
        catch (Exception e)
        {
            Console.WriteLine($"Status check failed: {e.Message}");
        }
    }
}
