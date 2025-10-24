import { NextResponse } from "next/server";
import Ably from "ably";
import { getRedis } from "~/server/redis";
import { env } from "~/env";

const INITIAL_BOARD = "---------";

export async function POST(req: Request) {
  try {
    const redis = getRedis();
    const body = await req.json();
    const room: string = (body?.room || '').toUpperCase();
    const userId: string = body?.userId || '';
    if (!room || !userId) {
      return NextResponse.json({ error: 'invalid-input' }, { status: 400 });
    }

    const key = `ttt:room:${room}`;
    const now = Date.now();

    // Only allow reset by a participant (X or O)
    const vals = await (redis as any).hmget(key, 'x', 'o', 'xn', 'on');
    const px = (Array.isArray(vals) && vals[0] ? String(vals[0]) : '');
    const po = (Array.isArray(vals) && vals[1] ? String(vals[1]) : '');
    const xn = (Array.isArray(vals) && vals[2] ? String(vals[2]) : '');
    const on = (Array.isArray(vals) && vals[3] ? String(vals[3]) : '');
    if (px && px !== userId && po && po !== userId) {
      return NextResponse.json({ error: 'not-player' }, { status: 403 });
    }

    await redis.hmset(key, {
      b: INITIAL_BOARD,
      n: 'X',
      w: '-',
      t: 0,
      u: String(now),
    });
    // Keep TTL (do not change)

    const state = {
      board: Array.from(INITIAL_BOARD).map(() => null as null),
      next: 'X' as const,
      winner: null as null,
      turn: 0,
      players: { X: px || null, O: po || null },
      names: { X: (xn || null) as string | null, O: (on || null) as string | null },
    };

    const rest = new Ably.Rest(env.ABLY_API_KEY);
    await rest.channels.get(`room-${room}`).publish('state', { type: 'state', state });

    // Determine user's role for client
    const userRole = userId === px ? 'X' : userId === po ? 'O' : null;
    return NextResponse.json({ ok: true, state, userRole });
  } catch (err) {
    console.error('/api/tictactoe/reset error', err);
    return NextResponse.json({ error: 'server-error' }, { status: 500 });
  }
}
