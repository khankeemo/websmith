/**
 * ---------------------------------------------------------
 * Websmith Universal License API Center V1
 * File: app/internal/publisher/validator.ts
 * Purpose: Pure validation layer - validates product, plans, API key
 * Author: Websmith
 * 
 * RESPONSIBILITY:
 * - Validate API key exists and is active
 * - Validate product exists and is active
 * - Verify API key belongs to the product
 * - Fetch product plans
 * - Return validation result with clear error messages
 * ---------------------------------------------------------
 */

import { Pool } from 'pg';
import { validateApiKey } from '@/lib/public-api/auth';
import { ProductData, PlanData } from './index';

export interface ValidationResult {
  valid: boolean;
  product: ProductData | null;
  plans: PlanData[];
  errors: string[];
  productName?: string;
  apiKey?: string;
  errorCode?: string;
}

export interface ValidationError {
  code: string;
  message: string;
}

export class ProductValidator {
  async validate(
    productId: string,
    apiKey: string,
    db: Pool
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    let productName: string | undefined;

    try {
      const authResult = await validateApiKey(apiKey);
      
      if (!authResult) {
        errors.push('Invalid or expired API key');
        return { 
          valid: false, 
          product: null, 
          plans: [], 
          errors,
          apiKey,
          errorCode: 'INVALID_API_KEY'
        };
      }

      const product = await this.fetchProduct(productId, db);
      
      if (!product) {
        errors.push(`Product not found with ID: ${productId}`);
        return { 
          valid: false, 
          product: null, 
          plans: [], 
          errors,
          apiKey,
          errorCode: 'PRODUCT_NOT_FOUND'
        };
      }

      productName = product.name;

      if (product.is_deleted === true) {
        errors.push(`Product "${productName}" has been deleted`);
        return { 
          valid: false, 
          product: null, 
          plans: [], 
          errors,
          productName,
          apiKey,
          errorCode: 'PRODUCT_DELETED'
        };
      }

      // ✅ Now works with BOOLEAN type
      if (product.is_active === false) {
        errors.push(`Product "${productName}" is not active`);
        return { 
          valid: false, 
          product: null, 
          plans: [], 
          errors,
          productName,
          apiKey,
          errorCode: 'PRODUCT_INACTIVE'
        };
      }

      if (authResult.productId && authResult.productId !== productId) {
        const keyProductName = await this.getProductNameById(authResult.productId, db);
        
        errors.push(
          `API key is not authorized for "${productName}". ` +
          `This key belongs to "${keyProductName || authResult.productId}". ` +
          `Please select the correct product or use a different API key.`
        );
        
        return { 
          valid: false, 
          product: null, 
          plans: [], 
          errors,
          productName,
          apiKey,
          errorCode: 'KEY_PRODUCT_MISMATCH'
        };
      }

      const plans = await this.fetchPlans(productId, db);

      // Plans are optional for SDK generation.
      // SDK only needs: trial settings, device limits, support email.
      // Plans are a business-layer concept (pricing, billing, subscriptions).
      if (plans.length === 0) {
        console.log(`[Validator] No active plans for "${productName}" — SDK generation proceeds without plans`);
      }

      const trialConfig = await this.getTrialConfig(productId, db);
      if (trialConfig && !trialConfig.is_valid) {
        errors.push(`Trial configuration issue for "${productName}": ${trialConfig.message}`);
      }

      // ✅ FIXED: Removed || product.id fallback
      // Populate trial config from Universal Trial template
      let trialEnabled = false;
      let trialDays = 0;
      try {
        const utResult = await db.query(
          `SELECT duration_days FROM trial_templates WHERE is_system_default = true AND is_active = true LIMIT 1`
        );
        if (utResult.rows.length > 0) {
          trialEnabled = true;
          trialDays = utResult.rows[0].duration_days || 0;
        }
      } catch { /* trial template table may not exist yet */ }

      const validatedProduct: ProductData = {
        id: product.product_id,
        name: product.name,
        description: product.description || '',
        version: product.version || '1.0.0',
        company_name: product.company_name || '',
        support_email: '',
        support_url: '',
        trial_enabled: trialEnabled,
        trial_days: trialDays,
        hardware_binding: false,
        offline_days: 0,
        renewal_reminder_days: 7
      };

      const validatedPlans: PlanData[] = plans.map((plan: any) => ({
        id: plan.id,
        name: plan.name,
        description: plan.description || '',
        price: Number(plan.price) || 0,
        duration_days: plan.is_trial_plan
          ? (plan.trial_days_limit || plan.default_expiry_days || 0)
          : (plan.default_expiry_days || 0),
        max_devices: plan.max_devices || 0,
        is_trial_plan: plan.is_trial_plan || false,
        features: plan.features || [],
        display_order: plan.display_order || 0
      }));

      return {
        valid: true,
        product: validatedProduct,
        plans: validatedPlans,
        errors: [],
        productName: product.name,
        apiKey: apiKey
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
      errors.push(`Validation failed: ${errorMessage}`);
      
      return {
        valid: false,
        product: null,
        plans: [],
        errors,
        productName,
        apiKey,
        errorCode: 'VALIDATION_ERROR'
      };
    }
  }

  /**
   * ✅ FIXED: Removed non-existent columns, using product_id only
   */
  private async fetchProduct(productId: string, db: Pool): Promise<any> {
    const result = await db.query(
      `SELECT 
        product_id,
        name,
        description,
        version,
        company_name,
        is_active,
        is_deleted
       FROM products
       WHERE product_id = $1`,
      [productId]
    );
    return result.rows[0] || null;
  }

  private async getProductNameById(productId: string, db: Pool): Promise<string | null> {
    try {
      const result = await db.query(
        `SELECT name FROM products WHERE product_id = $1`,
        [productId]
      );
      return result.rows[0]?.name || null;
    } catch {
      return null;
    }
  }

  /**
   * ✅ FIXED: Changed duration_days to default_expiry_days (with alias)
   */
  private async fetchPlans(productId: string, db: Pool): Promise<any[]> {
    const result = await db.query(
      `SELECT 
        id,
        name,
        description,
        price,
        default_expiry_days as duration_days,
        max_devices,
        is_trial_plan,
        features,
        display_order,
        is_active
       FROM plans
       WHERE product_id = $1 AND is_active = true
       ORDER BY display_order ASC`,
      [productId]
    );
    return result.rows || [];
  }

  private async getTrialConfig(
    productId: string, 
    db: Pool
  ): Promise<{ is_valid: boolean; message: string }> {
    try {
      const result = await db.query(
        `SELECT id, name, duration_days, is_active
         FROM trial_templates
         WHERE is_system_default = true AND is_active = true
         LIMIT 1`
      );

      if (result.rows.length === 0) {
        return { is_valid: true, message: 'No universal trial configured' };
      }

      const template = result.rows[0];
      return { 
        is_valid: true, 
        message: `Universal Trial configured: ${template.duration_days} days` 
      };

    } catch (error) {
      return { 
        is_valid: true, 
        message: 'Trial configuration check failed (optional)' 
      };
    }
  }

}

export default ProductValidator;