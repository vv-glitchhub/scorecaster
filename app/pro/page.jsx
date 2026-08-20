import Link from "next/link";
import ProBettorClient from "./ProBettorClient";

export const metadata = {
  title: "Pro Bettor Desk | Scorecaster",
  description: "Professional paper-only decision quality, CLV, market coverage and risk workflow."
};

export default function ProBettorPage() {
  return <>
    <ProBettorClient />
    <section className="mt-7 rounded-3xl border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] p-5 sm:p-6">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--sc-brand)]">Market Universe V1</div>
      <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-[var(--sc-text)]">Ammattilaisen shortlist myös lisämarkkinoista</h2>
      <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--sc-text-secondary)]">Tutki event-kohtaisesti team totals-, BTTS-, alternate line-, period-, corners/cards- ja player prop -markkinoita. PLAY-arvio annetaan vain markkinayksiköille, joissa no-vig ja settlement voidaan laskea oikein.</p>
      <Link href="/market-universe" className="sc-button-primary mt-5 inline-flex">Avaa Market Universe</Link>
    </section>
  </>;
}
