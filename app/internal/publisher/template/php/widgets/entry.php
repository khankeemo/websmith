<?php
namespace WSD\SDK\Widgets;

class WidgetEntry
{
    public static function render(): void
    {
        echo "\n=== ${product_name} SDK Widgets ===\n\n";
        echo "Available widgets:\n";
        echo "  1. Status Widget - Check license status\n";
        echo "  2. Activation Button - Activate a license\n";
        echo "  3. Dashboard Widget - View license overview\n";
        echo "  4. Settings Widget - Configure SDK settings\n";
        echo "\nSelect widget (1-4): ";
        $choice = trim(fgets(STDIN));
        switch ($choice) {
            case '1':
                StatusWidget::render();
                break;
            case '2':
                ActivationButtonWidget::render();
                break;
            case '3':
                DashboardWidget::render();
                break;
            case '4':
                SettingsWidget::render();
                break;
            default:
                echo "Invalid choice.\n";
                break;
        }
    }
}
