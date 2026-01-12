import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "~/server/auth";
import { env } from "~/env";

const Body = z.object({ now: z.string().min(1) }); // ISO string recommended

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const email = session?.user?.email?.toLowerCase() || "";
    const allow = (env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (!email || !allow.includes(email)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const json = await req.json();
    const parsed = Body.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "invalid-input" }, { status: 400 });

    // Validate date
    const d = new Date(parsed.data.now);
    if (Number.isNaN(d.getTime())) return NextResponse.json({ error: "invalid-date" }, { status: 400 });

    const res = NextResponse.json({ ok: true });
    res.cookies.set("fakoNow", d.toISOString(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
    return res;
  } catch (err) {
    console.error("/admin/fako/time POST error", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    const email = session?.user?.email?.toLowerCase() || "";
    const allow = (env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (!email || !allow.includes(email)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const res = NextResponse.json({ ok: true });
    res.cookies.set("fakoNow", "", { httpOnly: true, path: "/", maxAge: 0 });
    return res;
  } catch (err) {
    console.error("/admin/fako/time DELETE error", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
