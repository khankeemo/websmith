// ============================================================
// GLOBAL LICENSE STATUS SERVICE  (Single Source of Truth)
// ============================================================
// THE one DB read that derives license/entitlement status used by
// Activation, Renewal, Validate and Renewal-Eligibility entry.
// Every entry route must call resolveGlobalLicenseStatus() and MUST
// NOT query the database or make a business decision on its own.
//
// Response contract (always returned):
//   httpStatus  -> proper HTTP code (200 allow, 4xx deny)
//   status      -> universal status (CANONICAL)
//   code        -> machine-readable code
//   reason      -> why inactive/revoked/expired/...
//   message     -> SDK display message
//   actions     -> allowed next actions for the SDK
// ============================================================

import { Pool } from 'pg';

export type UniversalEntryStatus =
  | 'NO_CUSTOMER'
  | 'TRIAL_ACTIVE'
  | 'TRIAL_EXPIRED'
  | 'ACTIVE'
  | 'INACTIVE'
  | 'REVOKED'
  | 'EXPIRED';

export type UniversalEntryCode =
  | 'CUSTOMER_NOT_FOUND'
  | 'TRIAL_ACTIVE'
  | 'TRIAL_EXPIRED'
  | 'LICENSE_ACTIVE'
  | 'LICENSE_INACTIVE'
  | 'LICENSE_REVOKED'
  | 'LICENSE_EXPIRED';

export interface UniversalVerdict {
  found: boolean;
  httpStatus: number;
  status: UniversalEntryStatus;
  code: UniversalEntryCode;
  reason: string;
  message: string;
  actions: string[];
}

export interface UniversalContext {
  license: any;
  trial: any;
  product: any;
  plan: any;
  customer: any;
  hardwareId?: string;
}

export interface UniversalResult {
  verdict: UniversalVerdict;
  ctx: UniversalContext | null;
  expiredAt?: Date | null;
  daysLeft: number;
}

const VERDICT_SPEC: Record<
  UniversalEntryStatus,
  { httpStatus: number; reason: string; message: string; actions: string[] }
> = {
  NO_CUSTOMER: {
    httpStatus: 404,
    reason: 'Customer not found.',
    message: 'No license or trial was found for this customer.',
    actions: ['register'],
  },
  TRIAL_ACTIVE: {
    httpStatus: 200,
    reason: 'Trial valid.',
    message: 'Trial is active and valid.',
    actions: ['use', 'activate'],
  },
  TRIAL_EXPIRED: {
    httpStatus: 409,
    reason: 'Trial expired.',
    message: 'Your trial has expired. Purchase a license to continue.',
    actions: ['purchase', 'contact_support'],
  },
  ACTIVE: {
    httpStatus: 200,
    reason: 'License valid.',
    message: 'License verified successfully.',
    actions: ['activate', 'use', 'renew'],
  },
  INACTIVE: {
    httpStatus: 403,
    reason: 'License inactive.',
    message: 'This license is inactive. Please contact support.',
    actions: ['contact_support'],
  },
  REVOKED: {
    httpStatus: 403,
    reason: 'License revoked.',
    message: 'This license has been revoked. Please contact support.',
    actions: ['contact_support'],
  },
  EXPIRED: {
    httpStatus: 409,
    reason: 'License expired.',
    message: 'Your license has expired. You can renew it.',
    actions: ['renew'],
  },
};

// Pure derivation from already-loaded rows (no DB here).
export function deriveUniversalVerdict(
  license: any | null,
  trial: any | null,
  now: Date = new Date(),
): { verdict: UniversalVerdict; expiredAt?: Date | null; daysLeft: number } {
  if (license) {
    const dbStatus = (license.status || '').toLowerCase();
    const isDeleted = !!license.deleted_at;
    const expiryDate = license.expiry_date ? new Date(license.expiry_date) : null;
    const isTrial = !!license.is_trial;
    const daysLeft = expiryDate
      ? Math.max(0, Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    let status: UniversalEntryStatus;
    if (isDeleted || dbStatus === 'deleted' || dbStatus === 'revoked') {
      status = 'REVOKED';
    } else if (dbStatus === 'inactive' || dbStatus === 'disabled' || dbStatus === 'suspended') {
      status = 'INACTIVE';
    } else if (expiryDate && expiryDate < now) {
      status = 'EXPIRED';
    } else if (isTrial) {
      status = 'TRIAL_ACTIVE';
    } else {
      status = 'ACTIVE';
    }

    const code = deriveCode(status, isTrial);
    const spec = VERDICT_SPEC[status];
    return {
      verdict: {
        found: true,
        httpStatus: spec.httpStatus,
        status,
        code,
        reason: spec.reason,
        message: spec.message,
        actions: spec.actions,
      },
      expiredAt: expiryDate && expiryDate < now ? expiryDate : null,
      daysLeft,
    };
  }

  if (trial) {
    const expiryDate = trial.expiry_date ? new Date(trial.expiry_date) : null;
    const isExpired = trial.status === 'expired' || (expiryDate ? expiryDate <= now : false);
    const status: UniversalEntryStatus = isExpired ? 'TRIAL_EXPIRED' : 'TRIAL_ACTIVE';
    const spec = VERDICT_SPEC[status];
    return {
      verdict: {
        found: true,
        httpStatus: spec.httpStatus,
        status,
        code: isExpired ? 'TRIAL_EXPIRED' : 'TRIAL_ACTIVE',
        reason: spec.reason,
        message: spec.message,
        actions: spec.actions,
      },
      expiredAt: isExpired ? expiryDate : null,
      daysLeft: isExpired
        ? 0
        : expiryDate
        ? Math.max(0, Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : 0,
    };
  }

  const spec = VERDICT_SPEC.NO_CUSTOMER;
  return {
    verdict: {
      found: false,
      httpStatus: spec.httpStatus,
      status: 'NO_CUSTOMER',
      code: 'CUSTOMER_NOT_FOUND',
      reason: spec.reason,
      message: spec.message,
      actions: spec.actions,
    },
    expiredAt: null,
    daysLeft: 0,
  };
}

function deriveCode(status: UniversalEntryStatus, isTrial: boolean): UniversalEntryCode {
  switch (status) {
    case 'NO_CUSTOMER':
      return 'CUSTOMER_NOT_FOUND';
    case 'TRIAL_ACTIVE':
      return 'TRIAL_ACTIVE';
    case 'TRIAL_EXPIRED':
      return 'TRIAL_EXPIRED';
    case 'ACTIVE':
      return isTrial ? 'TRIAL_ACTIVE' : 'LICENSE_ACTIVE';
    case 'INACTIVE':
      return 'LICENSE_INACTIVE';
    case 'REVOKED':
      return 'LICENSE_REVOKED';
    case 'EXPIRED':
      return isTrial ? 'TRIAL_EXPIRED' : 'LICENSE_EXPIRED';
  }
}

// THE single DB read. Looks up licence by key (or trail by hardware),
// joins product/plan/customer, derives the verdict, returns context.
// @param lookup.license_key OR lookup.hardwareId is required.
export async function resolveGlobalLicenseStatus(
  pool: Pool,
  lookup: { licenseKey?: string; hardwareId?: string },
  now: Date = new Date(),
): Promise<UniversalResult> {
  const client = await pool.connect();
  try {
    let license = null as any;
    let trial = null as any;
    let licenseKey = lookup.licenseKey;

    // Resolve license key by hardware_id if hardware-only lookup.
    if (!licenseKey && lookup.hardwareId) {
      const act = await client.query(
        `SELECT a.license_key FROM activations a
         WHERE a.hardware_id = $1 AND a.is_active = true
         LIMIT 1`,
        [lookup.hardwareId],
      );
      licenseKey = act.rows[0]?.license_key || null;
    }

    if (licenseKey) {
      const lr = await client.query(
        `SELECT l.*, p.name as product_name, p.is_active as product_is_active, p.is_deleted as product_is_deleted,
                pl.name as plan_name, pl.max_devices as plan_max_devices, pl.is_active as plan_is_active,
                c.name as customer_name_from_customer, c.email as customer_email_from_customer, c.phone as customer_phone_c
         FROM licenses l
         LEFT JOIN products p ON l.product_id = p.product_id
         LEFT JOIN plans pl ON l.plan_id = pl.id OR (l.plan = pl.name AND l.product_id = pl.product_id)
         LEFT JOIN customers c ON LOWER(l.customer_email) = LOWER(c.email)
         WHERE UPPER(l.license_key) = UPPER($1)
         LIMIT 1`,
        [licenseKey],
      );
      if (lr.rows.length > 0) license = lr.rows[0];
    }

    // Trial lookup by hardware when no license resolved.
    if (!license && lookup.hardwareId) {
      const tr = await client.query(
        `SELECT t.*, p.name as product_name, pl.name as plan_name, pl.max_devices as plan_max_devices
         FROM trials t
         LEFT JOIN products p ON t.product_id = p.product_id
         LEFT JOIN plans pl ON t.plan_id = pl.id
         WHERE t.hardware_id = $1
         ORDER BY t.started_at DESC LIMIT 1`,
        [lookup.hardwareId],
      );
      if (tr.rows.length > 0) trial = tr.rows[0];
    }

    const derived = deriveUniversalVerdict(license, trial, now);
    const ctx = license || trial
      ? {
          license,
          trial,
          product: license || trial,
          plan: license || trial,
          customer: license || trial,
          hardwareId: lookup.hardwareId,
        }
      : null;

    return { ...derived, ctx };
  } finally {
    client.release();
  }
}

export type NormalizedStatus =
  | 'trial'
  | 'licensed'
  | 'expired'
  | 'revoked'
  | 'suspended'
  | 'disabled'
  | 'inactive'
  | 'deleted'
  | 'unlicensed'
  | 'force_reactivation';

export interface NormalizedLicenseResponse {
  success: boolean;
  status: NormalizedStatus;
  license?: {
    license_key: string;
    plan: string;
    expiry_date: string;
    max_devices: number;
    device_count: number;
    is_trial: boolean;
    duration_days?: number;
    created_at?: string;
    activated_at?: string;
  };
  customer?: {
    name: string;
    email: string;
    phone: string;
    mobile: string;
  };
  plan?: {
    name: string;
  };
  hardware?: {
    hardware_id: string;
    is_activated: boolean;
    device_name?: string;
  };
  trial?: {
    has_trial: boolean;
    days_left: number;
    expiry_date: string;
    status: string;
    started_at?: string;
    customer_name?: string;
    customer_email?: string;
  };
  message: string;
}

export function computeNormalizedStatus(
  dbStatus: string,
  expiryDate: string | Date | null,
  isDeleted: boolean,
  isTrial: boolean,
  isHardwareActivated: boolean,
  hasActiveLicenseOnOtherDevice: boolean,
): NormalizedStatus {
  if (isDeleted) return 'deleted';
  if (dbStatus === 'deleted') return 'deleted';

  const now = new Date();
  const expiry = expiryDate ? new Date(expiryDate) : null;

  if (dbStatus === 'revoked') return 'revoked';
  if (dbStatus === 'suspended') return 'suspended';
  if (dbStatus === 'disabled') return 'disabled';
  if (dbStatus === 'inactive') return 'inactive';

  if (expiry && expiry < now) return 'expired';

  if (isTrial && dbStatus === 'active') return 'trial';

  if (dbStatus === 'active' && isHardwareActivated) return 'licensed';
  if (dbStatus === 'active' && !isHardwareActivated && hasActiveLicenseOnOtherDevice) return 'force_reactivation';
  if (dbStatus === 'active') return 'licensed';

  return 'unlicensed';
}

export function buildLicenseResponse(
  licenseRow: any,
  hardwareId?: string,
  isHardwareActivated?: boolean,
  hasActiveLicenseOnOtherDevice?: boolean,
): NormalizedLicenseResponse {
  const now = new Date();
  const expiryDate = licenseRow?.expiry_date || null;
  const dbStatus = licenseRow?.status || '';
  const isDeleted = !!licenseRow?.deleted_at;
  const isTrial = !!licenseRow?.is_trial;

  const status = computeNormalizedStatus(
    dbStatus,
    expiryDate,
    isDeleted,
    isTrial,
    isHardwareActivated || false,
    hasActiveLicenseOnOtherDevice || false,
  );

  const daysLeft = expiryDate
    ? Math.max(0, Math.ceil((new Date(expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  return {
    success: true,
    status,
    license: licenseRow
      ? {
          license_key: licenseRow.license_key || '',
          plan: licenseRow.plan || '',
          expiry_date: expiryDate ? String(expiryDate).split('T')[0] : '',
          max_devices: licenseRow.max_devices || 0,
          device_count: licenseRow.device_count || 0,
          is_trial: isTrial,
          duration_days: licenseRow.duration_days,
          created_at: licenseRow.created_at,
          activated_at: licenseRow.activated_at,
        }
      : undefined,
    customer: licenseRow
      ? {
          name: licenseRow.customer_name || '',
          email: licenseRow.customer_email || '',
          phone: licenseRow.customer_phone || licenseRow.customer_mobile || '',
          mobile: licenseRow.customer_mobile || licenseRow.customer_phone || '',
        }
      : undefined,
    plan: licenseRow?.plan
      ? {
          name: licenseRow.plan,
        }
      : undefined,
    hardware: hardwareId
      ? {
          hardware_id: hardwareId,
          is_activated: isHardwareActivated || false,
        }
      : undefined,
    trial: undefined,
    message: buildStatusMessage(status),
  };
}

export function buildTrialResponse(
  trialRow: any,
  daysLeft: number,
  hardwareId: string,
): NormalizedLicenseResponse {
  const isActive = trialRow?.status === 'active' && daysLeft > 0;

  return {
    success: true,
    status: isActive ? 'trial' : 'unlicensed',
    trial: {
      has_trial: !!trialRow,
      days_left: daysLeft,
      expiry_date: trialRow?.expiry_date || '',
      status: trialRow?.status || 'none',
      started_at: trialRow?.started_at,
      customer_name: trialRow?.customer_name,
      customer_email: trialRow?.customer_email,
    },
    message: isActive
      ? `Trial active with ${daysLeft} days remaining`
      : trialRow && trialRow.status === 'expired'
      ? 'Trial has expired'
      : 'No trial found',
  };
}

export function buildNoLicenseResponse(
  hardwareId?: string,
  message?: string,
): NormalizedLicenseResponse {
  return {
    success: true,
    status: 'unlicensed',
    message: message || 'No license or trial found for this hardware',
    hardware: hardwareId
      ? {
          hardware_id: hardwareId,
          is_activated: false,
        }
      : undefined,
  };
}

export function buildErrorResponse(
  status: NormalizedStatus,
  errorCode: string,
  errorMessage: string,
  inactiveReason?: string,
): { success: false; status: NormalizedStatus; error: { code: string; message: string; inactive_reason?: string } } {
  return {
    success: false,
    status,
    error: {
      code: errorCode,
      message: errorMessage,
      inactive_reason: inactiveReason,
    },
  };
}

function buildStatusMessage(status: NormalizedStatus): string {
  switch (status) {
    case 'licensed':
      return 'License is active and valid';
    case 'trial':
      return 'Trial is active';
    case 'expired':
      return 'License has expired';
    case 'revoked':
      return 'License has been revoked';
    case 'suspended':
      return 'License is suspended';
    case 'disabled':
      return 'License is disabled';
    case 'inactive':
      return 'License is inactive — activate to use';
    case 'deleted':
      return 'License has been deleted';
    case 'force_reactivation':
      return 'License requires reactivation — contact support';
    case 'unlicensed':
    default:
      return 'No valid license found';
  }
}