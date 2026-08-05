"use client";

import { useEffect, useState } from "react";

const EVENT_TEMPLATE = JSON.stringify([{
  eventId: "provider:event-id",
  sport: "soccer_epl",
  league: "Premier League",
  homeTeam: "Home team",
  awayTeam: "Away team",
  kickoffAt: "2026-08-05T18:00:00.000Z"
}], null, 2);

const RECORD_TEMPLATE = JSON.stringify([{
  eventId: "provider:event-id",
  teamRole: "home",
  team: "Home team",
  category: "lineup",
  subject: "Starting goalkeeper",
  status: "confirmed starter",
  confirmation: "confirmed",
  impact: 0.25,
  confidence: 0.95,
  sourceTrust: 0.9,
  observedAt: "2026-08-05T16:00:00.000Z",
  effectiveAt: "2026-08-05T18:00:00.000Z",
  sourceReference: "licensed-feed:record-123",
  publicNote: "Confirmed by the licensed source."
}], null, 2);

export default function ContextOperationsClient() {
  const [health, setHealth] = useState(null);
  const [eventsText, setEventsText] = useState(EVENT_TEMPLATE);
  const [recordsText, setRecordsText] = useState(RECORD_TEMPLATE);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/context/health", { cache: "no-store" })
      .then((response) => response.json())
      .then(setHealth)
      .catch(() => setHealth({ ok: false, status: "unavailable" }));
  }, []);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const events = JSON.parse(eventsText);
      const records = JSON.parse(recordsText);
      const response = await fetch("/api/cloud/context-evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events, records })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Import failed");
      setResult(payload);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="sc-surface rounded-[1.65rem] p-5 sm:p-6">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Operator tool</div>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-[var(--sc-text)]">Context evidence import</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--sc-muted)]">Only the configured Scorecaster operator account can submit records. The server forces the governed manual import source, validates timestamps and rights, strips raw payloads and rejects post-kickoff evidence.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-[var(--sc-surface-soft)] p-3"><div className="text-xs text-[var(--sc-faint)]">Database</div><div className="font-black">{health?.database?.tableAvailable ? "ready" : health?.status || "checking"}</div></div>
          <div className="rounded-xl bg-[var(--sc-surface-soft)] p-3"><div className="text-xs text-[var(--sc-faint)]">Provider</div><div className="font-black">{health?.provider?.configured ? health?.provider?.sourceId : "unconfigured"}</div></div>
          <div className="rounded-xl bg-[var(--sc-surface-soft)] p-3"><div className="text-xs text-[var(--sc-faint)]">Upcoming evidence</div><div className="font-black">{health?.database?.upcomingEvidenceCount ?? "–"}</div></div>
        </div>
      </section>

      <form onSubmit={submit} className="grid gap-6 xl:grid-cols-2">
        <label className="sc-surface rounded-[1.65rem] p-5">
          <span className="font-black text-[var(--sc-text)]">Events JSON</span>
          <span className="mt-1 block text-xs text-[var(--sc-faint)]">The kickoff and team identity used to validate every evidence record.</span>
          <textarea value={eventsText} onChange={(event) => setEventsText(event.target.value)} className="mt-4 min-h-[360px] w-full rounded-xl border border-[var(--sc-border)] bg-[var(--sc-bg)] p-4 font-mono text-xs text-[var(--sc-text)]" spellCheck={false} />
        </label>
        <label className="sc-surface rounded-[1.65rem] p-5">
          <span className="font-black text-[var(--sc-text)]">Evidence records JSON</span>
          <span className="mt-1 block text-xs text-[var(--sc-faint)]">Confirmation stays explicit: confirmed, probable, unconfirmed or rumor.</span>
          <textarea value={recordsText} onChange={(event) => setRecordsText(event.target.value)} className="mt-4 min-h-[360px] w-full rounded-xl border border-[var(--sc-border)] bg-[var(--sc-bg)] p-4 font-mono text-xs text-[var(--sc-text)]" spellCheck={false} />
        </label>
        <div className="xl:col-span-2">
          <button type="submit" disabled={busy} className="sc-button-primary">{busy ? "Validating and storing…" : "Import governed evidence"}</button>
        </div>
      </form>

      {error && <div className="rounded-xl border border-rose-400/25 bg-rose-400/10 p-4 text-rose-200">{error}</div>}
      {result && <pre className="overflow-auto rounded-[1.4rem] border border-emerald-400/20 bg-emerald-400/10 p-5 text-xs text-emerald-100">{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}
