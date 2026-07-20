// FILE: app/internal/api/licenses/generate/tabs/BulkOperationsTab.tsx
// PURPOSE: Tab 6 - Bulk Operations
// SCOPE: Import and export licenses in bulk via CSV
// RULE: UI only - NO database queries, NO business logic
// RULE: Theme variables only - NO hardcoded colors

"use client";

import { useState } from "react";
import {
  Upload,
  Download,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

// ============================================================
// BULK OPERATIONS TAB
// ============================================================

export function BulkOperationsTab() {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const [exporting, setExporting] = useState(false);

  const API_BASE = "/internal/backend";

  // ============================================================
  // HANDLE FILE CHANGE
  // ============================================================
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCsvFile(e.target.files[0]);
      setResult(null);
    }
  };

  // ============================================================
  // HANDLE IMPORT
  // ============================================================
  const handleImport = async () => {
    if (!csvFile) return;

    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", csvFile);

      const response = await fetch(`${API_BASE}/admin/licenses/bulk-import`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        setResult({
          success: data.success_count || 0,
          failed: data.failed_count || 0,
          errors: data.errors || [],
        });
        setCsvFile(null);
        // Reset file input
        const fileInput = document.getElementById("csv-upload") as HTMLInputElement;
        if (fileInput) fileInput.value = "";
      } else {
        setResult({
          success: 0,
          failed: 1,
          errors: [data.error || "Import failed"],
        });
      }
    } catch (err) {
      setResult({
        success: 0,
        failed: 1,
        errors: ["Failed to import. Please try again."],
      });
    } finally {
      setUploading(false);
    }
  };

  // ============================================================
  // HANDLE EXPORT
  // ============================================================
  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await fetch(`${API_BASE}/licenses/export?format=csv`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `licenses_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to export licenses");
    } finally {
      setExporting(false);
    }
  };

  // ============================================================
  // HANDLE DOWNLOAD TEMPLATE
  // ============================================================
  const handleDownloadTemplate = () => {
    const template =
      "license_key,product_id,customer_name,customer_email,plan,expiry_days\n,,,,";
    const blob = new Blob([template], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "license_template.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Import Card */}
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-6 backdrop-blur-sm hover:border-[var(--api-blue-500-20)] transition-all">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-[var(--api-blue-500-10)]">
              <Upload className="h-5 w-5 text-[var(--api-blue-400)]" />
            </div>
            <h3 className="font-semibold text-[var(--text-primary)]">Import Licenses</h3>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <input
                id="csv-upload"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="w-full px-4 py-3 rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-tertiary)]/20 text-sm text-[var(--text-secondary)] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[var(--bg-tertiary)]/30 file:text-[var(--text-primary)] hover:file:bg-[var(--bg-tertiary)]/50 transition-all cursor-pointer"
              />
              <p className="text-xs text-[var(--text-muted)] mt-2">
                CSV format: license_key, product_id, customer_name, customer_email, plan, expiry_days
              </p>
            </div>

            {csvFile && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--api-green-500-5)] border border-[var(--api-green-500-20)]">
                <CheckCircle className="h-4 w-4 text-[var(--api-green-400)]" />
                <span className="text-sm text-[var(--text-secondary)]">{csvFile.name}</span>
                <span className="text-xs text-[var(--text-muted)]">
                  ({(csvFile.size / 1024).toFixed(1)} KB)
                </span>
              </div>
            )}

            <button
              onClick={handleImport}
              disabled={!csvFile || uploading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-[var(--text-primary)] font-medium hover:shadow-lg hover:shadow-blue-500/20 transition-all disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                "Import Licenses"
              )}
            </button>
          </div>
        </div>

        {/* Export Card */}
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/10 p-6 backdrop-blur-sm hover:border-[var(--api-green-500-20)] transition-all">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-[var(--api-green-500-10)]">
              <Download className="h-5 w-5 text-[var(--api-green-400)]" />
            </div>
            <h3 className="font-semibold text-[var(--text-primary)]">Export Licenses</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <AlertCircle className="h-4 w-4 text-[var(--api-amber-400)]" />
              <span>Export all licenses as CSV file</span>
            </div>

            <button
              onClick={handleExport}
              disabled={exporting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-[var(--text-primary)] font-medium hover:shadow-lg hover:shadow-green-500/20 transition-all disabled:opacity-50"
            >
              {exporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download size={16} />
                  Export All Licenses
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div
          className={`rounded-2xl border p-4 animate-in fade-in slide-in-from-top-2 ${
            result.failed === 0
              ? "border-[var(--api-green-500-20)] bg-[var(--api-green-500-5)]"
              : "border-[var(--api-amber-500-20)] bg-[var(--api-amber-500-5)]"
          }`}
        >
          <div className="flex items-center gap-3">
            {result.failed === 0 ? (
              <CheckCircle className="h-5 w-5 text-[var(--api-green-400)]" />
            ) : (
              <AlertCircle className="h-5 w-5 text-[var(--api-amber-400)]" />
            )}
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {result.success} imported successfully
                {result.failed > 0 && `, ${result.failed} failed`}
              </p>
              {result.errors.length > 0 && (
                <div className="mt-1 text-xs text-[var(--api-red-400)] space-y-1">
                  {result.errors.slice(0, 3).map((err, i) => (
                    <p key={i}>• {err}</p>
                  ))}
                  {result.errors.length > 3 && (
                    <p>+{result.errors.length - 3} more errors</p>
                  )}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => setResult(null)}
            className="mt-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Template Download */}
      <div className="text-center text-xs text-[var(--text-muted)]">
        <p>CSV Template:</p>
        <code className="block mt-1 p-2 rounded-lg bg-[var(--bg-tertiary)]/20 font-mono text-[var(--text-secondary)]">
          license_key, product_id, customer_name, customer_email, plan, expiry_days
        </code>
        <button
          className="mt-2 text-[var(--api-blue-400)] hover:underline"
          onClick={handleDownloadTemplate}
        >
          Download Template CSV
        </button>
      </div>
    </div>
  );
}