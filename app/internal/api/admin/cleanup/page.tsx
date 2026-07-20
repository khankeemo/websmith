"use client";

import { useState, useEffect } from "react";

export default function DatabaseCleanupPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const API_BASE = "/internal/backend";

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/cleanup`);
        const data = await res.json();
        if (data.success) setStats(data);
      } catch {}
      setLoading(false);
    };
    fetchStats();
  }, []);

  const runCleanup = async () => {
    if (!confirmed) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/admin/cleanup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wipe_all: true }),
      });
      const data = await res.json();
      if (data.success) setResult(data);
      else setError(data.error || "Cleanup failed");
    } catch {
      setError("Failed to run cleanup");
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Loading stats...</div>;

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Database Cleanup</h1>

      {stats && (
        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6 space-y-3">
          <h2 className="text-lg font-semibold">Records to Clean</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 rounded-lg bg-gray-700/30">
              <div className="text-2xl font-bold text-red-400">{stats.customers}</div>
              <div className="text-xs text-gray-400">Customers</div>
            </div>
            <div className="p-3 rounded-lg bg-gray-700/30">
              <div className="text-2xl font-bold text-red-400">{stats.licenses}</div>
              <div className="text-xs text-gray-400">Licenses</div>
            </div>
            <div className="p-3 rounded-lg bg-gray-700/30">
              <div className="text-2xl font-bold text-red-400">{stats.trials}</div>
              <div className="text-xs text-gray-400">Trials</div>
            </div>
          </div>
          <p className="text-xs text-gray-500">All records will be deleted</p>
        </div>
      )}

      {!confirmed ? (
        <button
          onClick={() => setConfirmed(true)}
          className="w-full px-4 py-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 font-medium hover:bg-red-500/30 transition-all"
        >
          I Confirm — Delete All Records
        </button>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            ⚠️ This will permanently delete all customers and all their associated
            records (licenses, trials, orders, etc.).
            This action cannot be undone.
          </div>
          <button
            onClick={runCleanup}
            disabled={running}
            className="w-full px-4 py-3 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 transition-all disabled:opacity-50"
          >
            {running ? "Running Cleanup..." : "Execute Permanent Cleanup"}
          </button>
          <button
            onClick={() => setConfirmed(false)}
            disabled={running}
            className="w-full px-4 py-2 rounded-xl border border-gray-700 text-gray-400 hover:bg-gray-800 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">{error}</div>
      )}

      {result && (
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
          <p className="text-green-400 font-medium">{result.message}</p>
          <p className="text-sm text-gray-400 mt-1">Customers deleted: {result.total_customers_deleted}</p>
        </div>
      )}
    </div>
  );
}
