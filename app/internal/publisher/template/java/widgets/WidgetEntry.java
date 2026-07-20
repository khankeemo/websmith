package com.websmith.sdk.widgets;

import java.util.Scanner;

public class WidgetEntry {
    public static void render() {
        System.out.println("\n=== ${product_name} SDK Widgets ===\n");
        System.out.println("Available widgets:");
        System.out.println("  1. Status Widget - Check license status");
        System.out.println("  2. Activation Button - Activate a license");
        System.out.println("  3. Dashboard Widget - View license overview");
        System.out.println("  4. Settings Widget - Configure SDK settings");
        System.out.print("\nSelect widget (1-4): ");
        Scanner scanner = new Scanner(System.in);
        String choice = scanner.nextLine().trim();
        switch (choice) {
            case "1":
                StatusWidget.render();
                break;
            case "2":
                ActivationButtonWidget.render();
                break;
            case "3":
                DashboardWidget.render();
                break;
            case "4":
                SettingsWidget.render();
                break;
            default:
                System.out.println("Invalid choice.");
                break;
        }
    }
}
