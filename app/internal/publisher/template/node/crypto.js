const crypto = require('crypto');

function generateTimestamp() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function generateNonce() {
  return crypto.randomUUID();
}

function signRequest(payload, secret, timestamp, nonce, method, path, query) {
  const payloadJson = JSON.stringify(payload);
  const bodyHash = crypto.createHash('sha256').update(payloadJson, 'utf-8').digest('hex');
  const message = [method || 'POST', path || '', query || '', bodyHash, timestamp, nonce].join('\n');
  const signature = crypto.createHmac('sha256', secret).update(message, 'utf-8').digest();
  return signature.toString('base64');
}

module.exports = { generateTimestamp, generateNonce, signRequest };
