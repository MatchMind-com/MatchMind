// app/admin/page.tsx
//
// Phase 1 dashboard. Sections, top to bottom:
//   1. Live now strip — users active in the last 5 minutes
//   2. Top 10 power users — most engaged accounts
//   3. TikTok video scoreboard — signups grouped by utm_content
//   4. Stripped signups table — email, source, paid?, country, device,
//      time-on-site, last seen
//
// Server component. Fetches via service_role. Renders client table for
// interactivity.

import { getAdminClient } from "@/lib/admin/server";
import { SignupsTable, type SignupRow } from "./signups-table";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Search = { source?: string; days?: string };

function fmtDuration(seconds: number | null): string {
  if (!seconds) return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const h = (Date.now() - d.getTime()) / 36e5;
  if (h < 1 / 60) return "just now";
  if (h < 1) return `${Math.round(h * 60)}m ago`;
  if (h < 24) return `${Math.round(h)}h ago`;
  if (h < 24 * 7) return `${Math.round(h / 24)}d ago`;
  return d.toISOString().slice(0, 10);
}

export default async function AdminPage({ searchParams }: { searchParams: Search }) {
  const days = Number(searchParams.days ?? 90);
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const supabase = getAdminClient();

  // One query per section keeps things readable. All hit the same view.
  const [signupsRes, liveRes, powerRes, tiktokRes] = await Promise.all([
    (() => {
      let q = supabase
        .from("admin_signup_view")
        .select("*")
        .gte("signed_up_at", since)
        .order("signed_up_at", { ascending: false })
        .limit(2000);
      if (searchParams.source) q = q.eq("signup_source", searchParams.source);
      return q;
    })(),
    supabase
      .from("admin_signup_view")
      .select("id, email, signup_source, last_active_at, country, device_class")
      .gte("last_active_at", new Date(Date.now() - 5 * 60_000).toISOString())
      .order("last_active_at", { ascending: false })
      .limit(20),
    supabase
      .from("admin_signup_view")
      .select("id, email, signup_source, total_seconds_active, session_count, bet_count, country")
      .gt("total_seconds_active", 0)
      .order("total_seconds_active", { ascending: false })
      .limit(10),
    supabase
      .from("admin_signup_view")
      .select("utm_content, utm_medium, signup_source")
      .eq("signup_source", "tiktok")
      .gte("signed_up_at", since),
  ]);

  if (signupsRes.error) {
    return (
      <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-200">
        <div className="font-medium">Failed to load signups</div>
        <div className="mt-1 text-red-300/80">{signupsRes.error.message}</div>
        <div className="mt-2 text-xs text-red-300/60">
          Did you run <code>supabase/admin-attribution.sql</code> yet?
        </div>
      </div>
    );
  }

  const rows = (signupsRes.data ?? []) as SignupRow[];
  const live = liveRes.data ?? [];
  const power = powerRes.data ?? [];

  // Aggregate TikTok rows into a per-video leaderboard.
  const tiktokAgg = new Map<string, { signups: number; paid: number }>();
  for (const r of tiktokRes.data ?? []) {
    const key = r.utm_content || "(untagged)";
    const cur = tiktokAgg.get(key) || { signups: 0, paid: 0 };
    cur.signups += 1;
    if ((r.utm_medium ?? "").toLowerCase() === "paid") cur.paid += 1;
    tiktokAgg.set(key, cur);
  }
  const tiktokRanked = Array.from(tiktokAgg.entries())
    .sort((a, b) => b[1].signups - a[1].signups)
    .slice(0, 10);

  // Source pills for the table filter.
  const sourceCounts = rows.reduce<Record<string, number>>((acc, r) => {
    const k = r.signup_source ?? "(unknown)";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const topSources = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]);

  const totalSignups = rows.length;
  const paidSignups = rows.filter((r) => r.is_paid_acquisition).length;
  const proSignups = rows.filter((r) => r.is_pro).length;

  return (
    <div className="space-y-8">
      {/* ── 1. Live now ─────────────────────────────────────────── */}
      <section>
        <SectionHead
          title="Live now"
          subtitle={`${live.length} ${live.length === 1 ? "user" : "users"} active in the last 5 minutes`}
        />
        {live.length === 0 ? (
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-4 py-6 text-sm text-neutral-500">
            Nobody's on the site right now.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {live.map((u) => (
              <div
                key={u.id}
                className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                  <span className="truncate font-mono text-xs text-emerald-100">{u.email}</span>
                </div>
                <div className="mt-1 text-[11px] text-emerald-300/70">
                  {u.signup_source ?? "—"} · {u.country ?? "??"} · {u.device_class ?? "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── 2. Top 10 power users ───────────────────────────────── */}
      <section>
        <SectionHead title="Top 10 power users" subtitle="The people most worth DM'ing" />
        {power.length === 0 ? (
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-4 py-6 text-sm text-neutral-500">
            No engagement data yet — the heartbeat starts filling this in once the page is deployed.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-neutral-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-900/60 text-xs uppercase tracking-wide text-neutral-400">
                <tr>
                  <th className="w-10 px-3 py-2">#</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Time on site</th>
                  <th className="px-3 py-2">Sessions</th>
                  <th className="px-3 py-2">Bets logged</th>
                  <th className="px-3 py-2">Country</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {power.map((u, i) => (
                  <tr key={u.id} className="hover:bg-neutral-900/40">
                    <td className="px-3 py-2 text-neutral-400">{i + 1}</td>
                    <td className="px-3 py-2 font-mono text-xs">{u.email}</td>
                    <td className="px-3 py-2">
                      <Pill>{u.signup_source ?? "—"}</Pill>
                    </td>
                    <td className="px-3 py-2 text-neutral-200">
                      {fmtDuration(u.total_seconds_active)}
                    </td>
                    <td className="px-3 py-2 text-neutral-300">{u.session_count ?? 0}</td>
                    <td className="px-3 py-2 text-neutral-300">{u.bet_count ?? 0}</td>
                    <td className="px-3 py-2 text-xs text-neutral-400">{u.country ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── 3. TikTok video scoreboard ──────────────────────────── */}
      <section>
        <SectionHead
          title="TikTok video scoreboard"
          subtitle="Tag bio links with ?utm_content=v23 (or video id) to populate this"
        />
        {tiktokRanked.length === 0 ? (
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-4 py-6 text-sm text-neutral-500">
            No tagged TikTok signups yet. Once you start using <code>?utm_content=...</code>, they'll
            rank here.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-neutral-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-900/60 text-xs uppercase tracking-wide text-neutral-400">
                <tr>
                  <th className="w-10 px-3 py-2">#</th>
                  <th className="px-3 py-2">utm_content</th>
                  <th className="px-3 py-2">Signups</th>
                  <th className="px-3 py-2">Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {tiktokRanked.map(([k, v], i) => (
                  <tr key={k} className="hover:bg-neutral-900/40">
                    <td className="px-3 py-2 text-neutral-400">{i + 1}</td>
                    <td className="px-3 py-2 font-mono text-xs">{k}</td>
                    <td className="px-3 py-2 font-medium">{v.signups}</td>
                    <td className="px-3 py-2 text-xs text-amber-300">
                      {v.paid > 0 ? `💰 ${v.paid}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── 4. Stripped signups table ───────────────────────────── */}
      <section>
        <SectionHead
          title="Signups"
          subtitle={`Last ${days} days · ${totalSignups} users · ${paidSignups} from paid ads · ${proSignups} on Pro`}
        />
        <div className="mb-3 flex flex-wrap gap-2">
          {topSources.map(([source, count]) => (
            <a
              key={source}
              href={`/admin?source=${encodeURIComponent(source)}&days=${days}`}
              className={`rounded-full border px-3 py-1 text-xs ${
                searchParams.source === source
                  ? "border-neutral-100 bg-neutral-100 text-neutral-900"
                  : "border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800"
              }`}
            >
              {source} · <span className="opacity-70">{count}</span>
            </a>
          ))}
          {searchParams.source && (
            <a
              href={`/admin?days=${days}`}
              className="rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
            >
              clear ×
            </a>
          )}
        </div>
        <SignupsTable rows={rows} fmtDuration={fmtDuration} fmtRelative={fmtRelative} />
      </section>
    </div>
  );
}

function SectionHead({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="text-xs text-neutral-400">{subtitle}</p>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-[11px] text-neutral-200">
      {children}
    </span>
  );
}
