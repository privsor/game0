import { NextResponse } from "next/server";
import { getRedis } from "~/server/redis";

function boardStringToArray(b: string) {
  return b.split("").map((c) => (c === '-' ? null : (c as 'X'|'O')));
}

export async function GET(req: Request) {
  try {
    const redis = getRedis();
    const { searchParams } = new URL(req.url);
    const room = (searchParams.get('room') || '').toUpperCase();
    const userId = searchParams.get('userId') || '';
    
    if (!room || !userId) {
      return NextResponse.json({ error: 'invalid-input' }, { status: 400 });
    }

    const key = `ttt:room:${room}`;
    const vals = await (redis as any).hmget(key, 'b', 'n', 'w', 't', 'x', 'o', 'xn', 'on');
    
    if (!vals || !vals.b) {
      // Room doesn't exist, return initial state
      const state = {
        board: Array(9).fill(null),
        next: 'X' as const,
        winner: null as null,
        turn: 0,
        players: { X: null, O: null },
        names: { X: null as string | null, O: null as string | null },
      };
      return NextResponse.json({ ok: true, state, userRole: null });
    }

    const b = String(vals.b ?? '---------');
    const next = String(vals.n ?? 'X') as 'X'|'O';
    const w = String(vals.w ?? '-') as '-'|'X'|'O'|'D';
    const turn = Number(vals.t ?? 0);
    const px = (vals.x ?? '') as string;
    const po = (vals.o ?? '') as string;
    const xn = (vals.xn ?? '') as string;
    const on = (vals.on ?? '') as string;

    const state = {
      board: boardStringToArray(b),
      next,
      winner: w === '-' ? null : (w === 'D' ? 'Draw' : (w as 'X'|'O')),
      turn,
      players: { X: px || null, O: po || null },
      names: { X: (xn || null) as string | null, O: (on || null) as string | null },
    };

    const userRole = userId === px ? 'X' : userId === po ? 'O' : null;
    return NextResponse.json({ ok: true, state, userRole });
  } catch (err) {
    console.error('/api/tictactoe/state error', err);
    return NextResponse.json({ error: 'server-error' }, { status: 500 });
  }
}
