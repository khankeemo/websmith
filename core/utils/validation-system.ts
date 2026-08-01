import { Pool } from 'pg';
import crypto from 'crypto';

// ============================================================
// TYPES
// ============================================================

export type LicenseStatus =
  | 'Pending'
  | 'Active'
  | 'Trial'
  | 'Expired'
  | 'Suspended'
  | 'Revoked'
  | 'Disabled'
  | 'Inactive'
  | 'Deleted'
  | 'Renewal Due';

export type LicenseInactiveReason =
  | 'Trial Expired'
  | 'Subscription Expired'
  | 'License Revoked'
  | 'License Deactivated'
  | 'Manual Deactivation'
  | 'License Deleted'
  | 'Product Archived'
  | 'Product Deleted'
  | 'Maximum Devices Reached'
  | 'Hardware Changed'
  | 'Validation Failed'
  | 'Payment Failed'
  | 'Renewal Required'
  | 'API Key Revoked'
  | 'Customer Disabled';

export const VALID_LICENSE_STATUSES: LicenseStatus[] = [
  'Pending', 'Active', 'Trial', 'Expired', 'Suspended', 'Revoked', 'Disabled', 'Inactive', 'Deleted', 'Renewal Due'
];

export const LICENSE_INACTIVE_REASONS: LicenseInactiveReason[] = [
  'Trial Expired', 'Subscription Expired', 'License Revoked', 'License Deactivated', 'Manual Deactivation', 'License Deleted',
  'Product Archived', 'Product Deleted', 'Maximum Devices Reached', 'Hardware Changed',
  'Validation Failed', 'Payment Failed', 'Renewal Required', 'API Key Revoked', 'Customer Disabled'
];

export const SUPPORTED_COUNTRIES = [
  'US', 'GB', 'CA', 'AU', 'DE', 'FR', 'ES', 'IT', 'NL', 'BE',
  'CH', 'AT', 'SE', 'NO', 'DK', 'FI', 'IE', 'PT', 'PL', 'CZ',
  'JP', 'CN', 'KR', 'SG', 'IN', 'BR', 'MX', 'AR', 'ZA', 'NG',
  'AE', 'SA', 'IL', 'TR', 'RU', 'UA', 'RO', 'HU', 'GR', 'NZ'
];

export const PRODUCT_TYPES = ['software', 'saas', 'api', 'sdk', 'plugin', 'theme', 'template', 'service', 'other'];

// ============================================================
// VALIDATION RESULT
// ============================================================

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  data?: any;
}

function success(data?: any): ValidationResult {
  return { valid: true, errors: [], data };
}

function failure(errors: ValidationError[]): ValidationResult {
  return { valid: false, errors };
}

function singleError(field: string, message: string): ValidationResult {
  return { valid: false, errors: [{ field, message }] };
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

export const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export const URL_REGEX = /^https?:\/\/([\w-]+\.)+[\w-]+(\/[\w\-./?%&=]*)?$/;

export const VERSION_REGEX = /^\d+(\.\d+){0,2}(-[a-zA-Z0-9.]+)?$/;

export const E164_PHONE_REGEX = /^\+[1-9]\d{6,14}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim().toLowerCase());
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-\(\)]/g, '');
}

export function isValidUrl(url: string): boolean {
  if (!url) return true;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function isValidVersion(version: string): boolean {
  return VERSION_REGEX.test(version);
}

export function isValidE164Phone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return E164_PHONE_REGEX.test(normalized);
}

export function generateLicenseKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let key = "";
  for (let i = 0; i < 24; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key.match(/.{1,4}/g)?.join("-") || key;
}

export function generateApiKey(): string {
  return `ws_${crypto.randomBytes(32).toString("hex")}`;
}

export function hashSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

export function computeLicenseStatus(
  status: string,
  expiryDate: string,
  isDeleted: boolean,
  isActive: boolean,
  isTrial: boolean,
  inactiveReason?: string | null
): LicenseStatus {
  if (isDeleted) return 'Deleted';
  if (status === 'deleted') return 'Deleted';
  if (inactiveReason === 'License Revoked') return 'Revoked';

  const now = new Date();
  const expiry = new Date(expiryDate);

  if (isTrial && expiry < now) return 'Expired';
  if (isTrial) return 'Trial';
  if (status === 'revoked') return 'Revoked';
  if (status === 'suspended') return 'Suspended';
  if (status === 'disabled') return 'Disabled';
  if (status === 'inactive') return 'Inactive';

  if (expiry < now) {
    const daysOverdue = Math.floor((now.getTime() - expiry.getTime()) / (1000 * 60 * 60 * 24));
    if (daysOverdue <= 30) return 'Renewal Due';
    return 'Expired';
  }

  if (status === 'active') return 'Active';
  if (status === 'pending') return 'Pending';

  return 'Active';
}

export function computeInactiveReason(
  license: any,
  product?: any
): LicenseInactiveReason | null {
  if (!license) return null;

  if (license.status === 'revoked') return 'License Revoked';
  if (license.deleted_at) return 'License Deleted';
  if (product && product.is_deleted) return 'Product Deleted';
  if (product && !product.is_active) return 'Product Archived';

  const now = new Date();
  const expiry = new Date(license.expiry_date);

  if (expiry < now) {
    if (license.is_trial) return 'Trial Expired';
    return 'Subscription Expired';
  }

  if (license.status === 'disabled') return 'Manual Deactivation';
  if (license.status === 'inactive') return license.inactive_reason || 'License Deactivated';
  if (license.device_count >= license.max_devices) return 'Maximum Devices Reached';
  if (license.inactive_reason) return license.inactive_reason as LicenseInactiveReason;

  return null;
}

// ============================================================
// CUSTOMER VALIDATION
// ============================================================

export function validateCustomerName(name: string): ValidationResult {
  if (!name || name.trim() === '') {
    return singleError('name', 'Customer name is required');
  }
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    return singleError('name', 'Customer name must be at least 2 characters');
  }
  if (trimmed.length > 200) {
    return singleError('name', 'Customer name must not exceed 200 characters');
  }
  return success(trimmed);
}

export function validateEmail(email: string, checkRFC: boolean = true): ValidationResult {
  if (!email || email.trim() === '') {
    return singleError('email', 'Email address is required');
  }
  const trimmed = email.trim();
  if (checkRFC && !EMAIL_REGEX.test(trimmed)) {
    return singleError('email', 'Invalid email address');
  }
  return success(normalizeEmail(trimmed));
}

export async function validateEmailUnique(
  pool: Pool,
  email: string,
  excludeEmail?: string
): Promise<ValidationResult> {
  const client = await pool.connect();
  try {
    const query = excludeEmail
      ? `SELECT email FROM customers WHERE email = $1 AND email != $2`
      : `SELECT email FROM customers WHERE email = $1`;
    const params = excludeEmail ? [normalizeEmail(email), normalizeEmail(excludeEmail)] : [normalizeEmail(email)];
    const result = await client.query(query, params);
    if (result.rows.length > 0) {
      return singleError('email', 'A customer with this email address already exists');
    }
    return success();
  } finally {
    client.release();
  }
}

export function validateMobile(mobile: string): ValidationResult {
  if (!mobile || mobile.trim() === '') {
    return singleError('mobile', 'Mobile number is required');
  }
  const normalized = normalizePhone(mobile.trim());
  if (normalized.length < 8) {
    return singleError('mobile', 'Mobile number is too short');
  }
  if (normalized.length > 16) {
    return singleError('mobile', 'Mobile number is too long');
  }
  if (!/^\+?\d+$/.test(normalized)) {
    return singleError('mobile', 'Mobile number must contain only digits and optional + prefix');
  }
  if (!normalized.startsWith('+')) {
    return singleError('mobile', 'Mobile number must include country code (e.g. +1XXXXXXXXXX)');
  }
  return success(normalized);
}

export function validateCompany(company: string): ValidationResult {
  if (!company || company.trim() === '') {
    return success(null);
  }
  const trimmed = company.trim();
  if (trimmed.length > 200) {
    return singleError('company', 'Company name must not exceed 200 characters');
  }
  return success(trimmed);
}

export function validateCountry(country: string): ValidationResult {
  if (!country || country.trim() === '') {
    return singleError('country', 'Country is required');
  }
  const code = country.trim().toUpperCase();
  if (code.length !== 2) {
    return singleError('country', 'Country must be a valid 2-letter ISO code');
  }
  if (!SUPPORTED_COUNTRIES.includes(code)) {
    return singleError('country', `Country "${code}" is not in the supported country list`);
  }
  return success(code);
}

export function validateNotes(notes: string): ValidationResult {
  if (!notes || notes.trim() === '') {
    return success(null);
  }
  if (notes.length > 5000) {
    return singleError('notes', 'Notes must not exceed 5000 characters');
  }
  return success(notes.trim());
}

export async function validateCustomerInput(
  pool: Pool,
  body: any,
  checkEmailUnique: boolean = true,
  excludeEmail?: string
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];

  const nameResult = validateCustomerName(body.name);
  if (!nameResult.valid) errors.push(...nameResult.errors);

  const emailResult = validateEmail(body.email);
  if (!emailResult.valid) errors.push(...emailResult.errors);

  if (body.mobile) {
    const mobileResult = validateMobile(body.mobile);
    if (!mobileResult.valid) errors.push(...mobileResult.errors);
  }

  if (body.company) {
    const companyResult = validateCompany(body.company);
    if (!companyResult.valid) errors.push(...companyResult.errors);
  }

  if (body.country) {
    const countryResult = validateCountry(body.country);
    if (!countryResult.valid) errors.push(...countryResult.errors);
  }

  if (body.notes) {
    const notesResult = validateNotes(body.notes);
    if (!notesResult.valid) errors.push(...notesResult.errors);
  }

  if (errors.length > 0) return failure(errors);

  if (checkEmailUnique) {
    const uniqueResult = await validateEmailUnique(pool, body.email, excludeEmail);
    if (!uniqueResult.valid) errors.push(...uniqueResult.errors);
  }

  if (errors.length > 0) return failure(errors);

  return success({
    name: nameResult.data,
    email: emailResult.data,
    mobile: body.mobile ? normalizePhone(body.mobile.trim()) : null,
    alternative_mobile: body.alternative_mobile ? normalizePhone(body.alternative_mobile.trim()) : null,
    company: body.company ? body.company.trim() : null,
    country: body.country ? body.country.trim().toUpperCase() : null,
    address_line1: body.address_line1 ? body.address_line1.trim() : null,
    address_line2: body.address_line2 ? body.address_line2.trim() : null,
    city: body.city ? body.city.trim() : null,
    state: body.state ? body.state.trim() : null,
    postal_code: body.postal_code ? body.postal_code.trim() : null,
    notes: body.notes ? body.notes.trim() : null
  });
}

// ============================================================
// PRODUCT VALIDATION
// ============================================================

export function validateProductName(name: string): ValidationResult {
  if (!name || name.trim() === '') {
    return singleError('name', 'Product name is required');
  }
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    return singleError('name', 'Product name must be at least 2 characters');
  }
  if (trimmed.length > 200) {
    return singleError('name', 'Product name must not exceed 200 characters');
  }
  return success(trimmed);
}

export function validateProductVersion(version: string): ValidationResult {
  if (!version || version.trim() === '') {
    return success('1.0.0');
  }
  const trimmed = version.trim();
  if (!VERSION_REGEX.test(trimmed)) {
    return singleError('version', 'Invalid version format. Use semantic versioning (e.g. 1.0.0)');
  }
  return success(trimmed);
}

export function validateProductUrl(url: string, fieldName: string, required: boolean = false): ValidationResult {
  if (!url || url.trim() === '') {
    if (required) return singleError(fieldName, `${fieldName} is required`);
    return success(null);
  }
  const trimmed = url.trim();
  if (!URL_REGEX.test(trimmed) && !trimmed.startsWith('http')) {
    return singleError(fieldName, `Invalid URL format for ${fieldName}`);
  }
  try {
    new URL(trimmed);
  } catch {
    return singleError(fieldName, `Invalid URL format for ${fieldName}`);
  }
  if (trimmed.length > 2000) {
    return singleError(fieldName, `${fieldName} must not exceed 2000 characters`);
  }
  return success(trimmed);
}

export function validateProductPrice(price: any): ValidationResult {
  const num = Number(price);
  if (isNaN(num)) {
    return singleError('price', 'Price must be a valid number');
  }
  if (num < 0) {
    return singleError('price', 'Price cannot be negative');
  }
  if (num > 999999999) {
    return singleError('price', 'Price is too large');
  }
  return success(num);
}

export function validateProductType(productType: string): ValidationResult {
  if (!productType || productType.trim() === '') {
    return success(null);
  }
  const trimmed = productType.trim().toLowerCase();
  if (!PRODUCT_TYPES.includes(trimmed)) {
    return singleError('product_type', `Invalid product type. Must be one of: ${PRODUCT_TYPES.join(', ')}`);
  }
  return success(trimmed);
}

export async function validateProductDuplicateName(
  pool: Pool,
  name: string,
  excludeId?: string
): Promise<ValidationResult> {
  const client = await pool.connect();
  try {
    const productId = 'prod_' + name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const query = excludeId
      ? `SELECT product_id FROM products WHERE product_id = $1 AND product_id != $2`
      : `SELECT product_id FROM products WHERE product_id = $1`;
    const params = excludeId ? [productId, excludeId] : [productId];
    const result = await client.query(query, params);
    if (result.rows.length > 0) {
      return singleError('name', `A product with this name already exists (ID: ${productId})`);
    }
    return success();
  } finally {
    client.release();
  }
}

export async function validateProductInput(
  pool: Pool,
  body: any,
  isUpdate: boolean = false,
  existingProductId?: string
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];

  const nameResult = validateProductName(body.name);
  if (!nameResult.valid) errors.push(...nameResult.errors);

  if (body.version !== undefined) {
    const versionResult = validateProductVersion(body.version);
    if (!versionResult.valid) errors.push(...versionResult.errors);
  }

  if (body.latest_version !== undefined) {
    const latestVersionResult = validateProductVersion(body.latest_version);
    if (!latestVersionResult.valid) errors.push(...latestVersionResult.errors);
  }

  if (body.website !== undefined) {
    const urlResult = validateProductUrl(body.website, 'website');
    if (!urlResult.valid) errors.push(...urlResult.errors);
  }

  if (body.docs_url !== undefined) {
    const urlResult = validateProductUrl(body.docs_url, 'Documentation URL');
    if (!urlResult.valid) errors.push(...urlResult.errors);
  }

  if (body.support_url !== undefined) {
    const urlResult = validateProductUrl(body.support_url, 'Support URL');
    if (!urlResult.valid) errors.push(...urlResult.errors);
  }

  if (body.price !== undefined) {
    const priceResult = validateProductPrice(body.price);
    if (!priceResult.valid) errors.push(...priceResult.errors);
  }

  if (body.product_type !== undefined) {
    const typeResult = validateProductType(body.product_type);
    if (!typeResult.valid) errors.push(...typeResult.errors);
  }

  if (errors.length > 0) return failure(errors);

  if (!isUpdate) {
    const duplicateResult = await validateProductDuplicateName(pool, body.name);
    if (!duplicateResult.valid) errors.push(...duplicateResult.errors);
  }

  if (errors.length > 0) return failure(errors);

  return success();
}

// ============================================================
// PLAN VALIDATION
// ============================================================

export function validatePlanName(name: string): ValidationResult {
  if (!name || name.trim() === '') {
    return singleError('name', 'Plan name is required');
  }
  const trimmed = name.trim();
  if (trimmed.length < 1) {
    return singleError('name', 'Plan name is required');
  }
  if (trimmed.length > 200) {
    return singleError('name', 'Plan name must not exceed 200 characters');
  }
  return success(trimmed);
}

export function validatePlanPrice(price: any, isTrial: boolean): ValidationResult {
  const num = Number(price);
  if (isNaN(num)) {
    return singleError('price', 'Price must be a valid number');
  }
  if (isTrial) {
    if (num !== 0) {
      return singleError('price', 'Trial plans must have a price of 0');
    }
    return success(0);
  }
  if (num <= 0) {
    return singleError('price', 'Paid plans must have a price greater than 0');
  }
  if (num > 999999999) {
    return singleError('price', 'Price is too large');
  }
  return success(num);
}

export function validatePlanDuration(duration: any): ValidationResult {
  const num = Number(duration);
  if (isNaN(num) || num <= 0) {
    return singleError('duration', 'Duration must be greater than 0');
  }
  if (num > 36500) {
    return singleError('duration', 'Duration must not exceed 36500 days (100 years)');
  }
  return success(num);
}

export function validatePlanTrialDays(trialDays: any, isTrial: boolean): ValidationResult {
  if (!isTrial) {
    if (trialDays === undefined || trialDays === null) return success(0);
    return success(Number(trialDays));
  }
  const num = Number(trialDays);
  if (isNaN(num) || num <= 0) {
    return singleError('trial_days', 'Trial plans must have trial days greater than 0');
  }
  if (num > 365) {
    return singleError('trial_days', 'Trial days must not exceed 365');
  }
  return success(num);
}

export function validatePlanMaxDevices(maxDevices: any): ValidationResult {
  const num = Number(maxDevices);
  if (isNaN(num) || num <= 0) {
    return singleError('max_devices', 'Max devices must be greater than 0');
  }
  if (num > 1000) {
    return singleError('max_devices', 'Max devices must not exceed 1000');
  }
  return success(num);
}

export function validatePlanDisplayOrder(order: any): ValidationResult {
  if (order === undefined || order === null) return success(0);
  const num = Number(order);
  if (isNaN(num) || num < 0) {
    return singleError('display_order', 'Display order must be a non-negative number');
  }
  return success(num);
}

export function validatePlanFeatures(features: any): ValidationResult {
  if (!features) return success([]);
  if (!Array.isArray(features)) {
    return singleError('features', 'Features must be an array');
  }
  return success(features);
}

export async function validatePlanDuplicateName(
  pool: Pool,
  productId: string,
  name: string,
  excludeId?: number
): Promise<ValidationResult> {
  const client = await pool.connect();
  try {
    let query = `SELECT id FROM plans WHERE product_id = $1 AND name = $2`;
    const params: any[] = [productId, name.trim()];
    if (excludeId) {
      query += ` AND id != $3`;
      params.push(excludeId);
    }
    const result = await client.query(query, params);
    if (result.rows.length > 0) {
      return singleError('name', `Plan "${name.trim()}" already exists for this product`);
    }
    return success();
  } finally {
    client.release();
  }
}

export async function validatePlanInput(
  pool: Pool,
  productId: string,
  body: any,
  isUpdate: boolean = false,
  excludeId?: number
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];

  const nameResult = validatePlanName(body.name);
  if (!nameResult.valid) errors.push(...nameResult.errors);

  const isTrial = body.is_trial_plan === true;

  const priceResult = validatePlanPrice(body.price, isTrial);
  if (!priceResult.valid) errors.push(...priceResult.errors);

  if (body.default_expiry_days !== undefined || body.duration_days !== undefined) {
    const durationResult = validatePlanDuration(body.default_expiry_days || body.duration_days);
    if (!durationResult.valid) errors.push(...durationResult.errors);
  }

  const trialDaysResult = validatePlanTrialDays(body.trial_days_limit, isTrial);
  if (!trialDaysResult.valid) errors.push(...trialDaysResult.errors);

  if (body.max_devices !== undefined) {
    const devicesResult = validatePlanMaxDevices(body.max_devices);
    if (!devicesResult.valid) errors.push(...devicesResult.errors);
  }

  if (body.display_order !== undefined) {
    const orderResult = validatePlanDisplayOrder(body.display_order);
    if (!orderResult.valid) errors.push(...orderResult.errors);
  }

  const featuresResult = validatePlanFeatures(body.features);
  if (!featuresResult.valid) errors.push(...featuresResult.errors);

  if (errors.length > 0) return failure(errors);

  if (!isUpdate || body.name) {
    const duplicateResult = await validatePlanDuplicateName(pool, productId, body.name, excludeId);
    if (!duplicateResult.valid) errors.push(...duplicateResult.errors);
  }

  if (errors.length > 0) return failure(errors);

  return success({
    name: nameResult.data,
    price: priceResult.data,
    is_trial_plan: isTrial,
    trial_days_limit: trialDaysResult.data,
    max_devices: body.max_devices !== undefined ? validatePlanMaxDevices(body.max_devices).data : undefined,
    display_order: body.display_order !== undefined ? validatePlanDisplayOrder(body.display_order).data : undefined,
    features: featuresResult.data
  });
}

// ============================================================
// API KEY VALIDATION
// ============================================================

export interface ApiKeyValidationResult {
  valid: boolean;
  error?: string;
  keyData?: {
    id: number;
    productId: string;
    permissions: string[];
    rateLimit: number;
  };
}

export async function validateApiKeyFull(
  pool: Pool,
  apiKey: string
): Promise<ApiKeyValidationResult> {
  if (!apiKey) {
    return { valid: false, error: 'API key is required' };
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT 
        dk.id,
        dk.product_id,
        dk.permissions,
        dk.rate_limit,
        dk.status,
        dk.expires_at,
        p.is_active as product_is_active,
        p.is_deleted as product_is_deleted
      FROM developer_api_keys dk
      LEFT JOIN products p ON dk.product_id = p.product_id
      WHERE dk.api_key = $1`,
      [apiKey]
    );

    if (result.rows.length === 0) {
      return { valid: false, error: 'Invalid API key' };
    }

    const key = result.rows[0];

    if (key.status !== 'active') {
      return { valid: false, error: `API key is ${key.status}` };
    }

    if (key.expires_at && new Date(key.expires_at) < new Date()) {
      return { valid: false, error: 'API key has expired' };
    }

    if (!key.product_is_active) {
      return { valid: false, error: 'Product associated with this API key is inactive' };
    }

    if (key.product_is_deleted) {
      return { valid: false, error: 'Product associated with this API key has been deleted' };
    }

    return {
      valid: true,
      keyData: {
        id: key.id,
        productId: key.product_id,
        permissions: key.permissions || ['license:read'],
        rateLimit: key.rate_limit || 1000
      }
    };
  } finally {
    client.release();
  }
}

export async function validateApiKeyCreation(
  pool: Pool,
  productId: string,
  expires_at?: string
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];

  if (!productId) {
    return singleError('product_id', 'Product ID is required');
  }

  const client = await pool.connect();
  try {
    const productResult = await client.query(
      `SELECT product_id, name, is_active, is_deleted FROM products WHERE product_id = $1`,
      [productId]
    );

    if (productResult.rows.length === 0) {
      return singleError('product_id', 'Product not found');
    }

    const product = productResult.rows[0];

    if (product.is_deleted) {
      return singleError('product_id', 'Product has been deleted');
    }

    if (!product.is_active) {
      return singleError('product_id', 'Product is inactive');
    }

    const existingKey = await client.query(
      `SELECT id, api_key FROM developer_api_keys 
       WHERE product_id = $1 AND status = 'active'`,
      [productId]
    );

    if (existingKey.rows.length > 0) {
      return singleError('product_id', `Product "${product.name}" already has an active API key. Revoke the existing key first.`);
    }

    if (expires_at) {
      const expiryDate = new Date(expires_at);
      if (isNaN(expiryDate.getTime())) {
        return singleError('expires_at', 'Invalid expiry date format');
      }
      if (expiryDate <= new Date()) {
        return singleError('expires_at', 'Expiry date must be in the future');
      }
    }

    if (errors.length > 0) return failure(errors);

    return success({ productName: product.name });
  } finally {
    client.release();
  }
}

// ============================================================
// LICENSE VALIDATION
// ============================================================

export interface LicenseValidationConfig {
  checkProductExists: boolean;
  checkProductActive: boolean;
  checkPlanActive: boolean;
  checkApiKey: boolean;
  checkExpiry: boolean;
  checkDeviceLimit: boolean;
  checkDeleted: boolean;
}

export async function validateLicenseBeforeAction(
  pool: Pool,
  licenseKey: string,
  config: LicenseValidationConfig = {
    checkProductExists: true,
    checkProductActive: true,
    checkPlanActive: true,
    checkApiKey: false,
    checkExpiry: true,
    checkDeviceLimit: true,
    checkDeleted: true
  },
  hardwareId?: string
): Promise<ValidationResult & { license?: any; product?: any; plan?: any }> {
  const errors: ValidationError[] = [];
  let client = null;

  try {
    client = await pool.connect();
    const normalizedKey = licenseKey.toUpperCase();

    const licenseResult = await client.query(
      `SELECT 
        l.*,
        p.name as product_name,
        p.is_active as product_is_active,
        p.is_deleted as product_is_deleted,
        pl.name as plan_name,
        pl.is_active as plan_is_active,
        pl.max_devices as plan_max_devices
      FROM licenses l
      LEFT JOIN products p ON l.product_id = p.product_id
      LEFT JOIN plans pl ON l.plan_id = pl.id
      WHERE l.license_key = $1`,
      [normalizedKey]
    );

    if (licenseResult.rows.length === 0) {
      return { ...singleError('license_key', 'License key not found'), license: null, product: null, plan: null };
    }

    const license = licenseResult.rows[0];
    const product = {
      product_id: license.product_id,
      name: license.product_name,
      is_active: license.product_is_active,
      is_deleted: license.product_is_deleted
    };
    const plan = {
      id: license.plan_id,
      name: license.plan_name,
      is_active: license.plan_is_active,
      max_devices: license.plan_max_devices
    };

    if (config.checkDeleted && license.deleted_at) {
      errors.push({ field: 'license_key', message: 'License has been deleted' });
    }
    if (config.checkDeleted && license.status === 'deleted') {
      errors.push({ field: 'license_key', message: 'License has been deleted' });
    }

    if (config.checkProductExists && !license.product_id) {
      errors.push({ field: 'product_id', message: 'No product associated with this license' });
    }

    if (config.checkProductActive && product && (!product.is_active || product.is_deleted)) {
      const reason = product.is_deleted ? 'Product has been deleted' : 'Product is currently inactive';
      errors.push({ field: 'product_id', message: reason });
    }

    if (config.checkPlanActive && plan && !plan.is_active) {
      errors.push({ field: 'plan_id', message: 'Plan is currently inactive' });
    }

    if (config.checkExpiry) {
      const expiryDate = new Date(license.expiry_date);
      if (expiryDate < new Date()) {
        errors.push({ field: 'license_key', message: 'License has expired' });
      }
    }

    if (license.status === 'revoked') {
      errors.push({ field: 'license_key', message: 'License has been revoked' });
    }

    if (license.status === 'suspended') {
      errors.push({ field: 'license_key', message: 'License is suspended' });
    }

    if (license.status === 'disabled') {
      errors.push({ field: 'license_key', message: 'License is disabled' });
    }

    if (config.checkDeviceLimit && hardwareId) {
      const deviceResult = await client.query(
        `SELECT COUNT(*) as count FROM activations WHERE license_key = $1 AND is_active = true`,
        [normalizedKey]
      );
      const deviceCount = parseInt(deviceResult.rows[0]?.count || '0');
      if (deviceCount >= license.max_devices) {
        errors.push({ field: 'max_devices', message: `Maximum devices reached (${license.max_devices})` });
      }
    }

    if (errors.length > 0) {
      return { ...failure(errors), license, product, plan };
    }

    return { valid: true, errors: [], license, product, plan };
  } finally {
    if (client) client.release();
  }
}

export async function validateLicenseCreationInput(
  pool: Pool,
  body: any
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];

  const nameResult = validateCustomerName(body.name);
  if (!nameResult.valid) errors.push(...nameResult.errors);

  const emailResult = validateEmail(body.email);
  if (!emailResult.valid) errors.push(...emailResult.errors);

  if (!body.product_id) {
    errors.push({ field: 'product_id', message: 'Product ID is required' });
  }

  if (!body.plan) {
    errors.push({ field: 'plan', message: 'Plan is required' });
  }

  const expiryDays = Number(body.expiry_days || 365);
  if (isNaN(expiryDays) || expiryDays < 1 || expiryDays > 3650) {
    errors.push({ field: 'expiry_days', message: 'Expiry days must be between 1 and 3650' });
  }

  const maxDevices = Number(body.max_devices || 1);
  if (isNaN(maxDevices) || maxDevices < 1 || maxDevices > 100) {
    errors.push({ field: 'max_devices', message: 'Max devices must be between 1 and 100' });
  }

  if (body.phone && body.phone.trim()) {
    const phone = normalizePhone(body.phone.trim());
    if (phone.length > 0 && phone.length < 5) {
      errors.push({ field: 'phone', message: 'Invalid phone number' });
    }
  }

  if (errors.length > 0) return failure(errors);

  const client = await pool.connect();
  try {
    const productResult = await client.query(
      `SELECT product_id, name, is_active, is_deleted FROM products WHERE product_id = $1`,
      [body.product_id]
    );
    if (productResult.rows.length === 0) {
      return singleError('product_id', 'Product not found');
    }
    const product = productResult.rows[0];
    if (product.is_deleted) {
      return singleError('product_id', 'Product has been deleted');
    }

    const planResult = await client.query(
      `SELECT id, name, is_active FROM plans WHERE name = $1 AND product_id = $2`,
      [body.plan, body.product_id]
    );
    if (planResult.rows.length === 0) {
      return singleError('plan', `Plan "${body.plan}" not found for this product`);
    }
    if (!planResult.rows[0].is_active) {
      return singleError('plan', `Plan "${body.plan}" is inactive`);
    }

    return success({
      productName: product.name,
      planId: planResult.rows[0].id
    });
  } finally {
    client.release();
  }
}

// ============================================================
// LICENSE STATUS UPDATE
// ============================================================

export async function updateLicenseStatus(
  pool: Pool,
  licenseKey: string,
  newStatus: LicenseStatus,
  inactiveReason?: LicenseInactiveReason | null
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const dbStatus = newStatus.toLowerCase();
    await client.query(
      `UPDATE licenses 
       SET status = $1,
           inactive_reason = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE license_key = $3`,
      [dbStatus, inactiveReason || null, licenseKey]
    );

    await client.query(
      `INSERT INTO audit_logs (event_type, message, timestamp, license_key)
       VALUES ($1, $2, $3, $4)`,
      [
        `license_${dbStatus}`,
        `License status updated to "${newStatus}"${inactiveReason ? ` (Reason: ${inactiveReason})` : ''}`,
        new Date().toISOString(),
        licenseKey
      ]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function expireLicense(
  pool: Pool,
  licenseKey: string,
  reason: LicenseInactiveReason = 'Subscription Expired'
): Promise<void> {
  await updateLicenseStatus(pool, licenseKey, 'Expired', reason);
}

export async function revokeLicense(
  pool: Pool,
  licenseKey: string,
  reason: LicenseInactiveReason = 'License Revoked'
): Promise<void> {
  await updateLicenseStatus(pool, licenseKey, 'Revoked', reason);
}

export async function suspendLicense(
  pool: Pool,
  licenseKey: string,
  reason: LicenseInactiveReason = 'Validation Failed'
): Promise<void> {
  await updateLicenseStatus(pool, licenseKey, 'Suspended', reason);
}

// ============================================================
// DEVICE VALIDATION
// ============================================================

export function validateHardwareId(hardwareId: string): ValidationResult {
  if (!hardwareId || hardwareId.trim() === '') {
    return singleError('hardware_id', 'Hardware ID is required');
  }
  const trimmed = hardwareId.trim();
  if (trimmed.length < 8) {
    return singleError('hardware_id', 'Hardware ID is too short (minimum 8 characters)');
  }
  if (trimmed.length > 512) {
    return singleError('hardware_id', 'Hardware ID is too long (maximum 512 characters)');
  }
  if (!/^[a-zA-Z0-9\-_:.]+$/.test(trimmed)) {
    return singleError('hardware_id', 'Hardware ID contains invalid characters');
  }
  return success(trimmed);
}

export async function validateDeviceActivation(
  pool: Pool,
  licenseKey: string,
  hardwareId: string
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];

  const hwResult = validateHardwareId(hardwareId);
  if (!hwResult.valid) return hwResult;

  const licenseValidation = await validateLicenseBeforeAction(
    pool,
    licenseKey,
    {
      checkProductExists: true,
      checkProductActive: true,
      checkPlanActive: true,
      checkApiKey: false,
      checkExpiry: true,
      checkDeviceLimit: true,
      checkDeleted: true
    },
    hardwareId
  );

  if (!licenseValidation.valid) {
    return { valid: false, errors: licenseValidation.errors, data: licenseValidation.license };
  }

  const license = licenseValidation.license;

  const client = await pool.connect();
  try {
    const existingActivation = await client.query(
      `SELECT id, is_active FROM activations 
       WHERE license_key = $1 AND hardware_id = $2`,
      [licenseKey.toUpperCase(), hardwareId]
    );

    if (existingActivation.rows.length > 0) {
      if (existingActivation.rows[0].is_active) {
        return success({ already_activated: true });
      }
    }

    return success();
  } finally {
    client.release();
  }
}

// ============================================================
// TRIAL VALIDATION
// ============================================================

export async function validateTrialStart(
  pool: Pool,
  hardwareId: string,
  productId: string,
  customerEmail?: string
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];

  const hwResult = validateHardwareId(hardwareId);
  if (!hwResult.valid) return hwResult;

  if (customerEmail) {
    const emailResult = validateEmail(customerEmail);
    if (!emailResult.valid) errors.push(...emailResult.errors);
  }

  const client = await pool.connect();
  try {
    const productResult = await client.query(
      `SELECT product_id, name, is_active, is_deleted FROM products WHERE product_id = $1`,
      [productId]
    );
    if (productResult.rows.length === 0) {
      errors.push({ field: 'product_id', message: 'Product not found' });
    } else {
      const product = productResult.rows[0];
      if (!product.is_active) {
        errors.push({ field: 'product_id', message: 'Product is inactive' });
      }
      if (product.is_deleted) {
        errors.push({ field: 'product_id', message: 'Product has been deleted' });
      }
    }

    const existingTrial = await client.query(
      `SELECT id, status, expiry_date FROM trials 
       WHERE hardware_id = $1 AND product_id = $2 AND status = 'active'`,
      [hardwareId, productId]
    );
    if (existingTrial.rows.length > 0) {
      const trial = existingTrial.rows[0];
      const expiryDate = new Date(trial.expiry_date);
      if (expiryDate > new Date()) {
        const daysLeft = Math.max(0, Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
        errors.push({ field: 'hardware_id', message: `An active trial already exists with ${daysLeft} days remaining` });
      }
    }

    if (errors.length > 0) return failure(errors);
    return success();
  } finally {
    client.release();
  }
}

export async function validateTrialConversion(
  pool: Pool,
  hardwareId: string,
  productId: string,
  plan: string,
  customerName: string
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];

  const hwResult = validateHardwareId(hardwareId);
  if (!hwResult.valid) return hwResult;

  if (!customerName || customerName.trim() === '') {
    errors.push({ field: 'customer_name', message: 'Customer name is required for conversion' });
  }

  const client = await pool.connect();
  try {
    const trialResult = await client.query(
      `SELECT id, status, expiry_date, customer_email 
       FROM trials 
       WHERE hardware_id = $1 AND product_id = $2 AND status = 'active'`,
      [hardwareId, productId]
    );

    if (trialResult.rows.length === 0) {
      errors.push({ field: 'hardware_id', message: 'No active trial found for conversion' });
      return failure(errors);
    }

    const trial = trialResult.rows[0];
    const trialExpiry = new Date(trial.expiry_date);
    if (trialExpiry < new Date()) {
      errors.push({ field: 'hardware_id', message: 'Trial has expired and cannot be converted' });
    }

    const planResult = await client.query(
      `SELECT id, name, price, max_devices, is_active FROM plans 
       WHERE name = $1 AND product_id = $2`,
      [plan, productId]
    );

    if (planResult.rows.length === 0) {
      errors.push({ field: 'plan', message: `Plan "${plan}" not found for this product` });
    } else if (!planResult.rows[0].is_active) {
      errors.push({ field: 'plan', message: `Plan "${plan}" is inactive` });
    }

    if (errors.length > 0) return failure(errors);

    return success({
      trialCustomerEmail: trial.customer_email,
      planData: planResult.rows[0]
    });
  } finally {
    client.release();
  }
}

// ============================================================
// PAYMENT VALIDATION
// ============================================================

export async function validatePaymentBeforeConversion(
  pool: Pool,
  customerEmail: string,
  planName: string,
  productId: string,
  apiKey: string
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];

  const emailResult = validateEmail(customerEmail);
  if (!emailResult.valid) errors.push(...emailResult.errors);

  const client = await pool.connect();
  try {
    const customerResult = await client.query(
      `SELECT id, status FROM customers WHERE email = $1`,
      [normalizeEmail(customerEmail)]
    );
    if (customerResult.rows.length === 0) {
      errors.push({ field: 'customer_email', message: 'Customer not found' });
    } else if (customerResult.rows[0].status === 'disabled') {
      errors.push({ field: 'customer_email', message: 'Customer is disabled' });
    }

    const planResult = await client.query(
      `SELECT id, name, price, is_active FROM plans 
       WHERE name = $1 AND product_id = $2`,
      [planName, productId]
    );
    if (planResult.rows.length === 0) {
      errors.push({ field: 'plan', message: 'Plan not found' });
    }

    const productResult = await client.query(
      `SELECT is_active, is_deleted FROM products WHERE product_id = $1`,
      [productId]
    );
    if (productResult.rows.length === 0) {
      errors.push({ field: 'product_id', message: 'Product not found' });
    } else {
      const product = productResult.rows[0];
      if (!product.is_active) {
        errors.push({ field: 'product_id', message: 'Product is inactive' });
      }
      if (product.is_deleted) {
        errors.push({ field: 'product_id', message: 'Product has been deleted' });
      }
    }

    const keyResult = await client.query(
      `SELECT dk.status, dk.expires_at, p.is_active as product_is_active
       FROM developer_api_keys dk
       LEFT JOIN products p ON dk.product_id = p.product_id
       WHERE dk.api_key = $1`,
      [apiKey]
    );
    if (keyResult.rows.length > 0) {
      const key = keyResult.rows[0];
      if (key.status !== 'active') {
        errors.push({ field: 'api_key', message: `API key is ${key.status}` });
      }
      if (key.expires_at && new Date(key.expires_at) < new Date()) {
        errors.push({ field: 'api_key', message: 'API key has expired' });
      }
    }

    if (errors.length > 0) return failure(errors);
    return success();
  } finally {
    client.release();
  }
}

// ============================================================
// SECURITY VALIDATION
// ============================================================

export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

export function validateJwtToken(token: string): { valid: boolean; error?: string } {
  if (!token) {
    return { valid: false, error: 'No authentication token provided' };
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Invalid token format' };
  }
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return { valid: false, error: 'Token has expired' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid token payload' };
  }
}

export function validatePermissions(
  required: string[],
  userPermissions: string[]
): ValidationResult {
  const missing = required.filter(p => !userPermissions.includes(p));
  if (missing.length > 0) {
    return singleError('permissions', `Missing required permissions: ${missing.join(', ')}`);
  }
  return success();
}

export function validateRole(
  userRole: string,
  allowedRoles: string[]
): ValidationResult {
  if (!allowedRoles.includes(userRole)) {
    return singleError('role', `Access denied. Required role: ${allowedRoles.join(' or ')}`);
  }
  return success();
}

export function validatePaginationParams(
  limit: any,
  offset: any,
  maxLimit: number = 500
): ValidationResult {
  const errors: ValidationError[] = [];
  const limitNum = parseInt(limit) || 100;
  const offsetNum = parseInt(offset) || 0;

  if (limitNum < 1) {
    errors.push({ field: 'limit', message: 'Limit must be at least 1' });
  }
  if (limitNum > maxLimit) {
    errors.push({ field: 'limit', message: `Limit must not exceed ${maxLimit}` });
  }
  if (offsetNum < 0) {
    errors.push({ field: 'offset', message: 'Offset must be non-negative' });
  }

  if (errors.length > 0) return failure(errors);
  return success({ limit: limitNum, offset: offsetNum });
}

// ============================================================
// DATABASE VALIDATION
// ============================================================

export async function verifyForeignKey(
  pool: Pool,
  table: string,
  column: string,
  value: any
): Promise<ValidationResult> {
  if (!value) return success();
  const client = await pool.connect();
  try {
    const allowedTables = ['products', 'plans', 'licenses', 'customers', 'developer_api_keys', 'orders', 'subscriptions'];
    if (!allowedTables.includes(table)) {
      return singleError('table', `Table "${table}" is not allowed for FK verification`);
    }
    const result = await client.query(
      `SELECT 1 FROM ${table} WHERE ${column} = $1 LIMIT 1`,
      [value]
    );
    if (result.rows.length === 0) {
      return singleError(column, `Referenced ${column} does not exist in ${table}`);
    }
    return success();
  } finally {
    client.release();
  }
}

export async function executeInTransaction(
  pool: Pool,
  operations: (client: any) => Promise<void>
): Promise<{ success: boolean; error?: string }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await operations(client);
    await client.query('COMMIT');
    return { success: true };
  } catch (error) {
    await client.query('ROLLBACK');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Transaction failed'
    };
  } finally {
    client.release();
  }
}

// ============================================================
// ERROR RESPONSE HELPER
// ============================================================

export function validationErrorResponse(errors: ValidationError[], status: number = 400) {
  return {
    success: false,
    error: errors[0]?.message || 'Validation failed',
    errors: errors.map(e => ({
      field: e.field,
      message: e.message
    })),
    status
  };
}

export function notFoundResponse(entity: string) {
  return {
    success: false,
    error: `${entity} not found`,
    status: 404
  };
}

export function unauthorizedResponse(message: string = 'Unauthorized') {
  return {
    success: false,
    error: message,
    status: 401
  };
}

export function forbiddenResponse(message: string = 'Forbidden') {
  return {
    success: false,
    error: message,
    status: 403
  };
}
