import Panel from "../components/Panel";

const features = [
  "Multi-sport odds workspace",
  "H2H, spreads and totals markets",
  "EV, edge, Kelly and confidence calculations",
  "Risk warnings and bankroll controls",
  "Tracking with ROI, CLV and streaks",
  "Paper betting AI Agent",
  "Simulator and Intelligence research views"
];

export default function AboutPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl">
        <div className="mb-2 inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-300">
          Scorecaster V1
        </div>

        <h1 className="text-4xl font-black tracking-tight">
          AI Sports Intelligence Platform
        </h1>

        <p className="mt-3 max-w-3xl text-slate-300">
          Scorecaster on urheilumarkkinoiden analyysi-, tracking- ja
          päätöksentukialusta. Se ei ole pelkkä vetovihjesovellus, vaan työkalu
          kertoimien, riskien, odotusarvon ja oman suorituksen tutkimiseen.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Panel title="What Scorecaster Does" subtitle="Core purpose">
          <div className="space-y-3 text-sm text-slate-300">
            <p>
              Scorecaster hakee kertoimia, laskee markkinan implied
              probabilityn, vertaa sitä mallin arvioon ja näyttää mahdollisen
              edgen.
            </p>
            <p>
              Lisäksi se auttaa seuraamaan vetoja, panoskokoa, ROI:ta, CLV:tä ja
              riskitasoa.
            </p>
          </div>
        </Panel>

        <Panel title="V1 Features" subtitle="Current release scope">
          <div className="grid gap-2">
            {features.map((feature) => (
              <div
                key={feature}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-300"
              >
                {feature}
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Responsible Use" subtitle="Important">
          <div className="space-y-3 text-sm text-slate-300">
            <p>
              Scorecaster ei takaa voittoja. Vedonlyöntiin liittyy aina riski,
              ja mallin arviot voivat olla väärässä.
            </p>
            <p>
              AI Agent käyttää paper-vetoja. Sitä ei ole tarkoitettu
              automaattiseen oikean rahan vedonlyöntiin.
            </p>
            <p className="text-red-300">
              Älä pelaa rahalla, jonka häviäminen aiheuttaa ongelmia.
            </p>
          </div>
        </Panel>
      </section>

      <Panel title="How The System Works" subtitle="Simplified flow">
        <div className="grid gap-4 md:grid-cols-4">
          {[
            {
              title: "Odds",
              text: "The Odds API provides market prices."
            },
            {
              title: "Analysis",
              text: "Scorecaster calculates probability, edge, EV and Kelly."
            },
            {
              title: "Tracking",
              text: "Bets can be saved, settled and reviewed with ROI and CLV."
            },
            {
              title: "Learning",
              text: "Agent and tracking data create the foundation for future model learning."
            }
          ].map((item, index) => (
            <div
              key={item.title}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
            >
              <div className="text-sm text-slate-400">Step {index + 1}</div>
              <div className="mt-2 text-xl font-black">{item.title}</div>
              <p className="mt-2 text-sm text-slate-400">{item.text}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="V1 Limitations" subtitle="What is not finished yet">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl bg-yellow-400/10 p-4 text-sm text-slate-300">
            Model probability is still simplified and partly placeholder-based.
          </div>
          <div className="rounded-xl bg-yellow-400/10 p-4 text-sm text-slate-300">
            Tracking is localStorage-based, not cloud synced yet.
          </div>
          <div className="rounded-xl bg-yellow-400/10 p-4 text-sm text-slate-300">
            AI Agent is paper-mode and demo-level in V1.
          </div>
          <div className="rounded-xl bg-yellow-400/10 p-4 text-sm text-slate-300">
            Live Pulse and Intelligence pages are V1 research views.
          </div>
        </div>
      </Panel>
    </div>
  );
}
