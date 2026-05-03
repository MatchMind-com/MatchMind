"use client";

// app/admin/signups-table.tsx
//
// Stripped table — just the columns Alp asked for, plus country + device
// for free since the data is already there. All sorting/searching is
// client-side; data is passed in from the server component.

import { useMemo, useState } from "react";

export type SignupRow = {
  id: string;
  email: string | null;
  signed_up_at: string;
  last_active_at: string | null;
  signup_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  is_paid_acquisition: boolean | null;
  is_pro: boolean | null;
  subscription_tier: string | null;
  subscription_status: string | null;
  country: string | null;
  device_class: string | null;
  total_seconds_active: number | null;
  session_count: number | null;
  bet_count: number | null;
};

type SortKey = "signed_up_at" | "total_seconds_active" | "last_active_at";

export function SignupsTable({
  rows,
  fmtDuration,
  fmtRelative,
}: {
  rows: SignupRow[];
  fmtDuration: (s: number | null) => string;
  fmtRelative: (iso: string | null) => string;
}) {
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("signed_up_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    let r = rows;
    if (ql) {
      r = r.filter((row) =>
        [row.email, row.signup_source, row.utm_campaign, row.utm_content, row.country]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(ql)
      );
    }
    return [...r].sort((a, b) => {
      const av = (a[sortKey] ?? 0) as number | string;
      const bv = (b[sortKey] ?? 0) as number | string;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, q, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  }

  function arrow(k: SortKey) {
    if (k !== sortKey) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search email, country, campaign, video tag…"
          className="w-96 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm placeholder-neutral-500 focus:border-neutral-500 focus:outline-none"
        />
        <span className="text-xs text-neutral-500">
          {filtered.length} of {rows.length}
        </span>
      </div>

      <div className="overflow-auto rounded-lg border border-neutral-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-900/60 text-xs uppercase tracking-wide text-neutral-400">
            <tr>
              <Th onClick={() => toggleSort("signed_up_at")}>
                Signed up{arrow("signed_up_at")}
              </Th>
              <Th>Email</Th>
              <Th>Source / link</Th>
              <Th>Paid?</Th>
              <Th>Pro?</Th>
              <Th>Country</Th>
              <Th>Device</Th>
              <Th onClick={() => toggleSort("total_seconds_active")}>
                Time on site{arrow("total_seconds_active")}
              </Th>
              <Th onClick={() => toggleSort("last_active_at")}>
                Last seen{arrow("last_active_at")}
              </Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-neutral-900/40">
                <td className="whitespace-nowrap px-3 py-2 text-neutral-300">
                  {fmtRelative(r.signed_up_at)}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{r.email ?? "—"}</td>
                <td className="px-3 py-2 text-xs">
                  <div>{r.signup_source ?? <span className="text-neutral-500">—</span>}</div>
                  {(r.utm_campaign || r.utm_content) && (
                    <div className="text-[11px] text-neutral-500">
                      {[r.utm_campaign, r.utm_content].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2">
                  {r.is_paid_acquisition ? (
                    <span className="inline-block rounded border border-amber-800/60 bg-amber-900/30 px-2 py-0.5 text-[11px] text-amber-200">
                      💰 paid
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-500">organic</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {r.is_pro ? (
                    <span
                      className="inline-block rounded border border-violet-700/60 bg-violet-900/30 px-2 py-0.5 text-[11px] text-violet-200"
                      title={`${r.subscription_tier ?? ""} · ${r.subscription_status ?? ""}`}
                    >
                      ⭐ {r.subscription_tier?.toLowerCase() === "pro" ? "Pro" : (r.subscription_tier ?? "Pro")}
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-500">free</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs">{r.country ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{r.device_class ?? "—"}</td>
                <td className="px-3 py-2 text-neutral-200">
                  {fmtDuration(r.total_seconds_active)}
                </td>
                <td className="px-3 py-2 text-xs text-neutral-400">
                  {fmtRelative(r.last_active_at)}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-sm text-neutral-500">
                  No signups match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <th
      onClick={onClick}
      className={`px-3 py-2 font-medium ${onClick ? "cursor-pointer select-none hover:text-neutral-200" : ""}`}
    >
      {children}
    </th>
  );
}
