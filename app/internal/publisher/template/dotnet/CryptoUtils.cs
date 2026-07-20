using System;
using System.Security.Cryptography;
using System.Text;

namespace WebsmithSDK;

public static class CryptoUtils
{
    public static string GenerateTimestamp()
    {
        return DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ");
    }

    public static string GenerateNonce()
    {
        var bytes = new byte[16];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(bytes);
        return Convert.ToHexStringLower(bytes);
    }

    public static string SignRequest(
        string payloadJson,
        string secret,
        string timestamp,
        string nonce,
        string method = "POST",
        string path = "",
        string query = "")
    {
        var bodyHash = ComputeSha256(payloadJson);
        var message = $"{method}\n{path}\n{query}\n{bodyHash}\n{timestamp}\n{nonce}";
        return ComputeHmacSha256(message, secret);
    }

    public static string SignMessage(string message, string secret)
    {
        return ComputeHmacSha256(message, secret);
    }

    public static bool VerifySignature(
        string signature,
        string payloadJson,
        string secret,
        string timestamp,
        string nonce,
        string method = "POST",
        string path = "",
        string query = "")
    {
        var expected = SignRequest(payloadJson, secret, timestamp, nonce, method, path, query);
        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(expected),
            Encoding.UTF8.GetBytes(signature));
    }

    public static string ComputeSha256(string value)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(value));
        return Convert.ToHexStringLower(bytes);
    }

    public static string ComputeHmacSha256(string message, string secret)
    {
        var keyBytes = Encoding.UTF8.GetBytes(secret);
        var messageBytes = Encoding.UTF8.GetBytes(message);
        var hash = HMACSHA256.HashData(keyBytes, messageBytes);
        return Convert.ToHexStringLower(hash);
    }

    public static string RandomString(int length = 32)
    {
        var bytes = new byte[length];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(bytes);
        return Convert.ToHexStringLower(bytes);
    }

    public static string EncryptData(string data, string key)
    {
        using var aes = Aes.Create();
        aes.Key = SHA256.HashData(Encoding.UTF8.GetBytes(key));
        aes.GenerateIV();
        using var encryptor = aes.CreateEncryptor();
        var plaintext = Encoding.UTF8.GetBytes(data);
        var ciphertext = encryptor.TransformFinalBlock(plaintext, 0, plaintext.Length);
        var result = new byte[aes.IV.Length + ciphertext.Length];
        Buffer.BlockCopy(aes.IV, 0, result, 0, aes.IV.Length);
        Buffer.BlockCopy(ciphertext, 0, result, aes.IV.Length, ciphertext.Length);
        return Convert.ToBase64String(result);
    }

    public static string DecryptData(string encoded, string key)
    {
        var raw = Convert.FromBase64String(encoded);
        using var aes = Aes.Create();
        aes.Key = SHA256.HashData(Encoding.UTF8.GetBytes(key));
        var iv = new byte[aes.BlockSize / 8];
        Buffer.BlockCopy(raw, 0, iv, 0, iv.Length);
        aes.IV = iv;
        using var decryptor = aes.CreateDecryptor();
        var ciphertext = new byte[raw.Length - iv.Length];
        Buffer.BlockCopy(raw, iv.Length, ciphertext, 0, ciphertext.Length);
        var plaintext = decryptor.TransformFinalBlock(ciphertext, 0, ciphertext.Length);
        return Encoding.UTF8.GetString(plaintext);
    }
}
