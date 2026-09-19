"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { COUNTRY_CODES, CountryCode } from "@/lib/data/country-codes";
import { detectUserCountry } from "@/core/utils/countryDetection";
import { ChevronDown, Search, X } from "lucide-react";

export interface PhoneInputWithCountryProps {
  id?: string;
  name?: string;
  value: string;
  countryCode?: string;
  onCountryChange?: (country: CountryCode) => void;
  onChange: (phoneDigits: string, fullFormattedNumber: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  ariaLabel?: string;
  icon?: React.ReactNode;
}

export function PhoneInputWithCountry({
  id = "phone-input",
  name = "phone",
  value,
  countryCode,
  onCountryChange,
  onChange,
  placeholder = "Phone number",
  disabled = false,
  required = false,
  error,
  ariaLabel = "Phone number",
  icon,
}: PhoneInputWithCountryProps) {
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(() => {
    if (countryCode) {
      const match = COUNTRY_CODES.find((c) => c.code.toUpperCase() === countryCode.toUpperCase());
      if (match) return match;
    }
    return COUNTRY_CODES.find((c) => c.code === "IN") || COUNTRY_CODES[0];
  });

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-detect country code on initial client mount if not explicitly set
  useEffect(() => {
    if (!countryCode) {
      const detected = detectUserCountry(COUNTRY_CODES);
      setSelectedCountry(detected);
      if (onCountryChange) {
        onCountryChange(detected);
      }
    }
  }, [countryCode, onCountryChange]);

  // Sync if countryCode prop changes from outside
  useEffect(() => {
    if (countryCode && countryCode !== selectedCountry.code) {
      const match = COUNTRY_CODES.find((c) => c.code.toUpperCase() === countryCode.toUpperCase());
      if (match) {
        setSelectedCountry(match);
      }
    }
  }, [countryCode, selectedCountry.code]);

  // Handle outside click to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        setSearchQuery("");
      }
    }
    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      // Auto-focus search input when opening
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Filter countries by name, dial code, or ISO code
  const filteredCountries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return COUNTRY_CODES;
    return COUNTRY_CODES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dial.includes(q) ||
        c.code.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const handleSelectCountry = (country: CountryCode) => {
    setSelectedCountry(country);
    setIsDropdownOpen(false);
    setSearchQuery("");
    if (onCountryChange) {
      onCountryChange(country);
    }
    // Clean current value if it had the old dial code
    let cleanVal = (value || "").trim();
    if (cleanVal.startsWith(selectedCountry.dial)) {
      cleanVal = cleanVal.slice(selectedCountry.dial.length).trim();
    }
    const fullNumber = cleanVal ? `${country.dial} ${cleanVal}` : "";
    onChange(cleanVal, fullNumber);
  };

  // Strip dial code from input box so user only sees/types their local number
  const displayValue = useMemo(() => {
    let val = (value || "").trim();
    if (!val) return "";
    if (val.startsWith(selectedCountry.dial)) {
      val = val.slice(selectedCountry.dial.length).trim();
    } else if (val.startsWith("+")) {
      const matched = COUNTRY_CODES.find((c) => val.startsWith(c.dial));
      if (matched) {
        val = val.slice(matched.dial.length).trim();
      }
    }
    return val;
  }, [value, selectedCountry.dial]);

  const handlePhoneInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;
    // If user pasted a full international number with +, match and select country
    if (raw.startsWith("+")) {
      const matched = COUNTRY_CODES.find((c) => raw.startsWith(c.dial));
      if (matched) {
        setSelectedCountry(matched);
        if (onCountryChange) onCountryChange(matched);
        raw = raw.slice(matched.dial.length).trim();
      }
    }
    // Only allow digits, spaces, and hyphens in the local number
    const cleanDigits = raw.replace(/[^\d\s-]/g, "");
    const fullNumber = cleanDigits.trim() ? `${selectedCountry.dial} ${cleanDigits.trim()}` : "";
    onChange(cleanDigits, fullNumber);
  };

  return (
    <div style={{ position: "relative", width: "100%" }} ref={dropdownRef}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          width: "100%",
          backgroundColor: "var(--bg-secondary, #ffffff)",
          border: error ? "1.5px solid #ef4444" : "1px solid var(--border-color, #e2e8f0)",
          borderRadius: "10px",
          transition: "border-color 0.2s, box-shadow 0.2s",
          boxShadow: isDropdownOpen ? "0 0 0 3px rgba(0, 122, 255, 0.15)" : "none",
          opacity: disabled ? 0.65 : 1,
        }}
      >
        {/* Country Selector Button */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsDropdownOpen((prev) => !prev)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "10px 10px 10px 14px",
            background: "transparent",
            border: "none",
            borderRight: "1px solid var(--border-color, #e2e8f0)",
            cursor: disabled ? "not-allowed" : "pointer",
            color: "var(--text-primary, #1e293b)",
            fontSize: "14px",
            fontWeight: 500,
            whiteSpace: "nowrap",
            flexShrink: 0,
            userSelect: "none",
          }}
          title={`${selectedCountry.name} (${selectedCountry.dial})`}
          aria-haspopup="listbox"
          aria-expanded={isDropdownOpen}
        >
          <span style={{ fontSize: "18px", lineHeight: 1 }}>{selectedCountry.flag}</span>
          <span style={{ fontWeight: 600, color: "var(--text-primary, #0f172a)" }}>
            {selectedCountry.dial}
          </span>
          <ChevronDown
            size={14}
            style={{
              color: "var(--text-secondary, #64748b)",
              transform: isDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
            }}
          />
        </button>

        {/* Local Number Input */}
        <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center" }}>
          {icon && (
            <span
              style={{
                position: "absolute",
                left: "12px",
                display: "flex",
                alignItems: "center",
                color: "var(--text-secondary, #64748b)",
                pointerEvents: "none",
              }}
            >
              {icon}
            </span>
          )}
          <input
            id={id}
            name={name}
            type="tel"
            value={displayValue}
            disabled={disabled}
            required={required}
            maxLength={selectedCountry.maxDigits + 4}
            placeholder={placeholder}
            aria-label={ariaLabel}
            onChange={handlePhoneInputChange}
            style={{
              width: "100%",
              padding: icon ? "10px 14px 10px 36px" : "10px 14px",
              border: "none",
              outline: "none",
              backgroundColor: "transparent",
              color: "var(--text-primary, #1e293b)",
              fontSize: "14px",
              fontFamily: "inherit",
            }}
          />
        </div>
      </div>

      {/* Searchable Country Picker Dropdown */}
      {isDropdownOpen && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            width: "min(340px, 92vw)",
            maxHeight: "280px",
            backgroundColor: "var(--bg-primary, #ffffff)",
            border: "1px solid var(--border-color, #e2e8f0)",
            borderRadius: "12px",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.18)",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Search Box */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 12px",
              borderBottom: "1px solid var(--border-color, #e2e8f0)",
              backgroundColor: "var(--bg-secondary, #f8fafc)",
            }}
          >
            <Search size={14} style={{ color: "var(--text-secondary, #64748b)" }} />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search country or code..."
              style={{
                width: "100%",
                border: "none",
                outline: "none",
                backgroundColor: "transparent",
                color: "var(--text-primary, #1e293b)",
                fontSize: "13px",
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-secondary, #64748b)",
                  padding: 2,
                  display: "flex",
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* List of Countries */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "6px 0",
            }}
          >
            {filteredCountries.length === 0 ? (
              <div
                style={{
                  padding: "14px 16px",
                  fontSize: "13px",
                  color: "var(--text-secondary, #64748b)",
                  textAlign: "center",
                }}
              >
                No matching country found
              </div>
            ) : (
              filteredCountries.map((country) => {
                const isSelected = country.code === selectedCountry.code;
                return (
                  <button
                    key={`${country.code}-${country.dial}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelectCountry(country)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      width: "100%",
                      padding: "8px 14px",
                      background: isSelected ? "rgba(0, 122, 255, 0.08)" : "transparent",
                      border: "none",
                      cursor: "pointer",
                      textAlign: "left",
                      fontSize: "13px",
                      color: isSelected ? "#007AFF" : "var(--text-primary, #1e293b)",
                      fontWeight: isSelected ? 600 : 400,
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(0, 122, 255, 0.04)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                      <span style={{ fontSize: "16px", flexShrink: 0 }}>{country.flag}</span>
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {country.name}
                      </span>
                    </div>
                    <span
                      style={{
                        color: isSelected ? "#007AFF" : "var(--text-secondary, #64748b)",
                        fontFamily: "monospace",
                        fontSize: "12px",
                        marginLeft: "8px",
                        flexShrink: 0,
                      }}
                    >
                      {country.dial}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
