// FILE: app/internal/backend/admin/trials/trial-templates/[id]/route.ts
// PURPOSE: Trial Template by ID - PUT/DELETE/PATCH operations
// DATABASE: Neon PostgreSQL only
// ENDPOINTS:
//   PUT /internal/backend/admin/trials/trial-templates/:id - Update template
//   DELETE /internal/backend/admin/trials/trial-templates/:id - Delete template
//   PATCH /internal/backend/admin/trials/trial-templates/:id - Toggle active status

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/backend-db';

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

async function getTemplateById(client: any, id: number) {
  const result = await client.query(
    `SELECT 
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
    WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

// ============================================================
// GET /admin/trials/trial-templates/:id
// Description: Fetch a single trial template by ID
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let client = null;

  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);

    if (isNaN(id) || id < 1) {
      return NextResponse.json(
        { success: false, error: 'Valid template ID is required' },
        { status: 400 }
      );
    }

    const pool = await getDb(); client = await pool.connect();

    const template = await getTemplateById(client, id);
    if (!template) {
      client.release();
      return NextResponse.json(
        { success: false, error: 'Trial template not found' },
        { status: 404 }
      );
    }

    client.release();

    return NextResponse.json({
      success: true,
      data: template
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('GET trial-templates error:', msg, error instanceof Error ? error.stack : '');
    if (client) client.release();
    return NextResponse.json(
      { success: false, error: msg || 'Failed to fetch trial template' },
      { status: 500 }
    );
  }
}

// ============================================================
// PUT /admin/trials/trial-templates/:id
// Description: Update an existing trial template
// ============================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let client = null;

  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);

    if (isNaN(id) || id < 1) {
      return NextResponse.json(
        { success: false, error: 'Valid template ID is required' },
        { status: 400 }
      );
    }

    const body: Partial<TrialTemplateInput> = await request.json();

    if (body.name !== undefined && body.name.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Template name cannot be empty' },
        { status: 400 }
      );
    }

    if (body.duration_days !== undefined && (body.duration_days < 1 || body.duration_days > 365)) {
      return NextResponse.json(
        { success: false, error: 'Duration days must be between 1 and 365' },
        { status: 400 }
      );
    }

    const pool = await getDb(); client = await pool.connect();

    const existing = await getTemplateById(client, id);
    if (!existing) {
      client.release();
      return NextResponse.json(
        { success: false, error: 'Trial template not found' },
        { status: 404 }
      );
    }

    if (body.name) {
      if (existing.is_permanent && body.name.trim() !== 'Universal Trial') {
        client.release();
        return NextResponse.json(
          { success: false, error: 'Cannot rename the Universal Trial. It is a permanent system template.' },
          { status: 409 }
        );
      }

      const duplicateCheck = await client.query(
        `SELECT id FROM trial_templates WHERE name = $1 AND id != $2`,
        [body.name.trim(), id]
      );
      if (duplicateCheck.rows.length > 0) {
        client.release();
        return NextResponse.json(
          { success: false, error: 'A template with this name already exists' },
          { status: 409 }
        );
      }
    }

    const updates: string[] = [];
    const values: any[] = [];

    const fieldMap: Record<string, { transform?: (val: any) => any }> = {
      name: { transform: (v) => v.trim() },
      description: { transform: (v) => v || null },
      duration_days: {},
      hardware_binding_enabled: {},
      max_hardware_changes: {},
      max_devices: {},
      collect_name: {},
      collect_email: {},
      collect_mobile: {},
      support_url: { transform: (v) => v || null },
      store_url: { transform: (v) => v || null },
      offline_cache_enabled: {},
      is_active: {}
    };

    for (const [key, config] of Object.entries(fieldMap)) {
      if (body[key as keyof TrialTemplateInput] !== undefined) {
        const value = config.transform
          ? config.transform(body[key as keyof TrialTemplateInput])
          : body[key as keyof TrialTemplateInput];
        updates.push(`${key} = $${updates.length + 1}`);
        values.push(value);
      }
    }

    if (updates.length === 0) {
      client.release();
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    await client.query(
      `UPDATE trial_templates SET ${updates.join(', ')} WHERE id = $${updates.length}`,
      values
    );

    const result = await client.query(
      `SELECT 
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
      WHERE id = $1`,
      [id]
    );

    client.release();

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: 'Trial template updated successfully'
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('PUT trial-templates error:', msg, error instanceof Error ? error.stack : '');
    if (client) client.release();
    return NextResponse.json(
      { success: false, error: msg || 'Failed to update trial template' },
      { status: 500 }
    );
  }
}

// ============================================================
// DELETE /admin/trials/trial-templates/:id
// Description: Delete a trial template
// ============================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let client = null;

  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);

    if (isNaN(id) || id < 1) {
      return NextResponse.json(
        { success: false, error: 'Valid template ID is required' },
        { status: 400 }
      );
    }

    const pool = await getDb(); client = await pool.connect();

    const existing = await getTemplateById(client, id);
    if (!existing) {
      client.release();
      return NextResponse.json(
        { success: false, error: 'Trial template not found' },
        { status: 404 }
      );
    }

    if (existing.is_permanent) {
      client.release();
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot delete the Universal Trial. It is a permanent system template.'
        },
        { status: 409 }
      );
    }

    if (existing.is_system_default) {
      client.release();
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot delete the system default trial template. Set another template as system default first.'
        },
        { status: 409 }
      );
    }

    await client.query(
      `DELETE FROM trial_templates WHERE id = $1`,
      [id]
    );

    client.release();

    return NextResponse.json({
      success: true,
      message: `Trial template "${existing.name}" deleted successfully`
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('DELETE trial-templates error:', msg, error instanceof Error ? error.stack : '');
    if (client) client.release();
    return NextResponse.json(
      { success: false, error: msg || 'Failed to delete trial template' },
      { status: 500 }
    );
  }
}

// ============================================================
// PATCH /admin/trials/trial-templates/:id
// Description: Toggle active status of a trial template
// ============================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let client = null;

  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);

    if (isNaN(id) || id < 1) {
      return NextResponse.json(
        { success: false, error: 'Valid template ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { is_active } = body;

    if (is_active === undefined || typeof is_active !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'is_active boolean is required' },
        { status: 400 }
      );
    }

    const pool = await getDb(); client = await pool.connect();

    const existing = await getTemplateById(client, id);
    if (!existing) {
      client.release();
      return NextResponse.json(
        { success: false, error: 'Trial template not found' },
        { status: 404 }
      );
    }

    if (existing.is_permanent) {
      client.release();
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot disable the Universal Trial. It is a permanent system template.'
        },
        { status: 409 }
      );
    }

    await client.query(
      `UPDATE trial_templates 
       SET is_active = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [is_active, id]
    );

    const result = await client.query(
      `SELECT 
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
      WHERE id = $1`,
      [id]
    );

    client.release();

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      message: `Trial template ${is_active ? 'activated' : 'deactivated'} successfully`
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('PATCH trial-templates error:', msg, error instanceof Error ? error.stack : '');
    if (client) client.release();
    return NextResponse.json(
      { success: false, error: msg || 'Failed to update trial template status' },
      { status: 500 }
    );
  }
}
