using System;
using System.IO;
using System.Text.Json;

namespace WebsmithSDK;

public static class WsdSdk
{
    private static LicenseEngine? _engine;
    private static JsonDocument? _config;

    public static LicenseEngine Init(string configPath = "config/api-config.json")
    {
        if (_engine == null)
        {
            _engine = new LicenseEngine(configPath);
        }
        return _engine;
    }

    public static LicenseEngine? GetEngine() => _engine;

    public static JsonDocument GetConfig()
    {
        if (_config == null)
        {
            var configText = File.ReadAllText("config/api-config.json");
            _config = JsonDocument.Parse(configText);
        }
        return _config;
    }

    public static string Version() => "${kit_version}";

    public static string Runtime() => "${runtime}";

    public static ActivationDialog.ActivationDialogResult ShowActivationDialog()
    {
        var client = _engine?.GetClient() ?? new ApiClient();
        var dialog = new ActivationDialog(client);
        return dialog.Show();
    }

    public static WelcomeDialog.WelcomeDialogResult ShowWelcomeDialog()
    {
        var client = _engine?.GetClient() ?? new ApiClient();
        var dialog = new WelcomeDialog(client);
        return dialog.Show();
    }

    public static RenewalDialog.RenewalDialogResult ShowRenewalDialog()
    {
        var client = _engine?.GetClient() ?? new ApiClient();
        var dialog = new RenewalDialog(client);
        return dialog.Show(null);
    }

    public static DeviceReplaceDialog.DeviceReplaceDialogResult ShowDeviceReplaceDialog()
    {
        var client = _engine?.GetClient() ?? new ApiClient();
        var dialog = new DeviceReplaceDialog(client);
        return dialog.Show(null);
    }
}
