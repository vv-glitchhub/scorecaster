import AutoWatchRecommendationsPanel from "../components/AutoWatchRecommendationsPanel";

export const metadata = {
  title: "Auto-Watch"
};

export default function AutoWatchPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-[1.8rem] border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] p-6 sm:p-8">
        <div className="text-xs font-black uppercase tracking-[0.18em] text-[var(--sc-brand)]">Recommendation Operations</div>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-[var(--sc-text)] sm:text-5xl">Auto-Watch Recommendations</h1>
        <p className="mt-4 max-w-4xl text-sm leading-7 text-[var(--sc-muted)] sm:text-base">
          Scorecaster voi pitää valitsemasi Top 1–10 PLAY/CAUTION-suositukset automaattisesti seurannassa, vaihtaa rankingista poistuneet auto-managed-rivit uusiin ja nostaa aidot päätös-, evidenssi- ja hintamuutokset samaan Alert Inboxiin. Manuaaliset seurannat säilyvät erillään. Kaikki pysyy paper-only-tilassa.
        </p>
      </section>
      <AutoWatchRecommendationsPanel />
    </div>
  );
}
