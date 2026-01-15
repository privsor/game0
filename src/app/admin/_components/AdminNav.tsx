"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/prizes", label: "Prizes" },
  { href: "/admin/gifts", label: "Gifts" },
  { href: "/admin/fako/users", label: "Fako Users" },
  { href: "/admin/fako/prizes", label: "Fako Prizes" },
  { href: "/admin/fako/time", label: "Fako Time" },
  { href: "/admin/fako/impersonate", label: "Impersonate" },
  { href: "/admin/fako/effective", label: "Effective" },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="w-full border-b border-white/10 bg-black/70 backdrop-blur">
      {/* Mobile-first: horizontal scroll tabs */}
      <div className="mx-auto max-w-5xl px-2">
        <div className="flex items-center gap-2 overflow-x-auto py-2 no-scrollbar">
          {links.map((l) => {
            const active = pathname === l.href || pathname?.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={[
                  "whitespace-nowrap rounded-md px-3 py-1.5 text-sm",
                  active
                    ? "bg-white/10 text-white border border-white/15"
                    : "text-white/80 hover:text-white border border-transparent hover:border-white/10",
                ].join(" ")}
              >
                {l.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
