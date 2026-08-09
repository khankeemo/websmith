import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/backend-db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({
      success: false,
      error: { code: 'INVALID_BODY', message: 'Invalid request body.' }
    }, { status: 400 });
  }

  const imap_host = String(body.imap_host || '');
  const imap_port = Number(body.imap_port || 993);
  const imap_secure = body.imap_secure !== false;
  const imap_username = String(body.imap_username || '');
  const imap_password = String(body.imap_password || '');
  const smtp_host = String(body.smtp_host || '');
  const smtp_port = Number(body.smtp_port || 465);
  const smtp_secure = body.smtp_secure !== false;
  const smtp_username = String(body.smtp_username || '');
  const smtp_password = String(body.smtp_password || '');

  // One or both sides may be tested. A side is tested when all of its
  // required fields are present (Test Incoming / Test Outgoing from the UI),
  // and both sides are tested together when the full payload is supplied
  // (Test Connection + save-time verification).
  const testImapSide = !!(imap_host && imap_username && imap_password);
  const testSmtpSide = !!(smtp_host && smtp_username && smtp_password);

  if (!testImapSide && !testSmtpSide) {
    return NextResponse.json({
      success: false,
      error: { code: 'MISSING_FIELDS', message: 'Connection verification requires imap_host, imap_username, imap_password, smtp_host, smtp_username and smtp_password.' }
    }, { status: 400 });
  }

  const testImap = async () => {
    try {
      const Imap = (await import('imap')).default;
      await new Promise<void>((resolve, reject) => {
        const imap = new Imap({
          host: imap_host,
          port: imap_port,
          tls: imap_secure,
          tlsOptions: { rejectUnauthorized: false },
          user: imap_username,
          password: imap_password,
          connTimeout: 10000,
          authTimeout: 10000,
        });
        imap.once('ready', () => { imap.end(); resolve(); });
        imap.once('error', (err: Error) => reject(err));
        imap.connect();
      });
      return { connected: true, error: '' };
    } catch (err: any) {
      return { connected: false, error: err?.message || 'IMAP connection failed' };
    }
  };

  const testSmtp = async () => {
    try {
      const nodemailer = (await import('nodemailer')).default;
      const transporter = nodemailer.createTransport({
        host: smtp_host,
        port: smtp_port,
        secure: smtp_secure,
        auth: { user: smtp_username, pass: smtp_password },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 10000,
      });
      await transporter.verify();
      return { connected: true, error: '' };
    } catch (err: any) {
      return { connected: false, error: err?.message || 'SMTP connection failed' };
    }
  };

  let client = null;
  try {
    const [imap, smtp] = await Promise.all([
      testImapSide ? testImap() : Promise.resolve(null),
      testSmtpSide ? testSmtp() : Promise.resolve(null),
    ]);

    const auditParts: string[] = [];
    if (imap) auditParts.push(`IMAP=${imap.connected ? 'ok' : 'fail'}`);
    if (smtp) auditParts.push(`SMTP=${smtp.connected ? 'ok' : 'fail'}`);

    try {
      client = await (await getDb()).connect();
      await client.query(
        `INSERT INTO audit_logs (event_type, message, timestamp)
         VALUES ($1, $2, $3)`,
        ['mailbox_connection_test', `Connection verification for ${imap_username}: ${auditParts.join(', ')}`, new Date().toISOString()]
      );
    } catch {}

    if (client) { client.release(); }

    const data: any = {};
    if (imap) data.imap = { connected: imap.connected, error: imap.error };
    if (smtp) data.smtp = { connected: smtp.connected, error: smtp.error };
    if (imap && smtp) data.overall = (imap.connected && smtp.connected) ? 'connected' : 'failed';

    return NextResponse.json({
      success: true,
      data,
    });

  } catch (error: any) {
    console.error('Mailbox test-connection error:', error);
    if (client) { client.release(); }
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to verify connection.' }
    }, { status: 500 });
  }
}
