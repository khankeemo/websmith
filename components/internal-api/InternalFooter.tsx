// FILE: D:\websmith\components\internal-api\InternalFooter.tsx
// PURPOSE: Internal API Center subtle footer
// FIX: Removed all duplicate branding (logo, title, subtitle)
// FIX: Single-line layout with compact height
// FIX: Minimal border separation only
// FIX: Subtle typography that doesn't compete with content

"use client";

export default function InternalFooter() {
  return (
    <footer className="mt-8 pt-4 pb-4 border-t border-white/10">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
        {/* Left: Copyright */}
        <div className="text-xs text-slate-500">
          © 2026 Websmith Digital
        </div>

        {/* Right: Environment + Version */}
        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-400">Internal API Center</span>
          <span className="w-1 h-1 rounded-full bg-slate-600" />
          <span className="text-slate-400">Production</span>
          <span className="w-1 h-1 rounded-full bg-slate-600" />
          <span className="text-slate-500">v1.0</span>
        </div>
      </div>
    </footer>
  );
}