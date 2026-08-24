import Link from "next/link";
import AutoWatchRecommendationsPanel from "../components/AutoWatchRecommendationsPanel";
import RecommendationsClient from "./RecommendationsClient";

export const metadata = {
  title: "Suositukset",
  description: "Scorecasterin paper-only suosituskeskus näyttää mitä live-kohteita kannattaa tutkia ja miksi."
};

export default function RecommendationsPage() {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Recommendation intelligence tools">
        <Link href="/near-play" className="sc-surface sc-card-hover rounded-[1.2rem] p-4"><div className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-300">Near PLAY V1</div><div className="mt-2 font-black text-[var(--sc-text)]">One visible gate away</div><p className="mt-1 text-xs leading-5 text-[var(--sc-muted)]">Näe mikä yksittäinen näkyvä PLAY-portti vielä estää CAUTION-kohdetta.</p></Link>
        <Link href="/opportunities" className="sc-surface sc-card-hover rounded-[1.2rem] p-4"><div className="text-[10px] font-black uppercase tracking-[0.15em] text-cyan-300">Opportunity Radar V1</div><div className="mt-2 font-black text-[var(--sc-text)]">Signals & bottlenecks</div><p className="mt-1 text-xs leading-5 text-[var(--sc-muted)]">Järjestä nykyiset PLAY-, evidence-, price- ja coverage-signaalit.</p></Link>
        <Link href="/recommendations/compare" className="sc-surface sc-card-hover rounded-[1.2rem] p-4"><div className="text-[10px] font-black uppercase tracking-[0.15em] text-purple-300">Compare V1</div><div className="mt-2 font-black text-[var(--sc-text)]">Why #1 beats #2</div><p className="mt-1 text-xs leading-5 text-[var(--sc-muted)]">Vertaa score, edge, EV, confidence, fair odds, evidenssi ja kaikki gate-tasot rinnakkain.</p></Link>
        <Link href="/journey" className="sc-surface sc-card-hover rounded-[1.2rem] p-4"><div className="text-[10px] font-black uppercase tracking-[0.15em] text-emerald-300">Journey V1</div><div className="mt-2 font-black text-[var(--sc-text)]">Decision history</div><p className="mt-1 text-xs leading-5 text-[var(--sc-muted)]">Avaa Watchlist/Auto-Watch-kohteen tallennettu hinta-, päätös- ja gate-historia.</p></Link>
      </div>
      <AutoWatchRecommendationsPanel compact />
      <RecommendationsClient />
    </div>
  );
}
