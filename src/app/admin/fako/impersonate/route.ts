import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "~/server/auth";
import { env } from "~/env";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";
import { eq } from "drizzle-orm";

const Body = z.object({ userId: z.string().min(1) });

export async function POST(req: NextRequest) {
  // Set fakoUserId cookie (admin only)
  try {
    const session = await auth();
    const email = session?.user?.email?.toLowerCase() || "";
    const allow = (env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (!email || !allow.includes(email)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const json = await req.json();
    const parsed = Body.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "invalid-input" }, { status: 400 });

    const target = (
      await db.select().from(users).where(eq(users.id, parsed.data.userId)).limit(1)
    )[0] as any;
    if (!target || !target.isFako) return NextResponse.json({ error: "not-fako" }, { status: 400 });

    const res = NextResponse.json({ ok: true });
    res.cookies.set("fakoUserId", parsed.data.userId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (err) {
    console.error("/admin/fako/impersonate POST error", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  // Clear cookie (admin only)
  try {
    const session = await auth();
    const email = session?.user?.email?.toLowerCase() || "";
    const allow = (env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (!email || !allow.includes(email)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const res = NextResponse.json({ ok: true });
    res.cookies.set("fakoUserId", "", { httpOnly: true, path: "/", maxAge: 0 });
    return res;
  } catch (err) {
    console.error("/admin/fako/impersonate DELETE error", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
