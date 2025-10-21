import { NextResponse } from "next/server";
import Ably from "ably";
import { env } from "~/env";

// Supports both GET (for Ably authUrl) and POST (manual fetch)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId") ?? undefined;

    const rest = new Ably.Rest(env.ABLY_API_KEY);
    const tokenRequest = await rest.auth.createTokenRequest({ clientId });

    return NextResponse.json(tokenRequest, { status: 200 });
  } catch (err) {
    console.error("/api/ably/token GET error", err);
    return NextResponse.json({ error: "Unable to create Ably token request" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({} as any));
    const clientId: string | undefined = body?.clientId;

    const rest = new Ably.Rest(env.ABLY_API_KEY);
    const tokenRequest = await rest.auth.createTokenRequest({ clientId });

    return NextResponse.json(tokenRequest, { status: 200 });
  } catch (err) {
    console.error("/api/ably/token POST error", err);
    return NextResponse.json({ error: "Unable to create Ably token request" }, { status: 500 });
  }
}
