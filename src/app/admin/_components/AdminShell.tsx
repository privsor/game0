"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/prizes", label: "Prizes" },
  { href: "/admin/gifts", label: "Gifts" },
  {
    label: "Fako",
    children: [
      { href: "/admin/fako/users", label: "Users" },
      { href: "/admin/fako/prizes", label: "Prizes" },
      { href: "/admin/fako/time", label: "Time" },
      { href: "/admin/fako/impersonate", label: "Impersonate" },
      { href: "/admin/fako/effective", label: "Effective" },
    ],
  },
];

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(href + "/");
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the sidebar when route changes to keep UX tidy
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const flatActive = useMemo(() => {
    const items: { href: string; label: string }[] = [];
    for (const item of nav) {
      if ((item as any).href) items.push(item as any);
      if ((item as any).children) items.push(...((item as any).children as any[]));
    }
    return items.find((i) => isActive(pathname, i.href));
  }, [pathname]);

  return (
    <div className="min-h-screen">
      {/* Content renders normally, unaffected by menu */}
      <div className="mx-auto max-w-5xl px-2 py-3">
        {children}
      </div>

      {/* Floating toggle button, always visible above content; hidden when menu open */}
      {!open && (
        <button
          type="button"
          aria-label="Open admin menu"
          onClick={() => setOpen(true)}
          className="fixed bottom-4 left-4 z-[10] inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 p-3 text-white shadow-lg backdrop-blur hover:bg-white/20"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
            <path d="M3.75 6.75h16.5m-16.5 5.25h16.5m-16.5 5.25h16.5" strokeWidth="1.5" stroke="currentColor" strokeLinecap="round" />
          </svg>
        </button>
      )}

      {/* Modal-style overlay side panel; on z-axis above everything */}
      {open && (
        <div className="fixed inset-0 z-[110]" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          {/* Slide-in panel */}
          <div className="absolute right-0 top-0 z-[111] h-full w-[280px] border-l border-white/10 bg-neutral-900/95 backdrop-blur shadow-2xl">
            <div className="flex items-center justify-between px-3 py-3 border-b border-white/10">
              <div className="text-sm text-white/80">{flatActive ? flatActive.label : "Admin"}</div>
              <button
                className="rounded-md border border-white/10 px-2 py-1 text-white/80 hover:text-white hover:bg-white/5"
                onClick={() => setOpen(false)}
                aria-label="Close admin menu"
              >
                ✕
              </button>
            </div>
            <nav className="px-2 py-3 text-sm">
              <div className="flex flex-col gap-1">
                {nav.map((item) => {
                  if ((item as any).href) {
                    const link = item as any as { href: string; label: string };
                    const active = isActive(pathname, link.href);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setOpen(false)}
                        className={[
                          "rounded-md px-3 py-1.5",
                          active
                            ? "bg-white/10 text-white border border-white/15"
                            : "text-white/80 hover:text-white border border-transparent hover:border-white/10",
                        ].join(" ")}
                      >
                        {link.label}
                      </Link>
                    );
                  }

                  const section = item as any as { label: string; children: { href: string; label: string }[] };
                  return (
                    <div key={section.label} className="mt-2">
                      <div className="px-2 pb-1 text-xs uppercase tracking-wide text-white/40">{section.label}</div>
                      <div className="flex flex-col gap-1">
                        {section.children.map((c) => {
                          const active = isActive(pathname, c.href);
                          return (
                            <Link
                              key={c.href}
                              href={c.href}
                              onClick={() => setOpen(false)}
                              className={[
                                "rounded-md px-3 py-1.5",
                                active
                                  ? "bg-white/10 text-white border border-white/15"
                                  : "text-white/80 hover:text-white border border-transparent hover:border-white/10",
                              ].join(" ")}
                            >
                              {c.label}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
