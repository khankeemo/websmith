// FILE: app/internal/api/licenses/generate/page.tsx
// PURPOSE: License Operations Center - Shell with Search Bar and Tabs
// SCOPE: Tab 1 - Generate License, Tab 2 - License Manager, Tab 3 - Validation Center,
//        Tab 4 - Renewals, Tab 5 - Bulk Operations
// RULE: UI only - NO database queries, NO business logic
// RULE: Theme variables only - NO hardcoded colors

"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  KeyRound,
  ShieldCheck,
  Repeat,
  Upload,
  Search,
  Loader2,
  X,
} from "lucide-react";

// ============================================================
// IMPORTS: All Tab Components
// ============================================================
import { GenerateLicenseTab } from "./tabs/GenerateLicenseTab";
import { LicenseManagerTab } from "./tabs/LicenseManagerTab";
import { ValidationCenterTab } from "./tabs/ValidationCenterTab";
import { RenewalsTab } from "./tabs/RenewalsTab";
import { BulkOperationsTab } from "./tabs/BulkOperationsTab";

// ============================================================
// IMPORTS: Context
// ============================================================
import { SearchProvider, useSearch } from "./context/SearchContext";

// ============================================================
// HELPER: Debounce function for search
// ============================================================
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// ============================================================
// TAB COMPONENT (UI only)
// ============================================================

interface TabProps {
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  badge?: number;
}

function Tab({ label, icon, isActive, onClick, badge }: TabProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap ${
        isActive
          ? "bg-blue-500/20 text-[var(--api-blue-400)] border border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.1)]"
          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]/30 border border-transparent"
      }`}
    >
      {icon}
      {label}
      {badge !== undefined && badge > 0 && (
        <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-blue-500/20 text-[var(--api-blue-400)]">
          {badge}
        </span>
      )}
    </button>
  );
}

// ============================================================
// MAIN PAGE (WRAPPED WITH SearchProvider)
// ============================================================

export default function LicenseCenterPage() {
  return (
    <SearchProvider>
      <LicenseCenterContent />
    </SearchProvider>
  );
}

// ============================================================
// LICENSE CENTER CONTENT (With Search)
// ============================================================

function LicenseCenterContent() {
  const [activeTab, setActiveTab] = useState(0);
  const [localSearch, setLocalSearch] = useState("");
  
  // Get search from context
  const { searchQuery, setSearchQuery, isSearching } = useSearch();

  // Sync local search with context
  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  // Handle search with debounce
  const handleSearchChange = debounce((value: string) => {
    setSearchQuery(value);
  }, 500);

  // ============================================================
  // TABS CONFIGURATION
  // ============================================================
  const tabs = [
    { label: "Generate", icon: <Plus size={16} />, component: GenerateLicenseTab },
    { label: "Manager", icon: <KeyRound size={16} />, component: LicenseManagerTab },
    { label: "Validation", icon: <ShieldCheck size={16} />, component: ValidationCenterTab },
    { label: "Renewals", icon: <Repeat size={16} />, component: RenewalsTab },
    { label: "Bulk", icon: <Upload size={16} />, component: BulkOperationsTab },
  ];

  const ActiveComponent = tabs[activeTab].component;

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="space-y-6">
      {/* Header with Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">License Operations Center</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Generate, manage, validate, and monitor licenses
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative min-w-[280px] sm:min-w-[320px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-secondary)] transition-colors duration-300" />
          <input
            type="text"
            placeholder="Search licenses, customers, products..."
            value={localSearch}
            onChange={(e) => {
              const value = e.target.value;
              setLocalSearch(value);
              handleSearchChange(value);
            }}
            className="w-full h-10 pl-9 pr-10 rounded-xl bg-[var(--bg-tertiary)]/20 border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] transition-all duration-300 focus:border-blue-500/50 focus:outline-none focus:ring-0 focus:bg-[var(--bg-tertiary)]/40 hover:bg-[var(--bg-tertiary)]/30 hover:border-[var(--border-color)] focus:shadow-[0_0_20px_rgba(59,130,246,0.06)]"
          />
          {/* Loading Spinner */}
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--api-blue-400)] animate-spin" />
          )}
          {/* Clear Button */}
          {localSearch && !isSearching && (
            <button
              onClick={() => {
                setLocalSearch("");
                setSearchQuery("");
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-[var(--bg-tertiary)]/50 transition-colors"
            >
              <X size={16} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-1 pb-2 scrollbar-thin scrollbar-thumb-[var(--border-color)] scrollbar-track-transparent">
        {tabs.map((tab, index) => (
          <Tab
            key={index}
            label={tab.label}
            icon={tab.icon}
            isActive={activeTab === index}
            onClick={() => setActiveTab(index)}
          />
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-4">
        <ActiveComponent />
      </div>
    </div>
  );
}