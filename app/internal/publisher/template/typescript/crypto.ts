import * as crypto from 'crypto';

export function generateTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function generateNonce(): string {
  return crypto.randomUUID();
}

export function signRequest(
  payload: Record<string, unknown>,
  secret: string,
  timestamp: string,
  nonce: string,
  method: string = 'POST',
  path: string = '',
  query: string = '',
): string {
  const payloadJson = JSON.stringify(payload);
  const bodyHash = crypto.createHash('sha256').update(payloadJson, 'utf-8').digest('hex');
  const message = [method, path, query, bodyHash, timestamp, nonce].join('\n');
  const signature = crypto.createHmac('sha256', secret).update(message, 'utf-8').digest();
  return signature.toString('base64');
}
