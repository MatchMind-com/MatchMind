"use client";

// lib/admin/attribution-tracker.tsx
//
// Drop <AttributionTracker /> once near the top of the app (root client
// layout, or the landing page). It runs captureAttribution() on mount —
// stashing UTM params + referrer in sessionStorage so the signup handler
// can attach them later.

import { useEffect } from "react";
import { captureAttribution } from "./attribution";

export function AttributionTracker() {
  useEffect(() => {
    captureAttribution();
  }, []);
  return null;
}
