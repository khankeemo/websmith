import { COUNTRY_CODES, CountryCode } from "@/lib/data/country-codes";

/**
 * Mapping of common IANA timezone prefixes / names to ISO 3166-1 alpha-2 country codes.
 */
const TIMEZONE_TO_COUNTRY: Record<string, string> = {
  // Asia
  "Asia/Kolkata": "IN",
  "Asia/Calcutta": "IN",
  "Asia/Dubai": "AE",
  "Asia/Dhaka": "BD",
  "Asia/Shanghai": "CN",
  "Asia/Chongqing": "CN",
  "Asia/Hong_Kong": "HK",
  "Asia/Jakarta": "ID",
  "Asia/Tehran": "IR",
  "Asia/Baghdad": "IQ",
  "Asia/Jerusalem": "IL",
  "Asia/Tokyo": "JP",
  "Asia/Amman": "JO",
  "Asia/Kuwait": "KW",
  "Asia/Kuala_Lumpur": "MY",
  "Asia/Kathmandu": "NP",
  "Asia/Muscat": "OM",
  "Asia/Karachi": "PK",
  "Asia/Manila": "PH",
  "Asia/Qatar": "QA",
  "Asia/Riyadh": "SA",
  "Asia/Singapore": "SG",
  "Asia/Seoul": "KR",
  "Asia/Colombo": "LK",
  "Asia/Bangkok": "TH",
  "Asia/Taipei": "TW",
  "Asia/Ho_Chi_Minh": "VN",
  "Indian/Maldives": "MV",

  // Europe
  "Europe/London": "GB",
  "Europe/Belfast": "GB",
  "Europe/Vienna": "AT",
  "Europe/Brussels": "BE",
  "Europe/Sofia": "BG",
  "Europe/Zagreb": "HR",
  "Europe/Nicosia": "CY",
  "Europe/Prague": "CZ",
  "Europe/Copenhagen": "DK",
  "Europe/Helsinki": "FI",
  "Europe/Paris": "FR",
  "Europe/Berlin": "DE",
  "Europe/Athens": "GR",
  "Europe/Budapest": "HU",
  "Atlantic/Reykjavik": "IS",
  "Europe/Dublin": "IE",
  "Europe/Rome": "IT",
  "Europe/Amsterdam": "NL",
  "Europe/Oslo": "NO",
  "Europe/Warsaw": "PL",
  "Europe/Lisbon": "PT",
  "Europe/Bucharest": "RO",
  "Europe/Moscow": "RU",
  "Europe/Madrid": "ES",
  "Europe/Stockholm": "SE",
  "Europe/Zurich": "CH",
  "Europe/Istanbul": "TR",
  "Europe/Kyiv": "UA",

  // Americas
  "America/New_York": "US",
  "America/Chicago": "US",
  "America/Denver": "US",
  "America/Los_Angeles": "US",
  "America/Phoenix": "US",
  "America/Anchorage": "US",
  "America/Honolulu": "US",
  "America/Toronto": "CA",
  "America/Vancouver": "CA",
  "America/Montreal": "CA",
  "America/Edmonton": "CA",
  "America/Winnipeg": "CA",
  "America/Halifax": "CA",
  "America/Argentina/Buenos_Aires": "AR",
  "America/Sao_Paulo": "BR",
  "America/Bogota": "CO",
  "America/Mexico_City": "MX",

  // Oceania
  "Australia/Sydney": "AU",
  "Australia/Melbourne": "AU",
  "Australia/Brisbane": "AU",
  "Australia/Perth": "AU",
  "Australia/Adelaide": "AU",
  "Pacific/Auckland": "NZ",

  // Africa
  "Africa/Cairo": "EG",
  "Africa/Nairobi": "KE",
  "Africa/Casablanca": "MA",
  "Africa/Lagos": "NG",
  "Africa/Johannesburg": "ZA",
};

/**
 * Automatically detect user's country code based on:
 * 1. Intl timezone
 * 2. Navigator locale
 * 3. Fallback to India (IN) or first country
 */
export function detectUserCountry(countryList: CountryCode[] = COUNTRY_CODES): CountryCode {
  const fallback = countryList.find((c) => c.code === "IN") || countryList[0];

  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    // 1. Check IANA timezone
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timeZone && TIMEZONE_TO_COUNTRY[timeZone]) {
      const code = TIMEZONE_TO_COUNTRY[timeZone];
      const match = countryList.find((c) => c.code.toUpperCase() === code.toUpperCase());
      if (match) return match;
    }

    // 2. Check navigator language region code (e.g., 'en-US' -> 'US', 'en-IN' -> 'IN')
    const languages = navigator.languages || [navigator.language];
    for (const lang of languages) {
      if (!lang) continue;
      const parts = lang.split("-");
      if (parts.length >= 2) {
        const region = parts[1].toUpperCase();
        const match = countryList.find((c) => c.code.toUpperCase() === region);
        if (match) return match;
      }
    }
  } catch {
    // Silently fall back to default
  }

  return fallback;
}
