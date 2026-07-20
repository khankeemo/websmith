export function generateTimestamp() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function generateNonce() {
  return crypto.randomUUID();
}

async function sha256(data) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(key, data) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign'],
  );
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export async function signRequest(payload, secret, timestamp, nonce, method = 'POST', path = '', query = '') {
  const bodyHash = await sha256(JSON.stringify(payload));
  const message = [method, path, query, bodyHash, timestamp, nonce].join('\n');
  return arrayBufferToBase64(await hmacSha256(secret, message));
}
