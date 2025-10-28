import { auth } from "~/server/auth";
import { getRedis } from "~/server/redis";
import { notFound } from "next/navigation";
import GameClientNew from "../GameClientNew";

export const revalidate = 0;
export const dynamic = 'force-dynamic';

// Server component for /tictactoe-new/[roomid]
// - If an authenticated user opens the page and the room is empty, we initialize
//   the room server-side assigning them as X (creator) without broadcasting.
// - Guests will initialize via the existing /api/tictactoe/join flow on the client.
export default async function Page({ params }: { params: { roomid: string } }) {
  const room = String(params.roomid || "").toUpperCase();
  if (!room || room.length > 12) return notFound();

  const session = await auth();
  const redis = getRedis();
  const key = `ttt:room:${room}`;

  // Ensure base room structure exists (24h TTL)
  const exists = await (redis as any).exists(key);
  if (!exists) {
    await (redis as any).hmset(key, {
      b: "---------",
      n: "X",
      w: "-",
      t: 0,
      x: "",
      o: "",
      xn: "",
      on: "",
      xa: "",
      oa: "",
      u: String(Date.now()),
    });
    await (redis as any).pexpire(key, 24 * 60 * 60 * 1000);
  }

  // If authenticated creator opens and X empty, assign them as X without Ably publish
  if (session?.user?.id) {
    const vals = await (redis as any).hmget(key, "x", "o", "xn", "on", "xa", "oa");
    const px = String(vals.x || "");
    const po = String(vals.o || "");
    if (!px && session.user.id) {
      const updates: Record<string, string> = {
        x: session.user.id,
        xn: session.user.name || "",
        xa: session.user.image || "",
        u: String(Date.now()),
      };
      await (redis as any).hmset(key, updates);
      await (redis as any).pexpire(key, 24 * 60 * 60 * 1000);
    }
  }

  // Read minimal initial state for hydration
  const vals = await (redis as any).hmget(key, "b", "n", "w", "t", "x", "o", "xn", "on", "xa", "oa");
  const initial = {
    board: String(vals.b || "---------"),
    next: String(vals.n || "X"),
    winner: String(vals.w || "-"),
    turn: Number(vals.t || 0),
    players: { X: String(vals.x || "") || null, O: String(vals.o || "") || null },
    names: { X: String(vals.xn || "") || null, O: String(vals.on || "") || null },
    avatars: { X: String(vals.xa || "") || null, O: String(vals.oa || "") || null },
  } as const;

  const user = session?.user
    ? { id: session.user.id, name: session.user.name || null, image: session.user.image || null }
    : null;

  return (
    <div className="min-h-screen">
      <GameClientNew roomCode={room} user={user} initial={initial} />
    </div>
  );
}
