// FILE: app/api/v1/checkout/address/route.ts
// PURPOSE: API-assisted smart address lookup for the Software Store checkout.
//          Given a country + postal code, returns State / District / City /
//          Locality / Area / Region so the customer never types them manually.
//          All returned fields remain editable on the client.
// PROVIDERS (real services, no fake data):
//   - India  -> India Post Pincode API (https://api.postalpincode.in)
//   - Global -> Zippopotam.us (https://api.zippopotam.us) — 40+ countries
//   - Anything else -> { supported: false } and the customer enters manually.
// ACCESS: Public (software store checkout)

import { NextRequest, NextResponse } from "next/server";

const ADDRESS_LOOKUP_TIMEOUT_MS = 8000;

// Zippopotam covers these countries (ISO-2). Anything else is "unsupported".
const ZIPPOPOTAM_COUNTRIES = new Set([
  "AD", "AR", "AS", "AT", "AU", "BD", "BE", "BG", "BM", "BR", "BS", "CA",
  "CH", "CO", "CR", "CY", "CZ", "DE", "DK", "DO", "DZ", "EC", "EE", "ES",
  "FI", "FO", "FR", "GB", "GF", "GG", "GL", "GP", "GT", "GU", "HR", "HU",
  "IE", "IM", "IS", "IT", "JE", "JP", "LI", "LK", "LT", "LU", "MC", "MD",
  "MH", "MK", "MQ", "MT", "MX", "MY", "NO", "NZ", "PH", "PK", "PL", "PM",
  "PR", "PT", "PW", "RE", "SE", "SI", "SK", "SM", "TH", "TR", "US", "VI",
  "YT", "ZA",
]);

function cleanInput(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 40);
}

function postcodeDigits(value: string): string {
  return String(value ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .slice(0, 12);
}

async function fetchWithTimeout(url: string): Promise<Response> {
  return fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(ADDRESS_LOOKUP_TIMEOUT_MS),
  });
}

// ------------------------------------------------------------
// India Post provider — richest detail for Indian addresses
// ------------------------------------------------------------
async function lookupIndia(postalCode: string) {
  const res = await fetchWithTimeout(
    `https://api.postalpincode.in/pincode/${encodeURIComponent(postalCode)}`
  );
  const payload = (await res.json().catch(() => null)) as
    | Array<{ Status: string; Message: string; PostOffice: Array<Record<string, any>> | null }>
    | null;

  const entry = Array.isArray(payload) ? payload[0] : null;
  const offices = entry?.PostOffice;

  if (!entry || !Array.isArray(offices) || offices.length === 0) {
    return { found: false, error: "We couldn't find this postal code. Please check it and try again." };
  }

  const first = offices[0];
  // Keep the address tidy: dedupe repeated names (e.g. "Bengaluru" == District == City).
  const distinct = (value: string | null | undefined) => (value || "").trim();

  const district = distinct(first.District);
  const state = distinct(first.State);
  const taluk = distinct(first.Region) || distinct(first.Taluk) || distinct(first.Block);
  const locality = distinct(first.Name);
  const circle = distinct(first.Circle) || distinct(first.Division);

  return {
    found: true,
    data: {
      postal_code: postalCode,
      country_code: "IN",
      country: "India",
      state,
      state_code: null,
      district,
      city: district, // For India the district is the city-level unit
      locality,
      area: locality,
      region: taluk || circle,
      provider: "postalpincode",
    },
  };
}

// ------------------------------------------------------------
// Zippopotam provider — global coverage for international addresses
// ------------------------------------------------------------
async function lookupZippopotam(countryCode: string, postalCode: string) {
  if (!ZIPPOPOTAM_COUNTRIES.has(countryCode)) {
    return { supported: false, found: false };
  }

  const res = await fetchWithTimeout(
    `https://api.zippopotam.us/${encodeURIComponent(countryCode)}/${encodeURIComponent(postalCode)}`
  );

  if (res.status === 404 || res.status === 400) {
    return { supported: true, found: false, error: "We couldn't find this postal code. Please check it and try again." };
  }
  if (!res.ok) {
    return { supported: true, found: false, error: "Address lookup is temporarily unavailable. You can still enter your address manually." };
  }

  const payload = (await res.json().catch(() => null)) as {
    country?: string;
    "country abbreviation"?: string;
    places?: Array<{ "place name"?: string; state?: string; "state abbreviation"?: string; longitude?: string; latitude?: string }>;
  } | null;

  const place = payload?.places?.[0];
  if (!payload || !place) {
    return { supported: true, found: false, error: "We couldn't find this postal code. Please check it and try again." };
  }

  const city = (place["place name"] || "").trim();
  return {
    supported: true,
    found: true,
    data: {
      postal_code: postalCode,
      country_code: countryCode,
      country: payload.country || countryCode,
      state: (place.state || "").trim(),
      state_code: (place["state abbreviation"] || "").trim() || null,
      district: null,
      city,
      locality: city,
      area: null,
      region: null,
      provider: "zippopotam",
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
    }

    const country = cleanInput(body.country).toUpperCase().slice(0, 2);
    const postalCode = postcodeDigits(body.postalCode);

    if (!country) {
      return NextResponse.json({ success: false, error: "Please select your country first" }, { status: 400 });
    }
    if (!/^[A-Z]{2}$/.test(country)) {
      return NextResponse.json({ success: false, error: "Invalid country code" }, { status: 400 });
    }
    if (!postalCode) {
      return NextResponse.json({ success: false, error: "Please enter a postal code" }, { status: 400 });
    }

    let result;
    if (country === "IN") {
      result = await lookupIndia(postalCode);
    } else {
      result = await lookupZippopotam(country, postalCode);
    }

    if (result.found) {
      return NextResponse.json({ success: true, supported: true, data: result.data });
    }

    if (result.supported === false) {
      return NextResponse.json({
        success: true,
        supported: false,
        message: "Automatic address lookup is not available for this country. You can enter your address manually.",
      });
    }

    return NextResponse.json({ success: false, supported: true, error: result.error || "Address lookup failed" }, { status: 404 });
  } catch (error) {
    console.error("checkout address lookup error:", error);
    return NextResponse.json(
      { success: false, error: "Address lookup is temporarily unavailable. You can still enter your address manually." },
      { status: 500 }
    );
  }
}
