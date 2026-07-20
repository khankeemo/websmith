<?php
namespace WSD\SDK;

require_once __DIR__ . '/client.php';
require_once __DIR__ . '/crypto.php';
require_once __DIR__ . '/hardware.php';
require_once __DIR__ . '/cache.php';
require_once __DIR__ . '/license_engine.php';
require_once __DIR__ . '/activation.php';
require_once __DIR__ . '/welcome.php';
require_once __DIR__ . '/renewal.php';
require_once __DIR__ . '/device_replace.php';

class WsdSDK
{
    private static ?LicenseEngine $engine = null;
    private static ?array $config = null;

    public static function init(?string $configPath = null): LicenseEngine
    {
        if (self::$engine === null) {
            self::$engine = new LicenseEngine($configPath);
        }
        return self::$engine;
    }

    public static function getEngine(): ?LicenseEngine
    {
        return self::$engine;
    }

    public static function getConfig(): array
    {
        if (self::$config === null) {
            self::$config = self::loadConfig();
        }
        return self::$config;
    }

    private static function loadConfig(): array
    {
        $paths = [
            __DIR__ . '/config/api-config.json',
            getcwd() . '/config/api-config.json',
        ];
        foreach ($paths as $path) {
            if (file_exists($path)) {
                $data = @file_get_contents($path);
                if ($data !== false) {
                    $decoded = json_decode($data, true);
                    if (is_array($decoded)) {
                        return $decoded;
                    }
                }
            }
        }
        return [];
    }

    public static function version(): string
    {
        return '${kit_version}';
    }

    public static function runtime(): string
    {
        return '${runtime}';
    }

    public static function showActivationDialog(): array
    {
        $dialog = new ActivationDialog();
        return $dialog->show();
    }

    public static function showWelcomeDialog(): array
    {
        $dialog = new WelcomeDialog();
        return $dialog->show();
    }

    public static function showRenewalDialog(): array
    {
        $dialog = new RenewalDialog();
        return $dialog->show();
    }

    public static function showDeviceReplaceDialog(): array
    {
        $dialog = new DeviceReplaceDialog();
        return $dialog->show();
    }
}
