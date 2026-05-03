"use server";

// app/actions/track-signup.ts
//
// Server action called right after a user signs up. Takes the client-
// captured attribution payload, adds geo info from Vercel's request
// headers (free), and writes everything to the user's profile row.
//
// Usage in your existing signup code (one extra line after signUp):
//
//   const { data, error } = await supabase.auth.signUp({ email, password });
//   if (data?.user) {
//     await trackSignup(data.user.id, readAttribution());
//   }

import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import type { Attribution } from "@/lib/admin/attribution";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function trackSignup(userId: string, attr: Attribution) {
  if (!userId) return { ok: false, error: "no userId" };
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, error: "missing supabase config" };
  }

  // Vercel injects geo headers automatically on the Edge / Vercel runtime.
  // Falls back to null in local dev.
  const h = headers();
  const country = h.get("x-vercel-ip-country") || null;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await supabase
    .from("profiles")
    .update({
      signup_source: attr.signup_source,
      utm_source:    attr.utm_source,
      utm_medium:    attr.utm_medium,
      utm_campaign:  attr.utm_campaign,
      utm_content:   attr.utm_content,
      utm_term:      attr.utm_term,
      landing_page:  attr.landing_page,
      signup_ref:    attr.signup_ref,
      device_class:  attr.device_class,
      country,
    })
    .eq("id", userId);

  if (error) {
    console.error("[trackSignup] update failed", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
