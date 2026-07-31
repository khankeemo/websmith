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