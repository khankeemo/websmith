package wsd

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"time"
)

func GenerateTimestamp() string {
	return time.Now().UTC().Format("2006-01-02T15:04:05Z")
}

func GenerateNonce() string {
	b := make([]byte, 16)
	n, err := io.ReadFull(rand.Reader, b)
	if err != nil || n != 16 {
		return fmt.Sprintf("%x", time.Now().UnixNano())
	}
	return hex.EncodeToString(b)
}

func SignRequest(payload interface{}, secret string, timestamp string, nonce string, method string, path string, query string) string {
	var bodyHash string
	if payload != nil {
		b, err := json.Marshal(payload)
		if err == nil {
			h := sha256.Sum256(b)
			bodyHash = hex.EncodeToString(h[:])
		}
	}
	message := fmt.Sprintf("%s\n%s\n%s\n%s\n%s\n%s", method, path, query, bodyHash, timestamp, nonce)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(message))
	return base64.StdEncoding.EncodeToString(mac.Sum(nil))
}

func VerifySignature(payload interface{}, secret string, timestamp string, nonce string, expectedSig string, method string, path string, query string) bool {
	computedSig := SignRequest(payload, secret, timestamp, nonce, method, path, query)
	return hmac.Equal([]byte(computedSig), []byte(expectedSig))
}

func HashString(input string) string {
	h := sha256.Sum256([]byte(input))
	return hex.EncodeToString(h[:])
}

func GenerateAPIKey() string {
	b := make([]byte, 32)
	io.ReadFull(rand.Reader, b)
	return "pk_" + hex.EncodeToString(b)
}

func GenerateAPISecret() string {
	b := make([]byte, 48)
	io.ReadFull(rand.Reader, b)
	return hex.EncodeToString(b)
}
