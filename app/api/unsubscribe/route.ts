import { NextRequest, NextResponse } from "next/server";
import { recordUnsubscribe } from "@/lib/email/unsubscribe";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const token = typeof body?.token === "string" ? body.token : null;

    if (!token || token.length < 32) {
      return NextResponse.json(
        { success: false, error: "Invalid or missing token" },
        { status: 400 }
      );
    }

    const result = await recordUnsubscribe(token);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.error === "Already unsubscribed" ? 200 : 404 }
      );
    }

    return NextResponse.json({
      success: true,
      email: result.email,
    });
  } catch (error) {
    console.error("Unsubscribe API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token || token.length < 32) {
    return NextResponse.json(
      { success: false, error: "Invalid or missing token" },
      { status: 400 }
    );
  }

  const result = await recordUnsubscribe(token);

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.error === "Already unsubscribed" ? 200 : 404 }
    );
  }

  return NextResponse.json({
    success: true,
    email: result.email,
  });
}
