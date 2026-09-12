"use client";

import { useEffect } from "react";

const seen = new Set();

function safeRoute() {
  if (typeof window === "undefined") return null;
  return window.location.pathname
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ":id")
    .replace(/\b\d{4,}\b/g, ":id")
    .slice(0, 160);
}

function emit(signal) {
  const signature = `${signal.eventType}:${signal.route || ""}`;
  if (seen.has(signature)) return;
  seen.add(signature);
  if (seen.size > 20) seen.delete(seen.values().next().value);
  fetch("/api/feedback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind: "caster_telemetry", signal }),
    keepalive: true,
  }).catch(() => {});
}

export default function CasterTelemetry() {
  useEffect(() => {
    const onError = (event) => emit({
      eventType: "client_runtime_error",
      severity: "error",
      category: "reliability",
      title: "Client runtime error requires bounded audit",
      message: event.error?.name || "Client runtime error",
      route: safeRoute(),
      metadata: { online: navigator.onLine, visibility: document.visibilityState },
      createCandidate: true,
      impact: 4,
      confidence: 0.85,
      urgency: 4,
      risk: "GREEN",
    });
    const onRejection = (event) => emit({
      eventType: "unhandled_promise_rejection",
      severity: "error",
      category: "reliability",
      title: "Unhandled client promise rejection requires bounded audit",
      message: event.reason?.name || "Unhandled promise rejection",
      route: safeRoute(),
      metadata: { online: navigator.onLine, visibility: document.visibilityState },
      createCandidate: true,
      impact: 4,
      confidence: 0.8,
      urgency: 4,
      risk: "GREEN",
    });
    const onLoad = () => {
      const nav = performance.getEntriesByType("navigation")[0];
      if (nav && nav.duration > 4000) emit({ eventType: "slow_navigation", severity: "warning", category: "performance", message: "Navigation exceeded 4 seconds", route: safeRoute(), metadata: { durationBucket: nav.duration > 8000 ? "8s+" : "4-8s" } });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    if (document.readyState === "complete") onLoad(); else window.addEventListener("load", onLoad, { once: true });
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("load", onLoad);
    };
  }, []);
  return null;
}
