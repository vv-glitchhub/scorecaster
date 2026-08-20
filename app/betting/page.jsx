import Link from "next/link";
import BettingClient from "./BettingClient";

export const metadata = {
  title: "Kohteet",
  description: "Vertaa urheilumarkkinan kertoimia, edgeä, EV:tä ja datan laatua paperiseurantaa varten."
};

export default function BettingPage() {
  return <>
    <BettingClient />
    <section className="mt-7 rounded-3xl border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] p-5 sm:p-6">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--sc-brand)]">Market Universe V1</div>
      <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-[var(--sc-text)]">Ei vain 1X2, totals ja handicapit</h2>
      <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--sc-text-secondary)]">Avaa ottelukohtaiset lisämarkkinat: joukkue tekee maalin / team totals, BTTS, vaihtoehtoiset maalirajat, tulosmarkkinat, puoliajat, kulmat, kortit ja pelaajapropit silloin kun provider palauttaa niille oikeat kertoimet.</p>
      <Link href="/market-universe" className="sc-button-primary mt-5 inline-flex">Avaa Market Universe</Link>
    </section>
  </>;
}
