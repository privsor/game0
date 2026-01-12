import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "~/server/auth";
import { env } from "~/env";

const Body = z.object({
  id: z.string().min(1),
  name: z.string().max(255).optional(),
  image: z.string().url().max(2048).optional().or(z.literal("")).optional(),
});

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    const email = session?.user?.email?.toLowerCase() || "";
    const admins = new Set((env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
    if (!email || !admins.has(email)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const json = await req.json();
    const parsed = Body.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "invalid-input" }, { status: 400 });

    const { id, name, image } = parsed.data;

    // Only allow editing fako users
    const target = (
      await db.select().from(users).where(eq(users.id, id)).limit(1)
    )[0];
    if (!target || !target.isFako) {
      return NextResponse.json({ error: "not-fako" }, { status: 400 });
    }

    const values: Partial<typeof users.$inferInsert> = {};
    if (typeof name === "string") values.name = name;
    if (typeof image !== "undefined") values.image = image || null as any;

    if (Object.keys(values).length === 0) {
      return NextResponse.json({ ok: true });
    }

    await db.update(users).set(values).where(eq(users.id, id));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("/admin/fako/users/update error", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
