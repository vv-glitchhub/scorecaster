import PageSection from "@/app/components/PageSection";

export default function SimulatorPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-8">
        <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-cyan-300">
          Simulator Workspace
        </p>
        <h1 className="text-3xl font-bold text-white">
          Dedicated area for tournament and season simulations.
        </h1>
        <p className="mt-3 text-slate-300">
          Tällä sivulla pidetään kaikki simulaatiologiikka erillään bettingistä,
          jotta vedonlyöntisivu pysyy nopeana ja selkeänä.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <PageSection
          title="Simulation Setup"
          description="Competition, model and iteration settings."
        >
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm text-slate-400">Competition</p>
              <p className="mt-1 font-semibold text-white">World Cup / League</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm text-slate-400">Iterations</p>
              <p className="mt-1 font-semibold text-white">10,000</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm text-slate-400">Mode</p>
              <p className="mt-1 font-semibold text-white">Monte Carlo</p>
            </div>
          </div>
        </PageSection>

        <PageSection
          title="Outcome Preview"
          description="Example result cards for future simulation output."
        >
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="font-semibold text-white">Team A</p>
              <p className="mt-1 text-sm text-slate-400">Win title: 24.5%</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="font-semibold text-white">Team B</p>
              <p className="mt-1 text-sm text-slate-400">Reach final: 38.2%</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="font-semibold text-white">Team C</p>
              <p className="mt-1 text-sm text-slate-400">Top 4: 51.7%</p>
            </div>
          </div>
        </PageSection>

        <PageSection
          title="Planned Extensions"
          description="Features that belong here, not on the betting page."
        >
          <ul className="space-y-2 text-sm text-slate-300">
            <li>• tournament brackets</li>
            <li>• season table simulations</li>
            <li>• top 4 / top 8 probabilities</li>
            <li>• final and champion probabilities</li>
            <li>• scenario comparison</li>
          </ul>
        </PageSection>
      </div>
    </div>
  );
}
