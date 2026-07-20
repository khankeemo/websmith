// FILE: app/internal/backend/admin/trials/trial-templates/route.ts
// PURPOSE: Trial Templates API - CRUD operations for trial templates
// DATABASE: Neon PostgreSQL only
// ENDPOINTS:
//   GET /internal/backend/admin/trials/trial-templates - List all templates
//   POST /internal/backend/admin/trials/trial-templates - Create template
// NOTE: PUT, DELETE, PATCH are in [id]/route.ts
// RULE: Universal - works for ANY product

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/backend-db';

// ============================================================
// TYPES
// ============================================================

interface TrialTemplateInput {
  name: string;
  description?: string | null;
  duration_days: number;
  hardware_binding_enabled: boolean;
  max_hardware_changes: number;
  max_devices: number;
  collect_name: boolean;
  collect_email: boolean;
  collect_mobile: boolean;
  support_url: string | null;
  store_url: string | null;
  offline_cache_enabled: boolean;
  is_active: boolean;
  is_system_default: boolean;
}

// ============================================================
// HELPER: Validate Input
// ============================================================

function validateTemplateInput(body: any): { valid: boolean; error?: string } {
  if (!body.name || body.name.trim() === '') {
    return { valid: false, error: 'Template name is required' };
  }
  if (!body.duration_days || body.duration_days < 1) {
    return { valid: false, error: 'Valid duration days is required' };
  }
  if (body.duration_days > 365) {
    return { valid: false, error: 'Duration days cannot exceed 365' };
  }
  return { valid: true };
}

// ============================================================
// GET /admin/trials/trial-templates
// Description: List all trial templates
// ============================================================

export async function GET(request: NextRequest) {
  let client = null;
  
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('include_inactive') === 'true';
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    const pool = await getDb(); client = await pool.connect();
    
    let query = `
      SELECT 
        id,
        name,
        description,
        duration_days,
        hardware_binding_enabled,
        max_hardware_changes,
        max_devices,
        collect_name,
        collect_email,
        collect_mobile,
        support_url,
        store_url,
        offline_cache_enabled,
        is_active,
        is_system_default,
        is_permanent,
        created_at,
        updated_at
      FROM trial_templates
    `;
    
    const params: any[] = [];
    let paramCounter = 1;
    let conditions: string[] = [];
    
    if (!includeInactive) {
      conditions.push(`is_active = true`);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` ORDER BY name ASC LIMIT $${paramCounter} OFFSET $${paramCounter + 1}`;
    params.push(limit, offset);
    
    const result = await client.query(query, params);
    
    const countResult = await client.query(
      `SELECT COUNT(*) as total FROM trial_templates ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}`
    );
    
    client.release();
    
    return NextResponse.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      total: parseInt(countResult.rows[0]?.total || '0'),
      limit,
      offset
    });
    
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('GET trial-templates error:', msg, error instanceof Error ? error.stack : '');
    if (client) client.release();
    return NextResponse.json(
      { success: false, error: msg || 'Failed to fetch trial templates', data: [] },
      { status: 500 }
    );
  }
}

// ============================================================
// POST /admin/trials/trial-templates
// Description: Create a new trial template
// ============================================================

export async function POST(request: NextRequest) {
  let client = null;
  
  try {
    const body: TrialTemplateInput = await request.json();
    
    // Validate
    const validation = validateTemplateInput(body);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }
    
    const pool = await getDb(); client = await pool.connect();
    
    // Check for duplicate name
    const duplicateCheck = await client.query(
      `SELECT id FROM trial_templates WHERE name = $1`,
      [body.name.trim()]
    );
    
    if (duplicateCheck.rows.length > 0) {
      client.release();
      return NextResponse.json(
        { success: false, error: 'A template with this name already exists' },
        { status: 409 }
      );
    }
    
    const result = await client.query(
      `INSERT INTO trial_templates (
        name,
        description,
        duration_days,
        hardware_binding_enabled,
        max_hardware_changes,
        max_devices,
        collect_name,
        collect_email,
        collect_mobile,
        support_url,
        store_url,
        offline_cache_enabled,
        is_active,
        is_system_default,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING 
        id,
        name,
        description,
        duration_days,
        hardware_binding_enabled,
        max_hardware_changes,
        max_devices,
        collect_name,
        collect_email,
        collect_mobile,
        support_url,
        store_url,
        offline_cache_enabled,
        is_active,
        is_system_default,
        is_permanent,
        created_at,
        updated_at`,
      [
        body.name.trim(),
        body.description || null,
        body.duration_days || 0,
        body.hardware_binding_enabled ?? true,
        body.max_hardware_changes ?? 1,
        body.max_devices ?? 1,
        body.collect_name ?? true,
        body.collect_email ?? true,
        body.collect_mobile ?? false,
        body.support_url || null,
        body.store_url || null,
        body.offline_cache_enabled ?? true,
        body.is_active ?? true,
        false // User-created templates must never be system defaults
      ]
    );
    
    client.release();
    
    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Trial template created successfully'
    }, { status: 201 });
    
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('POST trial-templates error:', msg, error instanceof Error ? error.stack : '');
    if (client) client.release();
    return NextResponse.json(
      { success: false, error: msg || 'Failed to create trial template' },
      { status: 500 }
    );
  }
}

