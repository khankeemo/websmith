import { NextResponse } from 'next/server';
import { COUNTRY_CODES } from '@/lib/data/country-codes';

export async function GET() {
  return NextResponse.json({
    success: true,
    data: COUNTRY_CODES,
  });
}
