import { NextRequest, NextResponse } from "next/server";
import { auth } from "~/server/auth";
import { env } from "~/env";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const email = session?.user?.email?.toLowerCase() || "";
    const allow = (env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (!email || !allow.includes(email)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const cookie = req.cookies.get("fakoUserId")?.value || "";
    if (!cookie) return NextResponse.json({ ok: true, impersonating: null });

    const u = (await db.select().from(users).where(eq(users.id, cookie)).limit(1))[0] as any;
    if (!u || !u.isFako) return NextResponse.json({ ok: true, impersonating: null });

    return NextResponse.json({ ok: true, impersonating: { id: u.id, email: u.email, name: u.name, image: u.image } });
  } catch (err) {
    console.error("/admin/fako/effective GET error", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
