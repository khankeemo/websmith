// FILE: app/internal/api/docs/public-api/page.tsx
// PURPOSE: Public API Developer Documentation Page
// Reads from public-api-contract.json and displays endpoints

"use client";

import { useState, useEffect } from "react";
import {
  Code2,
  Key,
  Shield,
  Clock,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  FileJson,
  Terminal,
  Info,
  Server,
  Lock,
  Zap,
} from "lucide-react";

interface Contract {
  openapi: string;
  info: {
    title: string;
    description: string;
    version: string;
    contact: {
      name: string;
      email: string;
      url: string;
    };
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
  components: {
    schemas: Record<string, any>;
  };
  paths: Record<string, any>;
}

export default function PublicApiDocs() {
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [activeEndpoint, setActiveEndpoint] = useState<string | null>(null);

  useEffect(() => {
    fetch("/public-api-contract.json")
      .then((res) => res.json())
      .then((data) => {
        setContract(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load API contract:", err);
        setLoading(false);
      });
  }, []);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const getMethodColor = (method: string) => {
    switch (method.toLowerCase()) {
      case "post":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "get":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "put":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "delete":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  const renderExample = (example: any, title: string) => {
    return (
      <div className="rounded-lg bg-[var(--bg-tertiary)]/50 border border-[var(--border-color)] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-[var(--bg-tertiary)]/30 border-b border-[var(--border-color)]">
          <span className="text-xs font-medium text-[var(--text-secondary)]">{title}</span>
          <button
            onClick={() => copyToClipboard(JSON.stringify(example, null, 2), title)}
            className="p-1 rounded hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            {copied === title ? (
              <Check size={14} className="text-emerald-400" />
            ) : (
              <Copy size={14} className="text-[var(--text-secondary)]" />
            )}
          </button>
        </div>
        <pre className="p-4 text-sm text-[var(--text-primary)] overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(example, null, 2)}
        </pre>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <span className="text-sm text-[var(--text-secondary)]">Loading API documentation...</span>
        </div>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle size={40} className="text-red-400" />
          <span className="text-sm text-[var(--text-secondary)]">
            Failed to load API documentation. Please try again later.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Code2 size={20} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">
              {contract.info.title}
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              {contract.info.description}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-secondary)]">
          <span className="flex items-center gap-1">
            <FileJson size={12} />
            OpenAPI v{contract.openapi}
          </span>
          <span className="flex items-center gap-1">
            <Server size={12} />
            v{contract.info.version}
          </span>
          <a
            href={`mailto:${contract.info.contact.email}`}
            className="flex items-center gap-1 hover:text-blue-400 transition-colors"
          >
            <ExternalLink size={12} />
            Contact Support
          </a>
        </div>
      </div>

      {/* Servers */}
      <div className="mb-8 p-4 rounded-xl bg-[var(--bg-tertiary)]/30 border border-[var(--border-color)]">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2">
          <Server size={14} className="text-blue-400" />
          Base URLs
        </h3>
        <div className="space-y-1">
          {contract.servers.map((server, idx) => (
            <div key={idx} className="flex items-center gap-2 text-sm">
              <span className="text-[var(--text-secondary)]">{server.description}:</span>
              <code className="text-xs bg-[var(--bg-tertiary)] px-2 py-0.5 rounded border border-[var(--border-color)] text-[var(--text-primary)]">
                {server.url}
              </code>
            </div>
          ))}
        </div>
      </div>

      {/* Authentication */}
      <div className="mb-8 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2">
          <Lock size={14} className="text-amber-400" />
          Authentication
        </h3>
        <div className="space-y-2 text-sm text-[var(--text-secondary)]">
          <p>All requests require the following headers:</p>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-mono bg-[var(--bg-tertiary)] px-2 py-0.5 rounded border border-[var(--border-color)]">
                X-API-Key
              </span>
              <span>Your API key</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono bg-[var(--bg-tertiary)] px-2 py-0.5 rounded border border-[var(--border-color)]">
                X-Timestamp
              </span>
              <span>ISO timestamp (e.g., 2026-01-01T00:00:00Z)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono bg-[var(--bg-tertiary)] px-2 py-0.5 rounded border border-[var(--border-color)]">
                X-Nonce
              </span>
              <span>Unique UUID for each request</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono bg-[var(--bg-tertiary)] px-2 py-0.5 rounded border border-[var(--border-color)]">
                X-Signature
              </span>
              <span>HMAC-SHA256 signature of the request</span>
            </div>
          </div>
          <div className="mt-2 text-xs bg-[var(--bg-tertiary)]/50 p-3 rounded-lg border border-[var(--border-color)]">
            <p className="font-mono text-[var(--text-secondary)]">
              # Build signature string:
              <br />
              message = method + "\n" + path + "\n" + query + "\n" + body_hash + "\n" + timestamp + "\n" + nonce
              <br />
              signature = HMAC-SHA256(secret, message)
            </p>
          </div>
        </div>
      </div>

      {/* Endpoints */}
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Terminal size={18} className="text-blue-400" />
          Endpoints
        </h2>

        {Object.entries(contract.paths).map(([path, pathData]: [string, any]) => {
          const methods = Object.keys(pathData);
          const isActive = activeEndpoint === path;

          return (
            <div
              key={path}
              className="rounded-xl border border-[var(--border-color)] overflow-hidden bg-[var(--bg-primary)]"
            >
              {/* Endpoint Header */}
              <button
                onClick={() => setActiveEndpoint(isActive ? null : path)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-tertiary)]/30 transition-colors"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {methods.map((method) => (
                    <span
                      key={method}
                      className={`text-xs font-medium px-2 py-0.5 rounded border ${getMethodColor(method)}`}
                    >
                      {method.toUpperCase()}
                    </span>
                  ))}
                  <code className="text-sm font-mono text-[var(--text-primary)]">
                    {path}
                  </code>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-[var(--text-secondary)]">
                    {pathData[methods[0]]?.summary || "No description"}
                  </span>
                  <span className={`transform transition-transform ${isActive ? "rotate-180" : ""}`}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                </div>
              </button>

              {/* Endpoint Details */}
              {isActive && (
                <div className="px-4 pb-4 space-y-4 border-t border-[var(--border-color)] pt-4">
                  {Object.entries(pathData).map(([method, methodData]: [string, any]) => {
                    const example = methodData?.requestBody?.content?.["application/json"]?.examples;
                    const exampleValues = example ? Object.values(example) : [];
                    const responses = methodData?.responses || {};

                    return (
                      <div key={method} className="space-y-3">
                        {/* Method Header */}
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded border ${getMethodColor(method)}`}>
                            {method.toUpperCase()}
                          </span>
                          <span className="text-sm font-medium text-[var(--text-primary)]">
                            {methodData.summary || "No description"}
                          </span>
                        </div>

                        {/* Description */}
                        {methodData.description && (
                          <p className="text-sm text-[var(--text-secondary)]">
                            {methodData.description}
                          </p>
                        )}

                        {/* Request Examples */}
                        {exampleValues.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-[var(--text-secondary)] mb-2 flex items-center gap-1">
                              <Code2 size={12} />
                              Request Example
                            </h4>
                            <div className="space-y-3">
                              {exampleValues.map((ex: any, idx: number) => {
                                const title = ex?.summary || `Example ${idx + 1}`;
                                return renderExample(ex?.value, title);
                              })}
                            </div>
                          </div>
                        )}

                        {/* Success Response */}
                        {responses["200"] && (
                          <div>
                            <h4 className="text-xs font-semibold text-[var(--text-secondary)] mb-2 flex items-center gap-1">
                              <CheckCircle2 size={12} className="text-emerald-400" />
                              Success Response (200)
                            </h4>
                            <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3">
                              <p className="text-xs text-[var(--text-secondary)]">
                                Returns <span className="text-emerald-400 font-medium">success: true</span> with data
                              </p>
                              <div className="mt-2 text-xs text-[var(--text-secondary)]">
                                <span className="flex items-center gap-2">
                                  <span className="font-mono bg-[var(--bg-tertiary)] px-2 py-0.5 rounded border border-[var(--border-color)]">
                                    X-RateLimit-Limit
                                  </span>
                                  Rate limit per minute
                                </span>
                                <span className="flex items-center gap-2 mt-1">
                                  <span className="font-mono bg-[var(--bg-tertiary)] px-2 py-0.5 rounded border border-[var(--border-color)]">
                                    X-RateLimit-Remaining
                                  </span>
                                  Remaining requests
                                </span>
                                <span className="flex items-center gap-2 mt-1">
                                  <span className="font-mono bg-[var(--bg-tertiary)] px-2 py-0.5 rounded border border-[var(--border-color)]">
                                    X-RateLimit-Reset
                                  </span>
                                  Seconds until reset
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Error Response */}
                        {responses["400"] && (
                          <div>
                            <h4 className="text-xs font-semibold text-[var(--text-secondary)] mb-2 flex items-center gap-1">
                              <AlertCircle size={12} className="text-amber-400" />
                              Error Response
                            </h4>
                            <div className="rounded-lg bg-red-500/5 border border-red-500/20 p-3">
                              <div className="space-y-1 text-xs text-[var(--text-secondary)]">
                                {Object.entries(responses).map(([code, response]: [string, any]) => {
                                  if (code === "200") return null;
                                  const desc = response?.description || "Error occurred";
                                  return (
                                    <div key={code} className="flex items-center gap-2">
                                      <span className="font-mono text-amber-400">{code}</span>
                                      <span>{desc}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Error Codes Reference */}
      <div className="mt-8 p-4 rounded-xl bg-[var(--bg-tertiary)]/30 border border-[var(--border-color)]">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2">
          <Info size={14} className="text-blue-400" />
          Error Codes Reference
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
          {[
            { code: "INVALID_API_KEY", desc: "API key not found or invalid" },
            { code: "API_KEY_EXPIRED", desc: "API key has expired" },
            { code: "API_KEY_INACTIVE", desc: "API key is not active" },
            { code: "INVALID_TIMESTAMP", desc: "Timestamp outside allowed window" },
            { code: "DUPLICATE_NONCE", desc: "Nonce already used (replay attack)" },
            { code: "INVALID_SIGNATURE", desc: "HMAC signature mismatch" },
            { code: "RATE_LIMIT_EXCEEDED", desc: "Too many requests" },
            { code: "PRODUCT_MISMATCH", desc: "License doesn't belong to product" },
            { code: "LICENSE_NOT_FOUND", desc: "License key not found" },
            { code: "LICENSE_EXPIRED", desc: "License has expired" },
            { code: "LICENSE_REVOKED", desc: "License has been revoked" },
            { code: "MAX_DEVICES_EXCEEDED", desc: "Device limit reached" },
          ].map((err) => (
            <div key={err.code} className="flex items-center gap-2 px-2 py-1 rounded bg-[var(--bg-tertiary)]/50 border border-[var(--border-color)]">
              <span className="font-mono text-amber-400">{err.code}</span>
              <span className="text-[var(--text-secondary)]">{err.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-xs text-[var(--text-secondary)] border-t border-[var(--border-color)] pt-4">
        <p>
          © {new Date().getFullYear()} Websmith Digital. All rights reserved.
        </p>
        <p className="mt-1">
          API v{contract.info.version} · OpenAPI v{contract.openapi}
        </p>
      </div>
    </div>
  );
}