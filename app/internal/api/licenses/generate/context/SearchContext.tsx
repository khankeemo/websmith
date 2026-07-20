// FILE: app/internal/api/licenses/generate/context/SearchContext.tsx
// PURPOSE: Shared search state for all tabs in License Operations Center
// RULE: UI only - NO database queries, NO business logic

"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

// ============================================================
// TYPES
// ============================================================

interface SearchFilters {
  searchQuery: string;
  filterStatus: string;
  filterProduct: string;
  filterPlan: string;
  includeDeleted: boolean;
  dateFrom: string;
  dateTo: string;
}

interface SearchContextType {
  // Search state
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filters: SearchFilters;
  setFilters: (filters: Partial<SearchFilters>) => void;
  resetFilters: () => void;
  
  // Search results
  searchResults: any[];
  setSearchResults: (results: any[]) => void;
  isSearching: boolean;
  setIsSearching: (isSearching: boolean) => void;
  
  // Search execution
  performSearch: (tab?: string) => Promise<void>;
  
  // Current tab
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

// ============================================================
// DEFAULT STATE
// ============================================================

const defaultFilters: SearchFilters = {
  searchQuery: '',
  filterStatus: 'all',
  filterProduct: '',
  filterPlan: '',
  includeDeleted: false,
  dateFrom: '',
  dateTo: '',
};

const defaultContext: SearchContextType = {
  searchQuery: '',
  setSearchQuery: () => {},
  filters: defaultFilters,
  setFilters: () => {},
  resetFilters: () => {},
  searchResults: [],
  setSearchResults: () => {},
  isSearching: false,
  setIsSearching: () => {},
  performSearch: async () => {},
  currentTab: 'manager',
  setCurrentTab: () => {},
};

// ============================================================
// CONTEXT
// ============================================================

const SearchContext = createContext<SearchContextType>(defaultContext);

export function useSearch() {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
}

// ============================================================
// DEBOUNCE HELPER
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
// PROVIDER
// ============================================================

interface SearchProviderProps {
  children: ReactNode;
  apiBase?: string;
}

export function SearchProvider({ children, apiBase = '/internal/backend' }: SearchProviderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFiltersState] = useState<SearchFilters>(defaultFilters);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentTab, setCurrentTab] = useState('manager');

  // ============================================================
  // UPDATE FILTERS
  // ============================================================
  const setFilters = useCallback((newFilters: Partial<SearchFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
  }, []);

  // ============================================================
  // RESET FILTERS
  // ============================================================
  const resetFilters = useCallback(() => {
    setFiltersState(defaultFilters);
    setSearchQuery('');
    setSearchResults([]);
  }, []);

  // ============================================================
  // PERFORM SEARCH - Works across all tabs
  // ============================================================
  const performSearch = useCallback(async (tab?: string) => {
    const targetTab = tab || currentTab;
    
    // Don't search if query is empty and no filters are applied
    if (!searchQuery && !filters.filterStatus && !filters.filterProduct && !filters.filterPlan && !filters.dateFrom && !filters.dateTo) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    try {
      let url = '';
      let response;

      // ============================================================
      // TAB 1: GENERATE - No search needed
      // ============================================================
      if (targetTab === 'generate') {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      // ============================================================
      // TAB 2: LICENSE MANAGER - Search using /licenses endpoint
      // ============================================================
      if (targetTab === 'manager') {
        const params = new URLSearchParams();
        if (searchQuery) params.append('search', searchQuery);
        if (filters.filterStatus !== 'all') params.append('status', filters.filterStatus);
        if (filters.filterProduct) params.append('product', filters.filterProduct);
        if (filters.filterPlan) params.append('plan', filters.filterPlan);
        if (filters.includeDeleted) params.append('include_deleted', 'true');
        if (filters.dateFrom) params.append('date_from', filters.dateFrom);
        if (filters.dateTo) params.append('date_to', filters.dateTo);
        params.append('limit', '100');
        params.append('offset', '0');

        url = `${apiBase}/licenses?${params.toString()}`;
        response = await fetch(url);
        const data = await response.json();
        setSearchResults(data.success ? data.data || [] : []);
      }

      // ============================================================
      // TAB 3: VALIDATION - Search by license key
      // ============================================================
      else if (targetTab === 'validation') {
        if (searchQuery && searchQuery.trim()) {
          // Check if it looks like a license key
          const isLicenseKey = searchQuery.includes('-') || searchQuery.length > 10;
          
          if (isLicenseKey) {
            url = `${apiBase}/admin/search/license?license_key=${encodeURIComponent(searchQuery)}`;
            response = await fetch(url);
            const data = await response.json();
            setSearchResults(data.success ? [data] : []);
          } else {
            // Search by email or name
            url = `${apiBase}/admin/search/email?email=${encodeURIComponent(searchQuery)}`;
            response = await fetch(url);
            const data = await response.json();
            setSearchResults(data.success ? data.licenses || [] : []);
          }
        } else {
          setSearchResults([]);
        }
      }

      // ============================================================
      // TAB 4: RENEWALS - Search renewable licenses
      // ============================================================
      else if (targetTab === 'renewals') {
        const params = new URLSearchParams();
        if (searchQuery) params.append('search', searchQuery);
        if (filters.filterStatus !== 'all') params.append('status', filters.filterStatus);
        if (filters.filterProduct) params.append('product', filters.filterProduct);
        if (filters.filterPlan) params.append('plan', filters.filterPlan);
        params.append('limit', '100');
        params.append('offset', '0');

        url = `${apiBase}/licenses?${params.toString()}`;
        response = await fetch(url);
        const data = await response.json();
        // Filter only renewable licenses (active or expired)
        const allLicenses = data.success ? data.data || [] : [];
        const renewable = allLicenses.filter(
          (l: any) => l.status === 'active' || l.status === 'expired'
        );
        setSearchResults(renewable);
      }

      // ============================================================
      // TAB 5: TRIALS - Search trials
      // ============================================================
      else if (targetTab === 'trials') {
        url = `${apiBase}/trials`;
        response = await fetch(url);
        const data = await response.json();
        let trials = data.success ? data.trials || [] : [];
        
        // Filter trials by search query
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          trials = trials.filter((t: any) => 
            t.hardware_id?.toLowerCase().includes(query) ||
            t.status?.toLowerCase().includes(query)
          );
        }
        setSearchResults(trials);
      }

      // ============================================================
      // TAB 6: BULK - No search needed
      // ============================================================
      else if (targetTab === 'bulk') {
        setSearchResults([]);
      }

      // ============================================================
      // TAB 7: HARDWARE - Search hardware
      // ============================================================
      else if (targetTab === 'hardware') {
        url = `${apiBase}/hardware`;
        response = await fetch(url);
        const data = await response.json();
        let hardware = data.success ? data.data || [] : [];
        
        // Filter hardware by search query
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          hardware = hardware.filter((h: any) => 
            h.hardware_id?.toLowerCase().includes(query) ||
            h.device_name?.toLowerCase().includes(query) ||
            h.license_key?.toLowerCase().includes(query)
          );
        }
        setSearchResults(hardware);
      }

      // ============================================================
      // TAB 8: LOGS - Search logs
      // ============================================================
      else if (targetTab === 'logs') {
        url = `${apiBase}/logs?limit=100`;
        response = await fetch(url);
        const data = await response.json();
        let logs = data.success ? data.data || [] : [];
        
        // Filter logs by search query
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          logs = logs.filter((l: any) => 
            l.message?.toLowerCase().includes(query) ||
            l.event_type?.toLowerCase().includes(query) ||
            l.license_key?.toLowerCase().includes(query)
          );
        }
        setSearchResults(logs);
      }

    } catch (error) {
      console.error(`Search error in tab ${targetTab}:`, error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, filters, currentTab, apiBase]);

  // ============================================================
  // AUTO-SEARCH ON QUERY CHANGE (Debounced)
  // ============================================================
  const debouncedSearch = useCallback(
    debounce((tab?: string) => {
      performSearch(tab);
    }, 500),
    [performSearch]
  );

  // Trigger search when searchQuery changes
  useEffect(() => {
    if (searchQuery) {
      debouncedSearch(currentTab);
    } else {
      // If search is cleared, reset results
      setSearchResults([]);
      setIsSearching(false);
    }
  }, [searchQuery, currentTab]);

  const value: SearchContextType = {
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    resetFilters,
    searchResults,
    setSearchResults,
    isSearching,
    setIsSearching,
    performSearch,
    currentTab,
    setCurrentTab,
  };

  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  );
}