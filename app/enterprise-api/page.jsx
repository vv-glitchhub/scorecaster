import Link from "next/link";

const endpoints = [
  { method: "GET", path: "/api/v1/health", scope: "recommendations:read", purpose: "Tenant-authenticated API status and contract." },
  { method: "GET", path: "/api/v1/recommendations", scope: "recommendations:read", purpose: "Derived Scorecaster recommendation decisions, scores and gates." },
  { method: "GET", path: "/api/v1/leagues/readiness", scope: "leagues:read", purpose: "Current-window league readiness aggregates." }
];

export const metadata = {
  title: "Enterprise API V1 | Scorecaster",
  description: "Read-only, tenant-scoped Scorecaster decision intelligence API with hashed keys, quotas and a derived-analysis-only data boundary."
};

export default function EnterpriseApiPage() {
  return (
    <div className="space-y-7">
      <section className="sc-surface rounded-[1.8rem] p-6 sm:p-8">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--sc-brand)]">Scorecaster Enterprise API V1</div>
        <h1 className="mt-2 max-w-4xl text-3xl font-black tracking-[-0.04em] text-[var(--sc-text)] sm:text-5xl">Integrate derived sports decision intelligence — not a raw odds feed</h1>
        <p className="mt-4 max-w-4xl text-sm leading-7 text-[var(--sc-muted)]">V1 is read-only and tenant-scoped. It exposes Scorecaster&apos;s derived decision, score, edge/EV, confidence, readiness and gate analysis. Upstream raw payloads, standalone bookmaker feeds and raw odds redistribution are intentionally excluded.</p>
        <div className="mt-5 flex flex-wrap gap-2"><Link href="/recommendations" className="sc-button-primary">Open Recommendation Center</Link><Link href="/league-readiness" className="sc-button-secondary">League Readiness</Link></div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="sc-surface rounded-2xl p-5"><div className="text-xs font-black uppercase text-[var(--sc-brand)]">Authentication</div><div className="mt-2 text-lg font-black text-[var(--sc-text)]">Tenant API key</div><p className="mt-2 text-sm leading-6 text-[var(--sc-muted)]">Bearer keys use the <code>sc_live_…</code> or <code>sc_test_…</code> format. Scorecaster stores only a SHA-256 hash and a short prefix; the raw key is shown once during operator provisioning.</p></div>
        <div className="sc-surface rounded-2xl p-5"><div className="text-xs font-black uppercase text-[var(--sc-brand)]">Quotas</div><div className="mt-2 text-lg font-black text-[var(--sc-text)]">Per tenant / minute</div><p className="mt-2 text-sm leading-6 text-[var(--sc-muted)]">An atomic service-role quota protects every authenticated tenant. Current supported configuration is 1–600 requests per minute.</p></div>
        <div className="sc-surface rounded-2xl p-5"><div className="text-xs font-black uppercase text-[var(--sc-brand)]">Safety boundary</div><div className="mt-2 text-lg font-black text-[var(--sc-text)]">Read-only · paper-only</div><p className="mt-2 text-sm leading-6 text-[var(--sc-muted)]">There is no Enterprise endpoint for stake creation, bookmaker login, money transfer or real-money wager execution.</p></div>
      </section>

      <section className="sc-surface rounded-[1.6rem] p-5 sm:p-6">
        <h2 className="text-2xl font-black text-[var(--sc-text)]">Endpoints</h2>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="text-xs uppercase text-[var(--sc-faint)]"><tr><th className="p-3">Method</th><th className="p-3">Path</th><th className="p-3">Scope</th><th className="p-3">Purpose</th></tr></thead><tbody>{endpoints.map((item) => <tr key={item.path} className="border-t border-[var(--sc-border)]"><td className="p-3 font-black text-[var(--sc-brand)]">{item.method}</td><td className="p-3 font-mono text-[var(--sc-text)]">{item.path}</td><td className="p-3 font-mono text-[var(--sc-muted)]">{item.scope}</td><td className="p-3 text-[var(--sc-muted)]">{item.purpose}</td></tr>)}</tbody></table></div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="sc-surface rounded-[1.6rem] p-5"><div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--sc-brand)]">Request</div><pre className="mt-3 overflow-x-auto rounded-xl bg-black/20 p-4 text-xs leading-6 text-[var(--sc-text)]">{`GET /api/v1/recommendations?limit=5&decision=CAUTION\nAuthorization: Bearer sc_live_<your-secret-key>`}</pre></div>
        <div className="sc-surface rounded-[1.6rem] p-5"><div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--sc-brand)]">Response boundary</div><pre className="mt-3 overflow-x-auto rounded-xl bg-black/20 p-4 text-xs leading-6 text-[var(--sc-text)]">{`{\n  "dataBoundary": "derived-analysis-only",\n  "rawOddsRedistributed": false,\n  "rawProviderPayloadRedistributed": false,\n  "paperOnly": true,\n  "realMoneyActionAvailable": false\n}`}</pre></div>
      </section>

      <section className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-5 text-sm leading-6 text-[var(--sc-muted)]"><strong className="text-[var(--sc-text)]">Provisioning:</strong> Enterprise tenants and keys are created by an operator. The repository includes <code>scripts/provision-enterprise-api-key.mjs</code>; it requires service-role credentials, stores only the hash, and prints the raw client key once. No production key is committed to source control.</section>
    </div>
  );
}
