import { NextResponse } from "next/server";
import Ably from "ably";
import { getRedis } from "~/server/redis";
import { env } from "~/env";
import { auth } from "~/server/auth";

// Join contract:
// POST /api/tictactoe/join
// body: { room: string, userId: string, name?: string, preferredRole?: 'X'|'O'|'auto' }
// behavior:
// - Creates room if missing
// - Assigns role X/O according to preferredRole and availability; if both taken and not this user, spectator
// - Updates name for existing role holder on rejoin
// - Returns { ok, state, userRole }

function boardStringToArray(b: string) {
  return b.split("").map((c) => (c === '-' ? null : (c as 'X'|'O')));
}

export async function POST(req: Request) {
  try {
    const redis = getRedis();
    const body = await req.json();
    const room: string = String(body?.room || '').toUpperCase();
    let userId: string = String(body?.userId || '');
    let name: string = String(body?.name || '').trim();
    const preferredRole: 'X'|'O'|'auto' = (body?.preferredRole === 'X' || body?.preferredRole === 'O') ? body.preferredRole : 'auto';

    // If a NextAuth session exists, prefer the authenticated identity
    let session = null;
    try {
      session = await auth();
      if (session?.user?.id) {
        userId = session.user.id;
        // Force the account display name when available to ensure consistency
        if (session.user.name) name = session.user.name;
      }
    } catch {}

    if (!room || !userId) {
      return NextResponse.json({ error: 'invalid-input' }, { status: 400 });
    }

    const key = `ttt:room:${room}`;

    // Initialize room if not present
    const exists = await (redis as any).exists(key);
    if (!exists) {
      await (redis as any).hmset(key, {
        b: '---------',
        n: 'X',
        w: '-',
        t: 0,
        x: '',
        o: '',
        xn: '',
        on: '',
        u: String(Date.now()),
      });
      // 24h TTL
      await (redis as any).pexpire(key, 24 * 60 * 60 * 1000);
    }

    // Read current state
    const vals = await (redis as any).hmget(key, 'b','n','w','t','x','o','xn','on','xa','oa');
    let b = String(vals.b ?? '---------');
    let n = String(vals.n ?? 'X') as 'X'|'O';
    let w = String(vals.w ?? '-') as '-'|'X'|'O'|'D';
    let t = Number(vals.t ?? 0);
    let px = String(vals.x ?? '');
    let po = String(vals.o ?? '');
    let xn = String(vals.xn ?? '');
    let on = String(vals.on ?? '');
    let xa = String(vals.xa ?? '');
    let oa = String(vals.oa ?? '');

    // If the user already holds a role, reaffirm and optionally update name
    let assignedRole: 'X'|'O'|null = null;
    if (px && userId === px) {
      assignedRole = 'X';
      if (name) xn = name;
      if (body?.avatar || true) {
        // Prefer session avatar when available; fall back to provided body.avatar if any
        const img = (session?.user?.image || body?.avatar || '').trim();
        if (img) xa = img;
      }
    } else if (po && userId === po) {
      assignedRole = 'O';
      if (name) on = name;
      if (body?.avatar || true) {
        const img = (session?.user?.image || body?.avatar || '').trim();
        if (img) oa = img;
      }
    } else {
      // Try to assign based on preference
      const wantX = preferredRole === 'X' || preferredRole === 'auto';
      const wantO = preferredRole === 'O' || preferredRole === 'auto';

      if (!px && wantX) {
        px = userId; assignedRole = 'X'; xn = name || xn;
        const img = (session?.user?.image || body?.avatar || '').trim();
        if (img) xa = img;
      } else if (!po && wantO) {
        po = userId; assignedRole = 'O'; on = name || on;
        const img = (session?.user?.image || body?.avatar || '').trim();
        if (img) oa = img;
      } else if (!po && preferredRole === 'auto') {
        // If X was taken and O free in auto mode
        po = userId; assignedRole = 'O'; on = name || on;
        const img = (session?.user?.image || body?.avatar || '').trim();
        if (img) oa = img;
      } else {
        assignedRole = null; // spectator
      }
    }

    // Persist updates
    const updates: Record<string,string> = { u: String(Date.now()) };
    if (assignedRole === 'X') { updates['x'] = px; updates['xn'] = xn; if (xa !== undefined) updates['xa'] = xa; }
    if (assignedRole === 'O') { updates['o'] = po; updates['on'] = on; if (oa !== undefined) updates['oa'] = oa; }
    if (Object.keys(updates).length) {
      await (redis as any).hmset(key, updates);
      await (redis as any).pexpire(key, 24 * 60 * 60 * 1000);
    }

    const state = {
      board: boardStringToArray(b),
      next: n,
      winner: w === '-' ? null : (w === 'D' ? 'Draw' : (w as 'X'|'O')),
      turn: t,
      players: { X: px || null, O: po || null },
      names: { X: xn || null, O: on || null },
      avatars: { X: (xa || null) as string | null, O: (oa || null) as string | null },
    } as const;

    // Publish state so UIs show names/roles immediately
    // On serverless platforms (e.g., Vercel) background work may be cancelled after returning.
    // Await the publish to guarantee delivery before the function ends.
    try {
      const rest = new Ably.Rest(env.ABLY_API_KEY);
      await rest.channels.get(`room-${room}`).publish('state', { type: 'state', state });
    } catch {}

    return NextResponse.json({ ok: true, state, userRole: assignedRole });
  } catch (err) {
    console.error('/api/tictactoe/join error', err);
    return NextResponse.json({ error: 'server-error' }, { status: 500 });
  }
}
