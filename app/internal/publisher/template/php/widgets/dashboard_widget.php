<?php
namespace WSD\SDK\Widgets;

use WSD\SDK\LicenseEngine;

class DashboardWidget
{
    public static function render(): void
    {
        echo "\n=== License Dashboard ===\n\n";
        try {
            $engine = new LicenseEngine();
            $status = $engine->initialize();
            echo "License Status: {$status->status}\n";
            echo "Valid: " . ($status->valid ? 'Yes' : 'No') . "\n";
            if ($status->expiresAt !== null) {
                echo "Expires: {$status->expiresAt}\n";
            }
            echo "Days Remaining: {$status->daysRemaining}\n";
            if ($status->plan !== null) {
                echo "Plan: {$status->plan}\n";
            }
            if ($status->hardwareId !== null) {
                echo "Hardware ID: {$status->hardwareId}\n";
            }
            if ($status->licenseKey !== null) {
                echo "License Key: {$status->licenseKey}\n";
            }
            if ($status->message !== null) {
                echo "Message: {$status->message}\n";
            }
            echo "Trial Active: " . ($status->trialActive ? 'Yes' : 'No') . "\n";
            echo "\n---\n";
            if ($engine->hasLicenseKey()) {
                echo "License Key Available: Yes\n";
                echo "Hardware ID: {$engine->getHardwareId()}\n";
            } else {
                echo "License Key Available: No\n";
            }
        } catch (\Throwable $e) {
            echo "Dashboard error: {$e->getMessage()}\n";
        }
    }
}
