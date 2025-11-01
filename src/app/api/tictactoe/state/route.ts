export const revalidate = 0;
export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { getRedis } from "~/server/redis";
import { auth } from "~/server/auth";

function boardStringToArray(b: string) {
  return b.split("").map((c) => (c === '-' ? null : (c as 'X'|'O')));
}

export async function GET(req: Request) {
  try {
    const redis = getRedis();
    const { searchParams } = new URL(req.url);
    const room = (searchParams.get('room') || '').toUpperCase();
    let userId = searchParams.get('userId') || '';
    try {
      const session = await auth();
      if (session?.user?.id) userId = session.user.id;
    } catch {}
    
    if (!room || !userId) {
      return NextResponse.json({ error: 'invalid-input' }, { status: 400 });
    }

    const key = `ttt:room:${room}`;
    const raw = await (redis as any).hmget(key, 'b', 'n', 'w', 't', 'x', 'o', 'xn', 'on', 'xa', 'oa', 'effx', 'effo', 'selx', 'selo', 'claim', 'claimAmount', 'claimWinnerRole', 'claimExpiresAt');
    let hasB = false;
    if (Array.isArray(raw)) {
      hasB = !!raw[0];
    } else if (raw && typeof raw === 'object') {
      hasB = !!(raw as any).b;
    }

    if (!raw || !hasB) {
      // Room doesn't exist, return initial state
      const state = {
        board: Array(9).fill(null),
        next: 'X' as const,
        winner: null as null,
        turn: 0,
        players: { X: null, O: null },
        names: { X: null as string | null, O: null as string | null },
        avatars: { X: null as string | null, O: null as string | null },
      };
      return NextResponse.json({ ok: true, state, userRole: null });
    }
    let b = '---------', next: 'X'|'O' = 'X', w: '-'|'X'|'O'|'D' = '-', turn = 0;
    let px = '', po = '', xn = '', on = '', xa = '', oa = '';
    let effx = '0', effo = '0', selx = '', selo = '';
    let claim = '0', claimAmount = '0', claimWinnerRole = '', claimExpiresAt = '';
    if (Array.isArray(raw)) {
      b = String(raw[0] ?? '---------');
      next = String(raw[1] ?? 'X') as 'X'|'O';
      w = String(raw[2] ?? '-') as '-'|'X'|'O'|'D';
      turn = Number(raw[3] ?? 0);
      px = String(raw[4] ?? '');
      po = String(raw[5] ?? '');
      xn = String(raw[6] ?? '');
      on = String(raw[7] ?? '');
      xa = String(raw[8] ?? '');
      oa = String(raw[9] ?? '');
      effx = String(raw[10] ?? '0');
      effo = String(raw[11] ?? '0');
      selx = String(raw[12] ?? '');
      selo = String(raw[13] ?? '');
      claim = String(raw[14] ?? '0');
      claimAmount = String(raw[15] ?? '0');
      claimWinnerRole = String(raw[16] ?? '');
      claimExpiresAt = String(raw[17] ?? '');
    } else {
      const vals: any = raw;
      b = String(vals.b ?? '---------');
      next = String(vals.n ?? 'X') as 'X'|'O';
      w = String(vals.w ?? '-') as '-'|'X'|'O'|'D';
      turn = Number(vals.t ?? 0);
      px = String(vals.x ?? '');
      po = String(vals.o ?? '');
      xn = String(vals.xn ?? '');
      on = String(vals.on ?? '');
      xa = String(vals.xa ?? '');
      oa = String(vals.oa ?? '');
      effx = String(vals.effx ?? '0');
      effo = String(vals.effo ?? '0');
      selx = String(vals.selx ?? '');
      selo = String(vals.selo ?? '');
      claim = String(vals.claim ?? '0');
      claimAmount = String(vals.claimAmount ?? '0');
      claimWinnerRole = String(vals.claimWinnerRole ?? '');
      claimExpiresAt = String(vals.claimExpiresAt ?? '');
    }

    const state = {
      board: boardStringToArray(b),
      next,
      winner: w === '-' ? null : (w === 'D' ? 'Draw' : (w as 'X'|'O')),
      turn,
      players: { X: px || null, O: po || null },
      names: { X: (xn || null) as string | null, O: (on || null) as string | null },
      avatars: { X: (xa || null) as string | null, O: (oa || null) as string | null },
      coinsMode: { X: effx === '1', O: effo === '1' },
      coinsModePending: { X: selx === 'daddy' && effx !== '1', O: selo === 'daddy' && effo !== '1' },
      claim: claim === '1' ? { amount: Number(claimAmount || '0'), winnerRole: claimWinnerRole || null, expiresAt: claimExpiresAt ? Number(claimExpiresAt) : null } : null,
    };

    const userRole = userId === px ? 'X' : userId === po ? 'O' : null;
    return NextResponse.json({ ok: true, state, userRole }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('/api/tictactoe/state error', err);
    return NextResponse.json({ error: 'server-error' }, { status: 500 });
  }
}
