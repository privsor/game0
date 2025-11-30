import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";
import { eq } from "drizzle-orm";

const RegisterSchema = z.object({
  email: z.string().email().min(3).max(255),
  password: z.string().min(6).max(255),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { email, password } = RegisterSchema.parse(json);
    const normalizedEmail = email.trim().toLowerCase();

    // Disallow duplicate emails
    const existing = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
    if (existing[0]) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    await db.insert(users).values({ email: normalizedEmail, passwordHash });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    console.error("/api/auth/register error", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
