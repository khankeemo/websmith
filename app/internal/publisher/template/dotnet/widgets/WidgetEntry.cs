using System;

namespace WebsmithSDK.Widgets;

public static class WidgetEntry
{
    public static void Render()
    {
        Console.WriteLine("\n=== ${product_name} SDK Widgets ===\n");
        Console.WriteLine("Available widgets:");
        Console.WriteLine("  1. Status Widget - Check license status");
        Console.WriteLine("  2. Activation Button - Activate a license");
        Console.WriteLine("  3. Dashboard Widget - View license overview");
        Console.WriteLine("  4. Settings Widget - Configure SDK settings");
        Console.Write("\nSelect widget (1-4): ");
        var choice = Console.ReadLine()?.Trim();
        switch (choice)
        {
            case "1":
                StatusWidget.Render();
                break;
            case "2":
                ActivationButtonWidget.Render();
                break;
            case "3":
                DashboardWidget.Render();
                break;
            case "4":
                SettingsWidget.Render();
                break;
            default:
                Console.WriteLine("Invalid choice.");
                break;
        }
    }
}
