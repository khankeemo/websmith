export function generateTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function generateNonce(): string {
  return crypto.randomUUID();
}

async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(key: string, data: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw', encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign'],
  );
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function signRequest(
  payload: Record<string, unknown>,
  secret: string,
  timestamp: string,
  nonce: string,
  method: string = 'POST',
  path: string = '',
  query: string = '',
): Promise<string> {
  const payloadJson = JSON.stringify(payload);
  const bodyHash = await sha256(payloadJson);
  const message = [method, path, query, bodyHash, timestamp, nonce].join('\n');
  const signature = await hmacSha256(secret, message);
  return arrayBufferToBase64(signature);
}
