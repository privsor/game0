import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { env } from "~/env";

function parseAdminEmails(): Set<string> {
  const raw = env.ADMIN_EMAILS || "";
  const list = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return new Set(list);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  const admins = parseAdminEmails();
  // If no admins configured, deny all admin access by default
  if (admins.size === 0) {
    return handleDeny(req);
  }

  try {
    // Use NextAuth JWT to read token in middleware (edge-compatible)
    const token = await getToken({ req, secret: env.AUTH_SECRET });
    const email = (token?.email || "").toLowerCase();
    if (email && admins.has(email)) {
      return NextResponse.next();
    }
  } catch {
    // fallthrough to deny
  }

  return handleDeny(req);
}

function handleDeny(req: NextRequest) {
  const accept = req.headers.get("accept") || "";
  if (accept.includes("application/json") || req.nextUrl.pathname.endsWith("/create")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/";
  url.searchParams.set("error", "admin_only");
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*"],
};
