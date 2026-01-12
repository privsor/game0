import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "~/server/db";
import { users, wallets } from "~/server/db/schema";
import { and, eq, or } from "drizzle-orm";
import { auth } from "~/server/auth";
import { env } from "~/env";

const BodySchema = z.object({
  username: z.string().min(1).max(64),
  imageUrl: z.string().url().optional().or(z.literal("")).optional(),
});

export async function POST(req: Request) {
  try {
    // Admin gate (defense-in-depth; also handled by layout/middleware)
    const session = await auth();
    const requesterEmail = session?.user?.email?.toLowerCase() || "";
    const admins = new Set((env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
    if (!requesterEmail || !admins.has(requesterEmail)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const json = await req.json();
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid-input" }, { status: 400 });
    }

    const raw = parsed.data.username.trim();
    const safe = raw.toLowerCase().replace(/\s+/g, "-");
    if (!safe) {
      return NextResponse.json({ error: "empty-username" }, { status: 400 });
    }

    const id = `fako-${safe}`;
    const email = `${safe}@fako.non`;
    const name = raw;
    const image = (parsed.data.imageUrl || "").trim() || null;

    // Disallow duplicates by id or email
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(or(eq(users.id, id), eq(users.email, email)))
      .limit(1);
    if (existing[0]) {
      return NextResponse.json({ error: "user-exists" }, { status: 409 });
    }

    await db.insert(users).values({ id, email, name, image: image || undefined, isFako: true });

    // Ensure wallet exists with default balance 0
    const hasWallet = (
      await db.select().from(wallets).where(eq(wallets.userId, id)).limit(1)
    )[0];
    if (!hasWallet) {
      await db.insert(wallets).values({ userId: id, balance: 0 });
    }

    return NextResponse.json({ ok: true, id, email });
  } catch (err) {
    console.error("/admin/fako/users/create error", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
