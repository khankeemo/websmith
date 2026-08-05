import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/backend-db';

export const dynamic = 'force-dynamic';

// FILE: app/internal/backend/communications/folders/route.ts
// PURPOSE: Database-driven Communication Center folders (create/list)

export async function GET(request: NextRequest) {
  let client = null;
  try {
    const { searchParams } = new URL(request.url);
    const includeDeleted = searchParams.get('include_deleted') === '1';

    client = await (await getDb()).connect();

    const result = await client.query(
      `SELECT * FROM conversation_folders
       WHERE deleted_at IS NULL${includeDeleted ? ' OR deleted_at IS NOT NULL' : ''}
       ORDER BY is_system DESC, display_order ASC, name ASC`
    );

    client.release();
    client = null;

    return NextResponse.json({ success: true, data: { folders: result.rows } });
  } catch (error: any) {
    console.error('Folders list error:', error);
    if (client) client.release();
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list folders.' }
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let client = null;
  try {
    const body = await request.json();
    const { name, section, kind, filter } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'Folder name is required.' }
      }, { status: 400 });
    }

    const normalizedSection = section === 'external' ? 'external' : 'internal';
    const normalizedKind = ['list', 'queue', 'logs', 'history'].includes(kind) ? kind : 'list';
    const filterJson = JSON.stringify(filter && typeof filter === 'object' ? filter : {});

    const folderId = `FLD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const now = new Date().toISOString();

    client = await (await getDb()).connect();

    const maxOrder = await client.query('SELECT COALESCE(MAX(display_order), 0) AS m FROM conversation_folders');
    const displayOrder = Number(maxOrder.rows[0]?.m || 0) + 1;

    await client.query(
      `INSERT INTO conversation_folders (id, name, section, kind, filter_json, is_system, display_order, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,FALSE,$6,$7,$7)`,
      [folderId, name.trim(), normalizedSection, normalizedKind, filterJson, displayOrder, now]
    );

    await client.query(
      `INSERT INTO audit_logs (event_type, message, timestamp)
       VALUES ($1, $2, $3)`,
      ['folder_created', `Folder "${name.trim()}" (${normalizedSection}) created`, now]
    );

    const folder = await client.query('SELECT * FROM conversation_folders WHERE id = $1', [folderId]);

    client.release();
    client = null;

    return NextResponse.json({
      success: true,
      message: 'Folder created successfully.',
      data: { folder: folder.rows[0] }
    });

  } catch (error: any) {
    console.error('Folder create error:', error);
    if (client) client.release();
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create folder.' }
    }, { status: 500 });
  }
}
