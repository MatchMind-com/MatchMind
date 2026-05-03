// app/api/heartbeat/route.ts
//
// Receives a ping from the browser every ~30 seconds while a logged-in user
// has the tab open. Updates last_active_at and accumulates total time so
// the admin "live now" view + "time on site" column can work.

import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "edge"; // cheap, fast — no DB connection pool needed
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.json({ ok: false, error: "config" }, { status: 500 });
  }

  // Use the visitor's session — record_heartbeat uses auth.uid() so no spoofing.
  const cookieStore = cookies();
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get: (n: string) => cookieStore.get(n)?.value,
      set() {},
      remove() {},
    },
  });

  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) {
    // Not signed in. Pings from anonymous visitors are ignored.
    return NextResponse.json({ ok: true, anon: true });
  }

  let body: { seconds?: number } = {};
  try { body = await req.json(); } catch { /* default */ }
  const seconds = Math.max(1, Math.min(60, Math.round(body.seconds ?? 30)));

  const { error } = await supabase.rpc("record_heartbeat", {
    p_user_id: auth.user.id,
    p_seconds: seconds,
  });

  if (error) {
    console.error("[heartbeat] rpc error", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
