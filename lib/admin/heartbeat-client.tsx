"use client";

// lib/admin/heartbeat-client.tsx
//
// Drop <Heartbeat /> once near the top of the app (e.g. inside the root
// client layout). It sends a small POST to /api/heartbeat every 30 seconds
// the page is visible. While the tab is hidden, it stops — so we don't
// inflate "time on site" for tabs left open in the background.

import { useEffect } from "react";

const INTERVAL_MS = 30_000;

export function Heartbeat() {
  useEffect(() => {
    let lastSentAt = 0;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function ping() {
      const now = Date.now();
      const seconds = lastSentAt ? Math.min(60, Math.round((now - lastSentAt) / 1000)) : 30;
      lastSentAt = now;
      try {
        await fetch("/api/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seconds }),
          // keepalive lets the request finish even if the tab is closing
          keepalive: true,
        });
      } catch {
        /* offline / swallowed */
      }
    }

    function start() {
      if (timer) return;
      ping(); // immediate ping on focus
      timer = setInterval(ping, INTERVAL_MS);
    }

    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
    }

    function onVisibility() {
      if (document.visibilityState === "visible") start();
      else stop();
    }

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", stop);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", stop);
    };
  }, []);

  return null;
}
