import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { getDb } from '@/lib/backend-db';
import { sendEmail } from '@/lib/email/brevo';

export async function GET(request: NextRequest) {
  let client = null;
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const requestType = searchParams.get('request_type');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');

    const db = await getDb();
    client = await db.connect();

    let where = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      where += ` AND r.status = $${paramIndex++}`;
      params.push(status);
    }
    if (requestType) {
      where += ` AND r.request_type = $${paramIndex++}`;
      params.push(requestType);
    }

    const countResult = await client.query(
      `SELECT COUNT(*) FROM requests r ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    params.push(limit);
    params.push(offset);

    const result = await client.query(
      `SELECT r.* FROM requests r ${where} ORDER BY r.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      params
    );

    client.release();
    client = null;

    return NextResponse.json({
      success: true,
      data: {
        requests: result.rows,
        total,
        limit,
        offset,
      }
    });
  } catch (error: any) {
    console.error('Admin requests GET error:', error);
    if (client) { client.release(); }
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch requests' }
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  let client = null;
  try {
    const body = await request.json();
    const { request_id, status, admin_notes, reply_message } = body;

    if (!request_id) {
      return NextResponse.json({
        success: false,
        error: { code: 'MISSING_REQUEST_ID', message: 'request_id is required' }
      }, { status: 400 });
    }

    const db = await getDb();
    client = await db.connect();

    const existing = await client.query(
      `SELECT * FROM requests WHERE request_id = $1`,
      [request_id]
    );

    if (existing.rows.length === 0) {
      client.release();
      client = null;
      return NextResponse.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Request not found' }
      }, { status: 404 });
    }

    const request_data = existing.rows[0];
    const now = new Date().toISOString();
    const updates: string[] = [];
    const updateParams: any[] = [];
    let paramIndex = 1;

    if (status) {
      updates.push(`status = $${paramIndex++}`);
      updateParams.push(status);
      if (status === 'resolved') {
        updates.push(`resolved_at = $${paramIndex++}`);
        updateParams.push(now);
      }
      if (status === 'closed') {
        updates.push(`closed_at = $${paramIndex++}`);
        updateParams.push(now);
      }
    }
    if (admin_notes !== undefined) {
      updates.push(`admin_notes = $${paramIndex++}`);
      updateParams.push(admin_notes);
    }

    updates.push(`updated_at = $${paramIndex++}`);
    updateParams.push(now);

    if (updates.length > 0) {
      updateParams.push(request_id);
      await client.query(
        `UPDATE requests SET ${updates.join(', ')} WHERE request_id = $${paramIndex++}`,
        updateParams
      );
    }

    if (reply_message && request_data.customer_email) {
      await sendEmail(
        db,
        'admin_notification',
        { email: request_data.customer_email, name: request_data.customer_name || 'Valued Customer' },
        {
          customer_name: request_data.customer_name || 'Valued Customer',
          product_name: request_data.product_name || 'our product',
          license_key: request_data.license_key || '',
          request_id: request_id,
          message: reply_message,
          support_email: 'support@websmithdigital.com',
        }
      );
    }

    client.release();
    client = null;

    return NextResponse.json({
      success: true,
      data: { message: 'Request updated successfully' }
    });

  } catch (error: any) {
    console.error('Admin requests PUT error:', error);
    if (client) { client.release(); }
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update request' }
    }, { status: 500 });
  }
}
