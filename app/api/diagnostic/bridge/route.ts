import { NextResponse } from 'next/server';
import { getDb } from '@/lib/backend-db';

/**
 * DIAGNOSTIC ENDPOINT ONLY
 * Checks if PostgreSQL has received any customer emails
 * This helps verify Phase 2: Bridge is processing emails
 */
export async function GET() {
    try {
        const pool = await getDb();

        // Count conversations
        const convResult = await pool.query(
            `SELECT COUNT(*) as count FROM communication_conversations WHERE deleted_at IS NULL`
        );
        const totalConversations = parseInt(convResult.rows[0]?.count || '0');

        // Count customer messages (what the bridge processes)
        const msgResult = await pool.query(
            `SELECT COUNT(*) as count 
       FROM conversation_messages 
       WHERE sender_type = 'customer' AND is_internal IS NOT TRUE
       AND conversation_id IN (SELECT id FROM communication_conversations WHERE deleted_at IS NULL)`
        );
        const customerMessages = parseInt(msgResult.rows[0]?.count || '0');

        // Get last 5 customer messages for review
        const lastMsgsResult = await pool.query(
            `SELECT 
        cm.id,
        cm.sender_email,
        cm.sender_name,
        cm.message,
        cm.created_at,
        cc.customer_email,
        cc.subject
       FROM conversation_messages cm
       JOIN communication_conversations cc ON cc.id = cm.conversation_id
       WHERE cm.sender_type = 'customer' AND is_internal IS NOT TRUE
       AND cc.deleted_at IS NULL
       ORDER BY cm.created_at DESC
       LIMIT 5`
        );

        return NextResponse.json({
            success: true,
            bridge: {
                totalConversations,
                customerMessages,
                canBridge: customerMessages > 0,
                lastMessages: lastMsgsResult.rows,
            },
            critical: customerMessages === 0 ? 'NO CUSTOMER MESSAGES IN POSTGRESQL' : 'OK'
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error?.message || 'Unknown error'
        }, { status: 500 });
    }
}
