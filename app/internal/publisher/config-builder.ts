/**
 * ---------------------------------------------------------
 * Websmith Universal License API Center V1
 * File: app/internal/publisher/config-builder.ts
 * Purpose: Builds rich api-config.json from PublisherContext
 * Author: Websmith
 *
 * HMAC SIGNING CONTRACT
 * =====================
 * All endpoints under /api/v1/ REQUIRE HMAC-SHA256 signatures:
 *
 *   POST /api/v1/license      — validate, activate, deactivate, renew
 *   POST /api/v1/trial        — start, status, convert
 *   POST /api/v1/device       — bind, replace, reset
 *   POST /api/v1/auth/otp/*   — send, verify
 *   POST /api/v1/customer/*   — register
 *   GET  /api/v1/countries    — country list
 *   GET  /api/v1/status       — health check
 *
 * Signing algorithm (matches backend lib/public-api/signature.ts):
 *   1. SHA-256 of JSON body (no sort_keys, insertion order preserved)
 *   2. Message = "{method}\n{path}\n{query}\n{body_hash}\n{timestamp}\n{nonce}"
 *   3. HMAC-SHA256(secret, message) → base64-encoded
 *   4. Headers: x-api-key, x-timestamp (ISO 8601 UTC), x-nonce (UUID v4), x-signature
 *
 * Public endpoints (NO signing required):
 *   None currently. All v1 endpoints enforce HMAC.
 *
 * The api_secret field is NO LONGER INCLUDED in generated SDK configs.
 * The client signs using the public_key (API key) as the HMAC secret.
 * The server verifies using the same API key as the secret.
 * This avoids shipping a separate signing secret to the client.
 *
 * CONFIGURATION SOURCE OF TRUTH:
 * - Environment variables take precedence (WEBSMITH_*)
 * - Product data from validator provides product-specific values
 * - Plan data from validator provides pricing/trial data
 * - Documented defaults (DEFAULTS) are used ONLY when environment
 *   and product data do not provide a value
 *
 * REPOSITORY EVIDENCE (2026-06-27):
 * - Product schema confirmed from app/internal/backend/admin/products/route.ts
 * - Plans schema confirmed from app/internal/backend/admin/products/[id]/plans/route.ts
 * - No existing config builder found - this is the canonical implementation
 *
 * DESIGN DECISIONS:
 * - DEFAULTS is the single source of truth for all Publisher defaults
 * - Environment variables allow runtime configuration without code changes
 * - Product data overrides defaults when available
 * - API URL is REQUIRED - no fallback to prevent silent misconfiguration
 * - Trial configuration derived from plans (is_trial_plan flag)
 * - Max devices derived from highest plan's max_devices
 *
 * CONFIGURATION SOURCES (in priority order):
 * 1. Environment variables (WEBSMITH_*)
 * 2. Product data (from validator)
 * 3. Plan data (from validator)
 * 4. Documented defaults (DEFAULTS)
 * ---------------------------------------------------------
 */

import type { PublisherContext, ProductData, PlanData } from './index';

/**
 * Configuration defaults - explicitly documented
 * These are the source of truth for all Publisher defaults
 * They must be kept in sync with docs/system-map/ARCHITECTURE.md
 */
const DEFAULTS = {
  product: {
    version: '1.0.0'
  },
  api: {
    timeout: 30000,
    retry_count: 3,
    version: 'v1'
  },
  trial: {
    days: 7,
    require_email: true,
    require_company: false,
    auto_convert: false
  },
  license: {
    enabled: true,
    hardware_binding: true,
    max_devices: 1,
    offline_days: 0,
    renewal_reminder_days: 7
  },
  hardware: {
    fingerprint: {
      include_cpu: true,
      include_motherboard: true,
      include_mac: true,
      include_os: true,
      hash_algorithm: 'sha256'
    },
    replacement: {
      enabled: true,
      require_approval: false,
      max_replacements_per_year: 2
    }
  },
  offline: {
    enabled: true,
    encryption: 'AES-256-GCM',
    validate_on_reconnect: true,
    cache_days: 7
  },
  security: {
    hmac_algorithm: 'SHA256',
    timestamp_window: 300,
    require_nonce: true,
    rate_limit: {
      requests_per_minute: 100,
      requests_per_hour: 1000
    }
  },
  branding: {
    company_name: '',
    logo_url: '/assets/logo.svg',
    primary_color: '#6366f1',
    secondary_color: '#4f46e5',
    accent_color: '#8b5cf6',
    support_email: 'support@websmithdigital.com',
    support_url: '',
    labels: {
      activation_title: 'Activate License',
      renew_title: 'Renew License',
      replace_title: 'Replace Device',
      activate_btn: 'Activate',
      renew_btn: 'Renew',
      replace_btn: 'Replace Device',
      cancel_btn: 'Cancel',
      refresh_btn: 'Refresh',
      send_otp_btn: 'Send OTP',
      verify_otp_btn: 'Verify OTP',
      start_trial_btn: 'Start Trial',
      activate_license_btn: 'Activate License',
      status_label: 'Status',
      product_label: 'Product',
      version_label: 'Version',
      plan_label: 'Plan',
      expiry_label: 'Expiry',
      remaining_days_label: 'Remaining days',
      hardware_id_label: 'Hardware ID',
      device_name_label: 'Device Name',
      device_usage_label: 'Device usage',
      runtime_label: 'Runtime',
      sdk_version_label: 'SDK Version',
      old_hardware_label: 'Old Hardware',
      new_hardware_label: 'New Hardware',
      customer_info_section: 'Customer Information',
      product_details_section: 'Product Details',
      hardware_section: 'Hardware',
      license_key_section: 'License Key',
      license_info_section: 'License Info',
      current_license_section: 'Current License',
      available_plans_section: 'Available Plans',
      license_status_section: 'License Status',
      device_replace_section: 'Device Replacement',
      device_replace_desc: 'Move your license from old device to this one.',
      enter_otp_label: 'Enter OTP',
      need_license_label: 'Need a license?',
      mobile_label: 'Mobile Number',
      unknown_device: 'Unknown',
      new_device: 'New Device',
      no_license_text: 'No license',
      trial_active_text: 'Trial Active',
      licensed_text: 'Licensed',
      unlicensed_status: 'Unlicensed',
      no_active_text: 'No active license or trial',
      checking_status: 'Checking...',
      runtime_value: 'Python',
      hardware_placeholder: '--',
      expiry_na: 'N/A',
      plan_na: 'N/A',
    },
    colors: {
      primary: '#6366f1',
      secondary: '#4f46e5',
      accent: '#8b5cf6',
      success: '#16a34a',
      warning: '#f59e0b',
      error: '#dc2626',
      info: '#10b981',
      gray: '#6b7280',
      bg_page: '#f8f9fa',
      bg_card: '#ffffff',
      bg_button: '#e5e7eb',
      text_primary: '#333333',
      text_secondary: '#555555',
      text_muted: '#888888',
      text_dark: '#666666',
    }
  },
  ui: {
    theme: 'auto',
    language: 'en',
    position: 'center',
    modal: true,
    animations: true,
    dialogs: {
      trial: true,
      activation: true,
      renewal: true,
      expired: true,
      offline: true,
      hardware_change: true
    }
  },
  features: {
    trial: true,
    license: true,
    hardware_binding: true,
    offline_mode: true,
    renewals: true,
    analytics: true,
    audit_logs: true
  }
} as const;

/**
 * Nested configuration interfaces for maintainability
 */
export interface ProductConfig {
  id: string;
  name: string;
  version: string;
  description?: string;
}

export interface ApiSettings {
  url: string;
  version: string;
  public_key: string;
  secret?: string;
  timeout: number;
  retry_count: number;
}

export interface StoreConfig {
  url: string;
  buy_url: string;
  renew_url: string;
}

export interface TrialConfig {
  enabled: boolean;
  days: number;
  require_email: boolean;
  require_company: boolean;
  auto_convert: boolean;
  message: string;
}

export interface LicenseConfig {
  enabled: boolean;
  hardware_binding: boolean;
  max_devices: number;
  offline_days: number;
  renewal_reminder_days: number;
}

export interface HardwareConfig {
  fingerprint: {
    include_cpu: boolean;
    include_motherboard: boolean;
    include_mac: boolean;
    include_os: boolean;
    hash_algorithm: string;
  };
  replacement: {
    enabled: boolean;
    require_approval: boolean;
    max_replacements_per_year: number;
  };
}

export interface OfflineConfig {
  enabled: boolean;
  cache_days: number;
  encryption: string;
  validate_on_reconnect: boolean;
}

export interface SecurityConfig {
  hmac_algorithm: string;
  timestamp_window: number;
  require_nonce: boolean;
  rate_limit: {
    requests_per_minute: number;
    requests_per_hour: number;
  };
}

export interface BrandingConfig {
  company_name: string;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  support_email?: string;  // ✅ Made optional
  support_url?: string;   // ✅ Made optional
  labels?: Record<string, string>;  // Customizable UI labels
  colors?: Record<string, string>;  // Customizable UI colors
}

export interface UiConfig {
  theme: string;
  language: string;
  position: string;
  modal: boolean;
  animations: boolean;
  dialogs: {
    trial: boolean;
    activation: boolean;
    renewal: boolean;
    expired: boolean;
    offline: boolean;
    hardware_change: boolean;
  };
}

export interface FeaturesConfig {
  trial: boolean;
  license: boolean;
  hardware_binding: boolean;
  offline_mode: boolean;
  renewals: boolean;
  analytics: boolean;
  audit_logs: boolean;
}

export interface ApiConfig {
  product: ProductConfig;
  api: ApiSettings;
  store: StoreConfig;
  trial: TrialConfig;
  license: LicenseConfig;
  hardware: HardwareConfig;
  offline: OfflineConfig;
  security: SecurityConfig;
  branding: BrandingConfig;
  ui: UiConfig;
  features: FeaturesConfig;
}

export class ConfigBuilder {
  /**
   * Build rich api-config.json from PublisherContext
   * This is the ONLY component that builds configuration
   *
   * Configuration Sources (in priority order):
   * 1. Environment variables (WEBSMITH_*)
   * 2. Product data (from validator)
   * 3. Plan data (from validator)
   * 4. Documented defaults (DEFAULTS)
   */
  build(context: PublisherContext): ApiConfig {
    const { product, plans, apiKey } = context;

    // Determine trial configuration: context override (from sdk_runtime_settings) → product.trial_enabled → defaults
    const hasTrial = context.trialDays != null ? (context.trialDays > 0) : product.trial_enabled;
    const trialDays = context.trialDays ?? product.trial_days ?? DEFAULTS.trial.days;

    // Get max devices from context (sdk_runtime_settings) → plans → defaults
    const maxDevices = context.maxDevices ?? this.getMaxDevices(plans);

    // Get offline grace days from context (sdk_runtime_settings) → env → defaults
    const offlineDays = context.offlineGraceDays ?? this.getEnvNumber('WEBSMITH_OFFLINE_DAYS', DEFAULTS.license.offline_days);

    // Get cache days from context (sdk_runtime_settings) → env → defaults
    const cacheDays = context.cacheDays ?? this.getEnvNumber('WEBSMITH_CACHE_DAYS', DEFAULTS.offline.cache_days);

    // Get trial message from context (sdk_runtime_settings) → generic fallback
    const trialMessage = context.trialMessage || this.getTrialMessage(trialDays);

    // Get company name from product or environment or defaults
    const companyName = this.getCompanyName(product);

    // API base URL is the single source of truth for the app origin
    const apiUrl = this.getApiUrl();

    return {
      product: {
        id: product.id,
        name: product.name,
        version: product.version,
        description: product.description
      },
api: {
        url: apiUrl,
        version: DEFAULTS.api.version,
        public_key: apiKey,
        timeout: this.getEnvNumber('WEBSMITH_API_TIMEOUT', DEFAULTS.api.timeout),
        retry_count: this.getEnvNumber('WEBSMITH_API_RETRY_COUNT', DEFAULTS.api.retry_count)
      },
      store: {
        url: this.getAppRoute(apiUrl, '/software-store'),
        buy_url: this.getAppRoute(apiUrl, '/internal/api/buy'),
        renew_url: this.getAppRoute(apiUrl, '/internal/api/renew')
      },
      trial: {
        enabled: hasTrial,
        days: trialDays,
        require_email: context.emailVerification !== false,
        require_company: DEFAULTS.trial.require_company,
        auto_convert: context.allowConversion !== false,
        message: trialMessage
      },
      license: {
        enabled: DEFAULTS.license.enabled,
        hardware_binding: DEFAULTS.license.hardware_binding,
        max_devices: maxDevices,
        offline_days: offlineDays,
        renewal_reminder_days: this.getEnvNumber(
          'WEBSMITH_RENEWAL_REMINDER_DAYS',
          DEFAULTS.license.renewal_reminder_days
        )
      },
      hardware: DEFAULTS.hardware,
      offline: {
        enabled: DEFAULTS.offline.enabled,
        cache_days: cacheDays,
        encryption: DEFAULTS.offline.encryption,
        validate_on_reconnect: DEFAULTS.offline.validate_on_reconnect
      },
      security: {
        hmac_algorithm: DEFAULTS.security.hmac_algorithm,
        timestamp_window: this.getEnvNumber('WEBSMITH_TIMESTAMP_WINDOW', DEFAULTS.security.timestamp_window),
        require_nonce: DEFAULTS.security.require_nonce,
        rate_limit: {
          requests_per_minute: this.getEnvNumber('WEBSMITH_RATE_LIMIT_MINUTE', DEFAULTS.security.rate_limit.requests_per_minute),
          requests_per_hour: this.getEnvNumber('WEBSMITH_RATE_LIMIT_HOUR', DEFAULTS.security.rate_limit.requests_per_hour)
        }
      },
      branding: {
        company_name: companyName,
        logo_url: this.getEnvString('WEBSMITH_LOGO_URL', DEFAULTS.branding.logo_url),
        primary_color: this.getEnvString('WEBSMITH_PRIMARY_COLOR', DEFAULTS.branding.primary_color),
        secondary_color: this.getEnvString('WEBSMITH_SECONDARY_COLOR', DEFAULTS.branding.secondary_color),
        accent_color: this.getEnvString('WEBSMITH_ACCENT_COLOR', DEFAULTS.branding.accent_color),
        // ✅ Context override → product → env → DEFAULTS
        support_email: context.supportEmail ?? ((product as any).support_email || this.getEnvString('WEBSMITH_SUPPORT_EMAIL', DEFAULTS.branding.support_email)),
        // ✅ SAFE: Check if product.support_url exists, fallback to env or empty string
        support_url: (product as any).support_url || this.getEnvString('WEBSMITH_SUPPORT_URL', DEFAULTS.branding.support_url),
        // ✅ UI labels with DEFAULTS (publishers can override in product data or env)
        labels: {
          ...DEFAULTS.branding.labels,
          ...((product as any).labels || {})
        },
        // ✅ UI colors from DEFAULTS (publishers can override in product data or env)
        colors: {
          ...DEFAULTS.branding.colors,
          ...((product as any).colors || {})
        }
      },
      ui: DEFAULTS.ui,
      features: DEFAULTS.features
    };
  }

  /**
   * Get maximum devices from available plans
   * Behavior: highest plan's max_devices defines the system maximum
   * If no plans exist, returns DEFAULTS.license.max_devices
   * This is documented in the Publisher architecture
   */
  private getMaxDevices(plans: PlanData[]): number {
    if (!plans || plans.length === 0) {
      return DEFAULTS.license.max_devices;
    }
    const max = Math.max(...plans.map(p => p.max_devices || 1));
    return max > 0 ? max : DEFAULTS.license.max_devices;
  }

  /**
   * Get generic trial message - no product name (comes from DB or generic default)
   */
  private getTrialMessage(days: number): string {
    return `Start your ${days}-day free trial. No credit card required.`;
  }

  /**
   * Get company name from product, environment, or defaults
   */
  private getCompanyName(product: ProductData): string {
    if (product.company_name) return product.company_name;
    const envName = process.env.WEBSMITH_COMPANY_NAME;
    if (envName) return envName;
    return DEFAULTS.branding.company_name;
  }

  /**
   * Get API URL from environment - REQUIRED
   * Throws if not configured to prevent silent misconfiguration
   */
  private getApiUrl(): string {
    const url = process.env.WEBSMITH_API_URL || process.env.NEXT_PUBLIC_API_URL;
    if (!url) {
      throw new Error(
        'WEBSMITH_API_URL or NEXT_PUBLIC_API_URL environment variable is required for Publisher'
      );
    }
    return url;
  }

  /**
   * Derive an application route on the same origin as the configured API base
   * URL, so portal/store URLs are never hardcoded or left empty. The SDK
   * storefront, Buy portal and Renew portal are served by the same Next.js app.
   */
  private getAppRoute(baseUrl: string, routePath: string): string {
    const origin = baseUrl.replace(/\/+$/, '');
    return `${origin}/${routePath.replace(/^\/+/, '')}`;
  }

  /**
   * Get environment variable with fallback
   * Logs warning if parsing fails
   * Note: console.warn is used as no shared logger abstraction exists in the API Center
   */
  private getEnvNumber(key: string, fallback: number): number {
    const value = process.env[key];
    if (value === undefined) return fallback;
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      console.warn(`[ConfigBuilder] Invalid number for ${key}: "${value}", using fallback ${fallback}`);
      return fallback;
    }
    return parsed;
  }

  /**
   * Get environment string with fallback
   */
  private getEnvString(key: string, fallback: string): string {
    const value = process.env[key];
    return value !== undefined ? value : fallback;
  }
}