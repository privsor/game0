import type { ReactNode } from "react";
import { auth } from "~/server/auth";
import { redirect } from "next/navigation";
import AdminShell from "./_components/AdminShell";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseAdmins() {
  const raw = process.env.ADMIN_EMAILS || "";
  return new Set(raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admins = parseAdmins();
  // Deny when no admins configured
  if (admins.size === 0) {
    redirect("/");
  }

  try {
    const session = await auth();
    const email = session?.user?.email?.toLowerCase() || "";
    if (!email || !admins.has(email)) {
      redirect("/");
    }
  } catch {
    redirect("/");
  }

  return (
    <AdminShell>
      {children}
    </AdminShell>
  );
}
