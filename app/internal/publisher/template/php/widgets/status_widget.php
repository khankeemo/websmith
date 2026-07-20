<?php
namespace WSD\SDK\Widgets;

use WSD\SDK\LicenseEngine;

class StatusWidget
{
    public static function render(): void
    {
        echo "\n--- License Status ---\n\n";
        try {
            $engine = new LicenseEngine();
            $status = $engine->initialize();
            echo "Status: " . strtoupper($status->status) . "\n";
            echo "Valid: " . ($status->valid ? 'YES' : 'NO') . "\n";
            $line = str_repeat('-', 40);
            echo $line . "\n";
            echo "Expires At: " . ($status->expiresAt ?? 'N/A') . "\n";
            echo "Days Remaining: {$status->daysRemaining}\n";
            echo "Plan: " . ($status->plan ?? 'N/A') . "\n";
            echo "Hardware ID: " . ($status->hardwareId ?? 'N/A') . "\n";
            echo "License Key: " . ($status->licenseKey ?? 'N/A') . "\n";
            echo $line . "\n";
            echo "Message: " . ($status->message ?? 'N/A') . "\n";
            echo "Trial Active: " . ($status->trialActive ? 'Yes' : 'No') . "\n";
            echo $line . "\n";
            if ($status->valid) {
                echo "License is ACTIVE\n";
                if ($status->daysRemaining > 0 && $status->daysRemaining <= 7) {
                    echo "WARNING: License expires in {$status->daysRemaining} day(s)!\n";
                }
            } elseif ($status->status === 'trial') {
                echo "Trial is active with {$status->daysRemaining} day(s) remaining.\n";
            } elseif ($status->status === 'expired') {
                echo "License has expired. Please renew.\n";
            } elseif ($status->status === 'unlicensed') {
                echo "No license found. Please activate or start a trial.\n";
            } else {
                echo "Status: {$status->status}\n";
                if ($status->message) {
                    echo "{$status->message}\n";
                }
            }
        } catch (\Throwable $e) {
            echo "Status check failed: {$e->getMessage()}\n";
        }
    }
}
