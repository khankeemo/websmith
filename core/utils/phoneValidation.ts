import { COUNTRY_CODES, CountryCode } from "@/lib/data/country-codes";

export interface PhoneValidationResult {
  valid: boolean;
  error?: string;
  cleanedDigits?: string;
}

/**
 * Validates a phone number against:
 * 1. Minimum and maximum digits based on country configuration (ITU-T E.164)
 * 2. Spam patterns (all identical digits, sequential numbers, excessive repetitions)
 * 3. Telecom sanity checks (e.g., Indian mobile numbers starting with 6-9, North America not starting with 0/1)
 */
export function validatePhoneNumber(
  phoneNumber: string,
  countryCode?: string
): PhoneValidationResult {
  if (!phoneNumber || !phoneNumber.trim()) {
    return { valid: true, cleanedDigits: "" };
  }

  // Find country if provided
  const country = countryCode
    ? COUNTRY_CODES.find((c) => c.code.toUpperCase() === countryCode.toUpperCase())
    : undefined;

  // Extract only the digits
  let rawDigits = phoneNumber.replace(/\D/g, "");

  // If the number was passed with country dial code attached, strip it for local validation
  if (country) {
    const dialDigits = country.dial.replace(/\D/g, "");
    if (rawDigits.startsWith(dialDigits) && rawDigits.length > dialDigits.length) {
      rawDigits = rawDigits.slice(dialDigits.length);
    }
  }

  // 1. Minimum length check
  const minDigits = country ? country.minDigits : 7;
  const maxDigits = country ? country.maxDigits : 15;

  if (rawDigits.length < minDigits) {
    return {
      valid: false,
      error: country
        ? `Phone number must contain at least ${minDigits} digits for ${country.name}.`
        : `Phone number is too short (minimum ${minDigits} digits).`,
    };
  }

  if (rawDigits.length > maxDigits) {
    return {
      valid: false,
      error: country
        ? `Phone number cannot exceed ${maxDigits} digits for ${country.name}.`
        : `Phone number is too long (maximum ${maxDigits} digits).`,
    };
  }

  // 2. Anti-Spam Check: All identical digits (e.g. 0000000000, 9999999999, 1111111111)
  if (/^(\d)\1+$/.test(rawDigits)) {
    return {
      valid: false,
      error: "Please enter a genuine phone number, not repeated digits.",
    };
  }

  // 3. Anti-Spam Check: Ascending or descending sequential digits (e.g. 1234567890, 0123456789, 9876543210)
  const sequences = [
    "0123456789",
    "1234567890",
    "9876543210",
    "8765432109",
    "12345678",
    "87654321",
  ];
  if (sequences.some((seq) => rawDigits.includes(seq))) {
    return {
      valid: false,
      error: "Sequential dummy numbers (e.g. 1234567890) are not allowed.",
    };
  }

  // 4. Anti-Spam Check: Highly repetitive short patterns (e.g. 1212121212, 1231231231, 9898989898)
  if (/^(\d{2})\1{3,}$/.test(rawDigits) || /^(\d{3})\1{2,}$/.test(rawDigits)) {
    return {
      valid: false,
      error: "Please enter a valid personal or business phone number.",
    };
  }

  // 5. Anti-Spam Check: Insufficient unique digits (e.g. 8888888881 has only 2 unique digits)
  const uniqueDigits = new Set(rawDigits.split(""));
  if (rawDigits.length >= 8 && uniqueDigits.size <= 2) {
    return {
      valid: false,
      error: "Phone number appears invalid or repetitive. Please enter a valid number.",
    };
  }

  // 6. Country-specific telecom sanity checks
  if (country?.code === "IN") {
    // In India, 10-digit mobile numbers start with 6, 7, 8, or 9
    const firstDigit = rawDigits[0];
    if (!["6", "7", "8", "9"].includes(firstDigit)) {
      return {
        valid: false,
        error: "Indian mobile numbers must begin with 6, 7, 8, or 9.",
      };
    }
  } else if (country?.code === "US" || country?.code === "CA") {
    // In NANP (US/Canada), area code (1st digit) cannot start with 0 or 1
    const firstDigit = rawDigits[0];
    if (firstDigit === "0" || firstDigit === "1") {
      return {
        valid: false,
        error: "Area code cannot begin with 0 or 1.",
      };
    }
  }

  return {
    valid: true,
    cleanedDigits: rawDigits,
  };
}
