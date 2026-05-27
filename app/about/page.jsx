import Panel from "../components/Panel";

const features = [
  "AI betting analysis",
  "Market intelligence",
  "Expected value and Kelly",
  "Paper betting agent",
  "Tracking and bankroll",
  "Simulation engine",
  "Responsible betting layer"
];

export default function AboutPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl">
        <div className="mb-2 inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-300">
          About Scorecaster
        </div>

        <h1 className="text-4xl font-black tracking-tight">
          AI Sports Intelligence Platform
        </h1>

        <p className="mt-3 max-w-3xl text-slate-300">
          Scorecaster ei ole pelkkä vetovihje- tai kertoimenselain. Se on
          analyysi-, simulointi- ja päätöksentukialusta urheilumarkkinoiden
          tutkimiseen.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Panel title="What Scorecaster Does" subtitle="Core identity">
          <div className="space-y-3 text-sm text-slate-300">
            <p>
              Scorecaster analysoi otteluita, kertoimia, todennäköisyyksiä,
              riskiä ja markkinaliikettä.
            </p>
            <p>
              Tavoite on auttaa käyttäjää ymmärtämään miksi jokin kohde voi olla
              hyvä, huono tai liian riskinen.
            </p>
          </div>
        </Panel>

        <Panel title="Core Features" subtitle="Current and planned systems">
          <div className="grid gap-2">
            {features.map((feature) => (
              <div
                key={feature}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm"
              >
                {feature}
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Responsible Use" subtitle="Important disclaimer">
          <div className="space-y-3 text-sm text-slate-300">
            <p>
              Scorecaster ei takaa voittoja eikä poista vedonlyönnin riskiä.
            </p>
            <p>
              Agentti käyttää aluksi vain 1000€ leikkirahaa paper betting
              -tilassa.
            </p>
            <p className="text-red-300">
              Älä käytä rahaa, jonka häviäminen aiheuttaa ongelmia.
            </p>
          </div>
        </Panel>
      </section>

      <Panel title="How The Intelligence Works" subtitle="Simplified model flow">
        <div className="grid gap-4 md:grid-cols-4">
          {["Data", "Analysis", "Prediction", "Learning"].map((step, index) => (
            <div
              key={step}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
            >
              <div className="text-sm text-slate-400">Step {index + 1}</div>
              <div className="mt-2 text-xl font-black">{step}</div>
              <p className="mt-2 text-sm text-slate-400">
                {step === "Data" &&
                  "Odds, teams, market movement, injuries and context."}
                {step === "Analysis" &&
                  "EV, edge, implied probability, confidence and risk."}
                {step === "Prediction" &&
                  "AI forms a thesis and creates paper betting ideas."}
                {step === "Learning" &&
                  "Results are reviewed and model weaknesses are tracked."}
              </p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
