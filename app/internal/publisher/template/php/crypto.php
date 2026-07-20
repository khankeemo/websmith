<?php
namespace WSD\SDK;

class CryptoUtils
{
    public static function generateTimestamp(): string
    {
        return gmdate('Y-m-d\TH:i:s\Z');
    }

    public static function generateNonce(): string
    {
        return bin2hex(random_bytes(16));
    }

    public static function signRequest(
        array $payload,
        string $secret,
        string $timestamp,
        string $nonce,
        string $method = 'POST',
        string $path = '',
        string $query = ''
    ): string {
        $payloadJson = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if ($payloadJson === false) {
            throw new \RuntimeException('Failed to encode payload as JSON');
        }
        $bodyHash = hash('sha256', $payloadJson, true);
        $bodyHashHex = bin2hex($bodyHash);
        $message = $method . "\n" . $path . "\n" . $query . "\n" . $bodyHashHex . "\n" . $timestamp . "\n" . $nonce;
        $raw = hash_hmac('sha256', $message, $secret, true);
        return base64_encode($raw);
    }

    public static function signMessage(string $message, string $secret): string
    {
        $raw = hash_hmac('sha256', $message, $secret, true);
        return base64_encode($raw);
    }

    public static function verifySignature(
        string $signature,
        array $payload,
        string $secret,
        string $timestamp,
        string $nonce,
        string $method = 'POST',
        string $path = '',
        string $query = ''
    ): bool {
        $expected = self::signRequest($payload, $secret, $timestamp, $nonce, $method, $path, $query);
        return hash_equals($expected, $signature);
    }

    public static function sha256Hex(string $data): string
    {
        return hash('sha256', $data);
    }

    public static function randomString(int $length = 32): string
    {
        return bin2hex(random_bytes($length));
    }

    public static function encryptData(string $data, string $key): string
    {
        $iv = random_bytes(16);
        $encrypted = openssl_encrypt($data, 'aes-256-cbc', hash('sha256', $key, true), OPENSSL_RAW_DATA, $iv);
        if ($encrypted === false) {
            throw new \RuntimeException('Encryption failed');
        }
        return base64_encode($iv . $encrypted);
    }

    public static function decryptData(string $encoded, string $key): string
    {
        $raw = base64_decode($encoded, true);
        if ($raw === false || strlen($raw) < 16) {
            throw new \RuntimeException('Invalid encrypted data');
        }
        $iv = substr($raw, 0, 16);
        $ciphertext = substr($raw, 16);
        $decrypted = openssl_decrypt($ciphertext, 'aes-256-cbc', hash('sha256', $key, true), OPENSSL_RAW_DATA, $iv);
        if ($decrypted === false) {
            throw new \RuntimeException('Decryption failed');
        }
        return $decrypted;
    }
}
