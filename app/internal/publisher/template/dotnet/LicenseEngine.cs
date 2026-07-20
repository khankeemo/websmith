using System;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;

namespace WebsmithSDK;

public class LicenseEngine
{
    private readonly ApiClient _client;
    private readonly CacheManager _cache;
    private readonly HardwareDetector _hardware;
    private readonly string _hardwareId;
    private string? _licenseKey;
    private JsonDocument? _status;

    public LicenseEngine() : this("config/api-config.json") { }

    public LicenseEngine(string configPath)
    {
        var configText = File.ReadAllText(configPath);
        var config = JsonDocument.Parse(configText);
        _hardware = new HardwareDetector();
        _cache = new CacheManager(config);
        _client = new ApiClient(config, _hardware, _cache);
        _hardwareId = _hardware.GetFingerprint();
    }

    public ApiClient GetClient() => _client;

    public LicenseStatus Initialize()
    {
        if (_cache.IsValid())
        {
            var cached = _cache.GetLicenseStatus();
            if (cached != null)
            {
                try
                {
                    _status = JsonDocument.Parse(cached);
                    return LicenseStatus.FromJson(_status.RootElement);
                }
                catch { }
            }
        }
        try
        {
            var trialResponse = _client.GetTrialStatus(_hardwareId).Result;
            JsonElement trialData;
            if (trialResponse.RootElement.TryGetProperty("data", out var d))
                trialData = d;
            else
                trialData = trialResponse.RootElement;

            if (trialData.TryGetProperty("has_trial", out var hasTrial) && hasTrial.GetBoolean())
            {
                var statusStr = trialData.TryGetProperty("status", out var st) ? st.GetString() ?? "trial" : "trial";
                var ls = new LicenseStatus(
                    statusStr == "active",
                    statusStr,
                    trialData.TryGetProperty("expiry_date", out var ed) ? ed.GetString() : null,
                    trialData.TryGetProperty("days_left", out var dl) ? dl.GetInt32() : 0,
                    trialData.TryGetProperty("plan", out var p) ? p.GetString() : null,
                    _hardwareId,
                    $"Trial is {statusStr}",
                    null,
                    statusStr == "trial"
                );
                if (ls.Valid)
                    _cache.SetLicenseStatus(ls.ToJson().RootElement.GetRawText());
                _status = ls.ToJson();
                return ls;
            }

            var unlicensed = new LicenseStatus(false, "unlicensed", _hardwareId,
                "No license or trial found");
            _status = unlicensed.ToJson();
            return unlicensed;
        }
        catch (Exception e)
        {
            var cached = _cache.GetLicenseStatus();
            if (cached != null)
            {
                try
                {
                    _status = JsonDocument.Parse(cached);
                    return LicenseStatus.FromJson(_status.RootElement);
                }
                catch { }
            }
            var err = new LicenseStatus(false, "error", null,
                $"Unexpected error: {e.Message}");
            _status = err.ToJson();
            return err;
        }
    }

    public string GetHardwareId() => _hardwareId;
    public string? GetLicenseKey() => _licenseKey;
    public bool HasLicenseKey() => !string.IsNullOrEmpty(_licenseKey);

    public bool IsValid()
    {
        if (_status == null) return false;
        var root = _status.RootElement;
        if (!root.TryGetProperty("status", out var status) || status.GetString() != "active")
            return false;
        if (root.TryGetProperty("expires_at", out var expiresAt) && expiresAt.ValueKind == JsonValueKind.String)
        {
            if (DateTime.TryParse(expiresAt.GetString(), out var exp) && exp < DateTime.UtcNow)
                return false;
        }
        return true;
    }

    public LicenseStatus? GetStatus()
    {
        if (_status == null) return null;
        return LicenseStatus.FromJson(_status.RootElement);
    }

    public async Task<JsonDocument> Validate(string? licenseKey = null)
    {
        var key = licenseKey ?? _licenseKey;
        if (string.IsNullOrEmpty(key))
            throw new InvalidOperationException("License key unavailable. Please activate first.");

        var result = await _client.ValidateLicense(key, _hardwareId);
        JsonElement data;
        if (result.RootElement.TryGetProperty("data", out var d))
            data = d;
        else
            data = result.RootElement;

        if (data.TryGetProperty("valid", out var v) && v.GetBoolean())
        {
            if (data.TryGetProperty("license_key", out var lk))
                _licenseKey = lk.GetString();
            Initialize();
        }
        return result;
    }

    public async Task<JsonDocument> Activate(string licenseKey)
    {
        var result = await _client.ActivateLicense(licenseKey, _hardwareId);
        if (result.RootElement.TryGetProperty("success", out var s) && s.GetBoolean())
        {
            _licenseKey = licenseKey;
            Initialize();
        }
        return result;
    }

    public async Task<JsonDocument> StartTrial(string email, string customerName, Dictionary<string, object>? customerData = null)
    {
        var result = await _client.StartTrial(email, customerName, _hardwareId, customerData);
        if (result.RootElement.TryGetProperty("success", out var s) && s.GetBoolean())
            Initialize();
        return result;
    }

    public async Task<JsonDocument> ConvertTrial(string? plan, string customerName, string customerEmail)
    {
        var ls = GetStatus();
        if (ls == null || ls.Status != "trial")
            throw new InvalidOperationException("No active trial to convert.");

        var result = await _client.ConvertTrial(_hardwareId, plan, customerName, customerEmail);
        if (result.RootElement.TryGetProperty("success", out var s) && s.GetBoolean())
        {
            if (result.RootElement.TryGetProperty("license_key", out var lk))
                _licenseKey = lk.GetString();
            Initialize();
        }
        return result;
    }

    public async Task<JsonDocument> Renew(int? extraDays = null)
    {
        if (string.IsNullOrEmpty(_licenseKey))
            throw new InvalidOperationException("License key unavailable. Please activate first.");

        var result = await _client.RenewLicense(_licenseKey, extraDays);
        if (result.RootElement.TryGetProperty("success", out var s) && s.GetBoolean())
            Initialize();
        return result;
    }

    public async Task<JsonDocument> Deactivate(string? licenseKey = null)
    {
        var key = licenseKey ?? _licenseKey;
        if (string.IsNullOrEmpty(key))
            throw new InvalidOperationException("License key unavailable. Please provide a key.");

        var result = await _client.DeactivateLicense(key, _hardwareId);
        if (result.RootElement.TryGetProperty("success", out var s) && s.GetBoolean())
        {
            _cache.InvalidateLicenseStatus();
            _status = null;
            if (licenseKey == null)
                _licenseKey = null;
        }
        return result;
    }

    public async Task<JsonDocument> ReplaceHardware()
    {
        if (string.IsNullOrEmpty(_licenseKey))
            throw new InvalidOperationException("License key unavailable. Please activate first.");

        var newHardwareId = _hardware.GetFingerprint();
        string? oldHardwareId = null;

        if (_status != null && _status.RootElement.TryGetProperty("hardware_id", out var hw))
            oldHardwareId = hw.GetString();

        if (oldHardwareId == null)
        {
            var cached = _cache.GetLicenseStatus();
            if (cached != null)
            {
                try
                {
                    var doc = JsonDocument.Parse(cached);
                    if (doc.RootElement.TryGetProperty("hardware_id", out var chw))
                        oldHardwareId = chw.GetString();
                }
                catch { }
            }
        }

        if (oldHardwareId == null)
            throw new InvalidOperationException("Current hardware_id unavailable. Cannot replace device.");

        if (oldHardwareId == newHardwareId)
            return JsonDocument.Parse("{\"success\":false,\"message\":\"Old and new hardware IDs are identical.\"}");

        var result = await _client.ReplaceDevice(_licenseKey, oldHardwareId, newHardwareId);
        if (result.RootElement.TryGetProperty("success", out var s) && s.GetBoolean())
        {
            _cache.InvalidateLicenseStatus();
            _status = null;
            Initialize();
        }
        return result;
    }

    public async Task<JsonDocument> BindDevice(string? licenseKey = null, string? deviceName = null)
    {
        var key = licenseKey ?? _licenseKey;
        if (string.IsNullOrEmpty(key))
            throw new InvalidOperationException("License key unavailable.");

        var result = await _client.BindDevice(key, _hardwareId, deviceName);
        if (result.RootElement.TryGetProperty("success", out var s) && s.GetBoolean())
            Initialize();
        return result;
    }
}

public class LicenseStatus
{
    public bool Valid { get; }
    public string Status { get; }
    public string? ExpiresAt { get; }
    public int DaysRemaining { get; }
    public string? Plan { get; }
    public string? HardwareId { get; }
    public string? Message { get; }
    public string? LicenseKey { get; }
    public bool TrialActive { get; }

    public LicenseStatus(bool valid, string status, string? expiresAt, int daysRemaining,
        string? plan, string? hardwareId, string? message, string? licenseKey, bool trialActive)
    {
        Valid = valid;
        Status = status;
        ExpiresAt = expiresAt;
        DaysRemaining = daysRemaining;
        Plan = plan;
        HardwareId = hardwareId;
        Message = message;
        LicenseKey = licenseKey;
        TrialActive = trialActive;
    }

    public LicenseStatus(bool valid, string status, string? hardwareId, string? message)
        : this(valid, status, null, 0, null, hardwareId, message, null, status == "trial") { }

    public static LicenseStatus FromJson(JsonElement data)
    {
        var status = data.TryGetProperty("status", out var s) ? s.GetString() ?? "unlicensed" : "unlicensed";
        return new LicenseStatus(
            data.TryGetProperty("valid", out var v) && v.GetBoolean(),
            status,
            data.TryGetProperty("expires_at", out var ea) && ea.ValueKind == JsonValueKind.String ? ea.GetString() : null,
            data.TryGetProperty("days_remaining", out var dr) ? dr.GetInt32() : 0,
            data.TryGetProperty("plan", out var p) && p.ValueKind == JsonValueKind.String ? p.GetString() : null,
            data.TryGetProperty("hardware_id", out var hw) && hw.ValueKind == JsonValueKind.String ? hw.GetString() : null,
            data.TryGetProperty("message", out var m) && m.ValueKind == JsonValueKind.String ? m.GetString() : null,
            data.TryGetProperty("license_key", out var lk) && lk.ValueKind == JsonValueKind.String ? lk.GetString() : null,
            data.TryGetProperty("trial_active", out var ta) ? ta.GetBoolean() : status == "trial"
        );
    }

    public JsonDocument ToJson()
    {
        var obj = new Dictionary<string, object?>
        {
            ["valid"] = Valid,
            ["status"] = Status,
            ["expires_at"] = ExpiresAt,
            ["days_remaining"] = DaysRemaining,
            ["plan"] = Plan,
            ["hardware_id"] = HardwareId,
            ["message"] = Message,
            ["license_key"] = LicenseKey,
            ["trial_active"] = TrialActive
        };
        var json = JsonSerializer.Serialize(obj);
        return JsonDocument.Parse(json);
    }
}
