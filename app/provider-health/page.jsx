import Link from "next/link";
import DiagnosticsV2Client from "../diagnostics-v2/DiagnosticsV2Client";
import DiagnosticsV21Enhancements from "../diagnostics-v2/DiagnosticsV21Enhancements";
import UnifiedDataHistoryClient from "../data-layer/UnifiedDataHistoryClient";

export const metadata = {
  title: "Provider Health V2 | Scorecaster",
  description: "Live provider availability, persistent observations, divergence, freshness, coverage, closing lines and root-cause guidance."
};

export default function ProviderHealthPage() {
  return <div className="space-y-10"><div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><div><div className="font-black text-[var(--sc-text)]">Data readiness</div><div className="mt-1 text-sm text-[var(--sc-muted)]">Market Capture, provider rights, live data and Shadow Learning in one audited view.</div></div><Link href="/data-readiness" className="sc-button-primary">Open readiness</Link></div><UnifiedDataHistoryClient compact /><DiagnosticsV21Enhancements compact /><DiagnosticsV2Client focus="provider" /></div>;
}
