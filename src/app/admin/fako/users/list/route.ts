import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "~/server/auth";
import { env } from "~/env";

export async function GET() {
  try {
    const session = await auth();
    const email = session?.user?.email?.toLowerCase() || "";
    const admins = new Set((env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
    if (!email || !admins.has(email)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const rows = await db
      .select({ id: users.id, name: users.name, email: users.email, image: users.image })
      .from(users)
      .where(eq(users.isFako, true));

    return NextResponse.json({ ok: true, users: rows });
  } catch (err) {
    console.error("/admin/fako/users/list error", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
