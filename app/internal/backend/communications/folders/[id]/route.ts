import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/backend-db';

export const dynamic = 'force-dynamic';

// FILE: app/internal/backend/communications/folders/[id]/route.ts
// PURPOSE: Rename / restore / soft-delete a Communication Center folder

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let client = null;
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, section, kind, filter, action } = body;

    client = await (await getDb()).connect();

    const existing = await client.query('SELECT * FROM conversation_folders WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      client.release();
      client = null;
      return NextResponse.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Folder not found.' }
      }, { status: 404 });
    }

    const folder = existing.rows[0];
    const now = new Date().toISOString();

    if (action === 'restore') {
      await client.query(
        `UPDATE conversation_folders SET deleted_at = NULL, updated_at = $2 WHERE id = $1`,
        [id, now]
      );
      await client.query(
        `INSERT INTO audit_logs (event_type, message, timestamp) VALUES ($1, $2, $3)`,
        ['folder_restored', `Folder "${folder.name}" restored`, now]
      );
      client.release();
      client = null;
      return NextResponse.json({ success: true, message: 'Folder restored.' });
    }

    const sets: string[] = [];
    const values: any[] = [id];
    let i = 2;

    if (name && name.trim() && name.trim() !== folder.name) {
      if (folder.is_system) {
        client.release();
        client = null;
        return NextResponse.json({
          success: false,
          error: { code: 'SYSTEM_FOLDER', message: 'System folders cannot be renamed.' }
        }, { status: 400 });
      }
      sets.push(`name = $${i++}`);
      values.push(name.trim());
    }

    if (section === 'internal' || section === 'external') {
      sets.push(`section = $${i++}`);
      values.push(section);
    }

    if (kind && ['list', 'queue', 'logs', 'history'].includes(kind)) {
      sets.push(`kind = $${i++}`);
      values.push(kind);
    }

    if (filter && typeof filter === 'object') {
      sets.push(`filter_json = $${i++}`);
      values.push(JSON.stringify(filter));
    }

    if (sets.length === 0) {
      client.release();
      client = null;
      return NextResponse.json({ success: true, message: 'No changes applied.' });
    }

    sets.push(`updated_at = $${i}`);
    values.push(now);

    await client.query(`UPDATE conversation_folders SET ${sets.join(', ')} WHERE id = $1`, values);

    await client.query(
      `INSERT INTO audit_logs (event_type, message, timestamp) VALUES ($1, $2, $3)`,
      ['folder_updated', `Folder "${folder.name}" updated`, now]
    );

    client.release();
    client = null;

    return NextResponse.json({ success: true, message: 'Folder updated.' });

  } catch (error: any) {
    console.error('Folder update error:', error);
    if (client) client.release();
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update folder.' }
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let client = null;
  try {
    const { id } = await params;

    client = await (await getDb()).connect();

    const existing = await client.query('SELECT * FROM conversation_folders WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      client.release();
      client = null;
      return NextResponse.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Folder not found.' }
      }, { status: 404 });
    }

    const folder = existing.rows[0];

    if (folder.is_system) {
      client.release();
      client = null;
      return NextResponse.json({
        success: false,
        error: { code: 'SYSTEM_FOLDER', message: 'System folders cannot be deleted.' }
      }, { status: 400 });
    }

    const now = new Date().toISOString();
    await client.query(
      `UPDATE conversation_folders SET deleted_at = $2, updated_at = $2 WHERE id = $1`,
      [id, now]
    );

    await client.query(
      `INSERT INTO audit_logs (event_type, message, timestamp) VALUES ($1, $2, $3)`,
      ['folder_deleted', `Folder "${folder.name}" deleted (can be restored)`, now]
    );

    client.release();
    client = null;

    return NextResponse.json({ success: true, message: 'Folder deleted. You can restore it anytime.' });

  } catch (error: any) {
    console.error('Folder delete error:', error);
    if (client) client.release();
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete folder.' }
    }, { status: 500 });
  }
}
