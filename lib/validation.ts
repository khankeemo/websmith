// FILE: lib/validation.ts
// PURPOSE: Universal email & mobile validation used by every internal API screen.
// SCOPE: Welcome/Trial, Generate License, Activation, Renewal, Customer forms.
// RULE: Single source of truth - no duplicate validation logic anywhere.

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test((email || "").trim());
}

export interface MobileRuleCountry {
  minDigits?: number | null;
  maxDigits?: number | null;
}

export interface MobileValidationResult {
  valid: boolean;
  error: string;
}

/**
 * Validate a mobile number (digits only, excluding the country dial code)
 * against the selected country's rule from the API/config.
 * A country without published rules imposes no digit-length constraint.
 */
export function mobileDigitsError(country: MobileRuleCountry | null | undefined, digits: string): string {
  const value = (digits || "").replace(/\s/g, "");
  if (!value) {
    return "";
  }
  if (!/^\d+$/.test(value)) {
    return "Mobile number must contain digits only.";
  }
  if (!country) {
    return "";
  }
  const min = country.minDigits;
  const max = country.maxDigits;
  if (typeof min === "number" && typeof max === "number") {
    if (min === max && value.length !== min) {
      return `Mobile number must be exactly ${min} digits.`;
    }
    if (value.length < min) {
      return `Mobile number must be at least ${min} digits.`;
    }
    if (value.length > max) {
      return `Mobile number must be at most ${max} digits.`;
    }
  }
  return "";
}

export function isValidMobile(country: MobileRuleCountry | null | undefined, digits: string): boolean {
  const value = (digits || "").replace(/\s/g, "");
  return value.length > 0 && mobileDigitsError(country, value) === "";
}
