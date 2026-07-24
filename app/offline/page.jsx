export const metadata = {
  title: "Offline",
  description: "Scorecaster offline safety notice."
};

export default function OfflinePage() {
  return (
    <main className="page-shell">
      <section className="surface-card" style={{ maxWidth: 760, margin: "48px auto", padding: 28 }}>
        <p className="eyebrow">Offline safety mode</p>
        <h1>Live sports intelligence is unavailable.</h1>
        <p>
          Scorecaster does not show cached odds, picks, injuries, line movement or model decisions as current information. Reconnect to refresh all provider evidence before making a decision.
        </p>
        <a className="primary-button" href="/">Try again</a>
      </section>
    </main>
  );
}
