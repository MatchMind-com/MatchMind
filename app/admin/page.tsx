// app/admin/email-subs/page.tsx
//
// Pre-signup email captures from the landing page. Useful for top-of-funnel
// — most landing-page visitors leave their email before they ever sign up.

import { getAdminClient } from "@/lib/admin/server";

type Sub = {
  id: string;
  email: string;
  source: string | null;
  subscribed_at: string;
  unsubscribed_at: string | null;
  is_active: boolean;
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diffH = (Date.now() - d.getTime()) / 36e5;
  if (diffH < 24) return `${Math.round(diffH)}h ago`;
  if (diffH < 24 * 7) return `${Math.round(diffH / 24)}d ago`;
  return d.toISOString().slice(0, 10);
}

export default async function EmailSubsPage() {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("email_subscribers")
    .select("*")
    .order("subscribed_at", { ascending: false })
    .limit(2000);

  if (error) {
    return (
      <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-200">
        Failed to load: {error.message}
      </div>
    );
  }

  const rows = (data ?? []) as Sub[];
  const active = rows.filter((r) => r.is_active);
  const bySource = active.reduce<Record<string, number>>((acc, r) => {
    const k = r.source ?? "(unknown)";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Email captures</h1>
        <p className="text-sm text-neutral-400">
          {active.length} active · {rows.length - active.length} unsubscribed
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {Object.entries(bySource)
          .sort((a, b) => b[1] - a[1])
          .map(([s, n]) => (
            <span
              key={s}
              className="rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1 text-xs"
            >
              {s} · <span className="text-neutral-400">{n}</span>
            </span>
          ))}
      </div>

      <div className="overflow-auto rounded-lg border border-neutral-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-900/60 text-xs uppercase tracking-wide text-neutral-400">
            <tr>
              <th className="px-3 py-2">Subscribed</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-neutral-900/40">
                <td className="whitespace-nowrap px-3 py-2 text-neutral-300">
                  {fmtDate(r.subscribed_at)}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{r.email}</td>
                <td className="px-3 py-2 text-xs">{r.source ?? "—"}</td>
                <td className="px-3 py-2 text-xs">
                  {r.is_active ? (
                    <span className="text-emerald-300">active</span>
                  ) : (
                    <span className="text-neutral-500">unsubscribed</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-10 text-center text-neutral-500">
                  No email captures yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
