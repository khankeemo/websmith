import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let client = null;
  try {
    const { id } = await params;
    if (!id || !id.includes("@")) {
      return NextResponse.json({ success: false, error: "Valid customer email is required" }, { status: 400 });
    }
    const email = decodeURIComponent(id).toLowerCase().trim();
    const searchParams = request.nextUrl.searchParams;
    const selectedTrialId = searchParams.get("trial_id");

    client = await pool.connect();

    const customerRes = await client.query(`SELECT * FROM customers WHERE email = $1`, [email]);
    const customerRow = customerRes.rows[0] || {};

    const allTrialsRes = await client.query(
      `SELECT t.*, p.name as product_name, pl.name as plan_name
       FROM trials t
       LEFT JOIN products p ON t.product_id = p.product_id
       LEFT JOIN plans pl ON t.plan_id = pl.id
       WHERE t.customer_email = $1
       ORDER BY t.started_at DESC`,
      [email]
    );
    const allTrials = allTrialsRes.rows;

    let trial = null;
    if (selectedTrialId) {
      trial = allTrials.find(t => t.id === parseInt(selectedTrialId)) || allTrials[0] || null;
    } else {
      trial = allTrials[0] || null;
    }

    let journey: any[] = [];
    if (trial) {
      const journeyRes = await client.query(
        `SELECT event_type, message, timestamp, ip_address, COALESCE(metadata, '{}') as metadata
         FROM trial_audit_logs WHERE trial_id = $1 ORDER BY timestamp ASC`,
        [trial.id]
      );
      journey = journeyRes.rows;
    }

    client.release();

    const totalTrials = allTrials.length;
    const activeTrials = allTrials.filter(t => t.status === "active").length;
    const convertedTrials = allTrials.filter(t => t.status === "converted").length;
    const expiredTrials = allTrials.filter(t => t.status === "expired").length;

    return NextResponse.json({
      success: true,
      customer: {
        id: email,
        name: customerRow.name || trial?.customer_name || "Unknown",
        email,
        phone: customerRow.phone || "",
        created_at: customerRow.created_at || trial?.started_at || new Date().toISOString(),
      },
      trial: trial ? {
        id: trial.id,
        hardware_id: trial.hardware_id,
        status: trial.status,
        started_at: trial.started_at,
        expiry_date: trial.expiry_date,
        days_left: Math.max(0, Math.ceil((new Date(trial.expiry_date).getTime() - Date.now()) / 86400000)),
        days_active: Math.max(1, Math.ceil((Date.now() - new Date(trial.started_at).getTime()) / 86400000)),
        product_id: trial.product_id,
        product_name: trial.product_name || "Unknown Product",
        plan_id: trial.plan_id,
        plan_name: trial.plan_name || "Unknown Plan",
        customer_name: trial.customer_name,
        customer_email: trial.customer_email,
        mobile_number: trial.mobile_number,
        ip_address: trial.ip_address,
        software_version: trial.software_version,
        os_info: trial.os_info,
        installation_timestamp: trial.installation_timestamp,
        converted_at: trial.converted_at,
        converted_to_license_key: trial.converted_to_license_key,
        device_hash: trial.device_hash,
        cpu_id: trial.cpu_id,
        motherboard_id: trial.motherboard_id,
      } : null,
      journey,
      all_trials: allTrials,
      summary: {
        total_trials: totalTrials,
        active_trials: activeTrials,
        converted_trials: convertedTrials,
        expired_trials: expiredTrials,
        total_events: journey.length,
      },
    });

  } catch (error) {
    console.error("Customer journey error:", error);
    if (client) client.release();
    return NextResponse.json({ success: false, error: "Failed to fetch customer journey" }, { status: 500 });
  }
}
