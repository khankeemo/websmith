using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.NetworkInformation;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;

namespace WebsmithSDK
{
    public static class HardwareFingerprint
    {
        public static Dictionary<string, object> Generate()
        {
            var components = new List<string>();

            // CPU: processor count + architecture
            var cpu = $"cpu:{Environment.ProcessorCount}:{RuntimeInformation.OSArchitecture}";
            components.Add(cpu);

            // Motherboard: WMI via Win32_BaseBoard on Windows, fallback to OS info
            var motherboard = GetMotherboardInfo();
            components.Add(motherboard);

            // MAC: up to 3 active interfaces, colon-separated
            var macs = new List<string>();
            try
            {
                foreach (var ni in NetworkInterface.GetAllNetworkInterfaces())
                {
                    if (ni.OperationalStatus == OperationalStatus.Up)
                    {
                        var mac = ni.GetPhysicalAddress().ToString();
                        if (mac.Length > 0)
                            macs.Add(string.Join(":", Enumerable.Range(0, 6)
                                .Select(i => mac.Substring(i * 2, 2))));
                    }
                }
            }
            catch { /* network info unavailable */ }

            if (macs.Count > 0)
                components.Add("mac:" + string.Join(",", macs.Take(3)));

            // OS version
            components.Add("os:" + Environment.OSVersion);

            var combined = string.Join("|", components);
            using var sha256 = SHA256.Create();
            var fingerprint = Convert.ToHexStringLower(sha256.ComputeHash(Encoding.UTF8.GetBytes(combined)));

            return new Dictionary<string, object>
            {
                ["fingerprint"] = fingerprint,
                ["cpu"] = Environment.ProcessorCount.ToString(),
                ["architecture"] = RuntimeInformation.OSArchitecture.ToString(),
                ["macAddresses"] = macs.Take(3).ToList(),
                ["os"] = Environment.OSVersion.ToString(),
                ["osPlatform"] = RuntimeInformation.OSDescription
            };
        }

        private static string GetMotherboardInfo()
        {
            try
            {
                if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
                {
                    var psi = new System.Diagnostics.ProcessStartInfo
                    {
                        FileName = "wmic",
                        Arguments = "baseboard get product,manufacturer /format:csv",
                        RedirectStandardOutput = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    };
                    using var proc = System.Diagnostics.Process.Start(psi);
                    if (proc != null)
                    {
                        var output = proc.StandardOutput.ReadToEnd();
                        proc.WaitForExit(2000);
                        var lines = output.Split(new[] { '\r', '\n', '\r\n' }, StringSplitOptions.RemoveEmptyEntries);
                        if (lines.Length >= 2)
                        {
                            var parts = lines[1].Split(',');
                            if (parts.Length >= 3)
                                return $"mb:{parts[1].Trim()}:{parts[2].Trim()}";
                        }
                    }
                }
            }
            catch { /* WMI unavailable */ }
            return "mb:unknown";
        }
    }
}
