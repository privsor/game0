import { env } from "~/env";

export function isAdminEmail(email?: string | null) {
  if (!email) return false;
  const raw = env.ADMIN_EMAILS ?? process.env.ADMIN_EMAILS ?? "";
  const list = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}
