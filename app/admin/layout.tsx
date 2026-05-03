// app/admin/layout.tsx
//
// Server-rendered admin layout. Every child page in /admin renders inside
// this — so the auth gate runs once per navigation and non-admins never see
// any admin content.

import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/server";

export const dynamic = "force-dynamic";       // never cache admin pages
export const revalidate = 0;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const result = await requireAdmin();

  if (!result.ok) {
    if (result.reason === "not_signed_in") {
      redirect("/login?next=/admin");
    }
    // Logged in but not whitelisted — send them home.
    redirect("/?error=not_admin");
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 bg-neutral-900/60 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="font-semibold tracking-tight">
              MatchMind <span className="text-neutral-400">/ admin</span>
            </Link>
            <nav className="flex gap-4 text-sm text-neutral-300">
              <Link href="/admin" className="hover:text-white">Signups</Link>
              <Link href="/admin/email-subs" className="hover:text-white">Email captures</Link>
            </nav>
          </div>
          <div className="text-xs text-neutral-400">{result.user.email}</div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
    </div>
  );
}
