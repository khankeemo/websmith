using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net.NetworkInformation;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;

namespace WebsmithSDK;

public class HardwareDetector
{
    private string? _fingerprint;
    private Dictionary<string, string>? _identifiers;

    public string GetFingerprint()
    {
        if (_fingerprint == null)
        {
            var ids = CollectIdentifiers();
            var combined = BuildCombinedString(ids);
            _fingerprint = HashIdentifiers(combined);
            _identifiers = ids;
        }
        return _fingerprint;
    }

    public Dictionary<string, string> GetIdentifiers()
    {
        if (_identifiers == null) GetFingerprint();
        return _identifiers ?? new Dictionary<string, string>();
    }

    private Dictionary<string, string> CollectIdentifiers()
    {
        var ids = new Dictionary<string, string>();

        var cpuId = GetCpuId();
        if (cpuId != null) ids["cpu_id"] = cpuId;

        var motherboardId = GetMotherboardId();
        if (motherboardId != null) ids["motherboard_id"] = motherboardId;

        if (!ids.ContainsKey("motherboard_id"))
        {
            var networkId = GetNetworkId();
            if (networkId != null) ids["network_id"] = networkId;
        }

        var osInfo = GetOsInfo();
        if (osInfo != null) ids["os_info"] = osInfo;

        return ids;
    }

    private string? GetCpuId()
    {
        try
        {
            if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
                return GetCpuIdWindows();
            else if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
                return GetCpuIdDarwin();
            else if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
                return GetCpuIdLinux();
        }
        catch { }
        return RuntimeInformation.OSArchitecture.ToString();
    }

    private string? GetCpuIdWindows()
    {
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = "wmic",
                Arguments = "cpu get ProcessorId /value",
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            using var proc = Process.Start(psi);
            if (proc != null)
            {
                var output = proc.StandardOutput.ReadToEnd();
                proc.WaitForExit(2000);
                foreach (var line in output.Split('\n', '\r'))
                {
                    if (line.StartsWith("ProcessorId="))
                    {
                        var id = line["ProcessorId=".Length..].Trim();
                        if (!string.IsNullOrEmpty(id)) return id;
                    }
                }
            }
        }
        catch { }
        return RuntimeInformation.OSArchitecture.ToString();
    }

    private string? GetCpuIdDarwin()
    {
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = "sysctl",
                Arguments = "-n hw.model",
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            using var proc = Process.Start(psi);
            if (proc != null)
            {
                var model = proc.StandardOutput.ReadToEnd().Trim();
                proc.WaitForExit(2000);
                if (!string.IsNullOrEmpty(model)) return "mac-" + model;
            }
        }
        catch { }
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = "sysctl",
                Arguments = "-n machdep.cpu.brand_string",
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            using var proc = Process.Start(psi);
            if (proc != null)
            {
                var brand = proc.StandardOutput.ReadToEnd().Trim();
                proc.WaitForExit(2000);
                if (!string.IsNullOrEmpty(brand))
                {
                    return Convert.ToHexStringLower(
                        SHA256.HashData(Encoding.UTF8.GetBytes(brand)))[..16];
                }
            }
        }
        catch { }
        return RuntimeInformation.OSArchitecture.ToString();
    }

    private string? GetCpuIdLinux()
    {
        try
        {
            var cpuinfo = File.ReadAllText("/proc/cpuinfo");
            foreach (var line in cpuinfo.Split('\n'))
            {
                if (line.StartsWith("Serial", StringComparison.OrdinalIgnoreCase))
                {
                    var parts = line.Split(':');
                    if (parts.Length > 1)
                    {
                        var serial = parts[1].Trim();
                        if (!string.IsNullOrEmpty(serial)) return "cpu-" + serial;
                    }
                }
            }
            string vendor = "", family = "";
            foreach (var line in cpuinfo.Split('\n'))
            {
                if (line.StartsWith("vendor_id"))
                {
                    var parts = line.Split(':');
                    if (parts.Length > 1) vendor = parts[1].Trim();
                }
                else if (line.StartsWith("cpu family"))
                {
                    var parts = line.Split(':');
                    if (parts.Length > 1) family = parts[1].Trim();
                }
            }
            if (!string.IsNullOrEmpty(vendor) && !string.IsNullOrEmpty(family))
                return $"{vendor}-{family}";
        }
        catch { }
        return RuntimeInformation.OSArchitecture.ToString();
    }

    private string? GetMotherboardId()
    {
        try
        {
            if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            {
                var psi = new ProcessStartInfo
                {
                    FileName = "wmic",
                    Arguments = "baseboard get SerialNumber /value",
                    RedirectStandardOutput = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };
                using var proc = Process.Start(psi);
                if (proc != null)
                {
                    var output = proc.StandardOutput.ReadToEnd();
                    proc.WaitForExit(2000);
                    foreach (var line in output.Split('\n', '\r'))
                    {
                        if (line.StartsWith("SerialNumber="))
                        {
                            var serial = line["SerialNumber=".Length..].Trim();
                            if (!string.IsNullOrEmpty(serial)
                                && !serial.Equals("To be filled by O.E.M.", StringComparison.OrdinalIgnoreCase)
                                && !serial.Equals("Default string", StringComparison.OrdinalIgnoreCase))
                                return "mb-" + serial;
                        }
                    }
                }
            }
            else if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
            {
                var psi = new ProcessStartInfo
                {
                    FileName = "dmidecode",
                    Arguments = "-s baseboard-serial-number",
                    RedirectStandardOutput = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };
                using var proc = Process.Start(psi);
                if (proc != null)
                {
                    var serial = proc.StandardOutput.ReadToEnd().Trim();
                    proc.WaitForExit(2000);
                    if (!string.IsNullOrEmpty(serial)
                        && !serial.Equals("To be filled by O.E.M.", StringComparison.OrdinalIgnoreCase)
                        && !serial.Equals("Default string", StringComparison.OrdinalIgnoreCase))
                        return "mb-" + serial;
                }
            }
        }
        catch { }
        return null;
    }

    private string? GetNetworkId()
    {
        try
        {
            var macs = new List<string>();
            foreach (var ni in NetworkInterface.GetAllNetworkInterfaces())
            {
                if (ni.OperationalStatus == OperationalStatus.Up
                    && ni.NetworkInterfaceType != NetworkInterfaceType.Loopback)
                {
                    var mac = ni.GetPhysicalAddress().ToString();
                    if (mac.Length > 0)
                    {
                        macs.Add(string.Join(":",
                            Enumerable.Range(0, 6).Select(i => mac.Substring(i * 2, 2))));
                    }
                }
            }
            if (macs.Count > 0)
            {
                var combined = "net-" + string.Join(":", macs.Take(3));
                return Convert.ToHexStringLower(
                    SHA256.HashData(Encoding.UTF8.GetBytes(combined)))[..16];
            }
        }
        catch { }
        return null;
    }

    private string? GetOsInfo()
    {
        return RuntimeInformation.OSDescription;
    }

    private static string BuildCombinedString(Dictionary<string, string> identifiers)
    {
        var parts = new List<string>();
        foreach (var key in new[] { "cpu_id", "motherboard_id", "network_id" })
        {
            if (identifiers.TryGetValue(key, out var value))
                parts.Add(value);
        }
        return string.Join("|", parts);
    }

    private static string HashIdentifiers(string data)
    {
        return Convert.ToHexStringLower(
            SHA256.HashData(Encoding.UTF8.GetBytes(data)));
    }
}
