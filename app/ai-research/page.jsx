import Panel from "../components/Panel";

const researchItems = [
  {
    title: "News Intelligence",
    status: "Planned",
    description: "Otteluun liittyvät uutiset ja niiden vaikutus agentin päätökseen."
  },
  {
    title: "Injury Intelligence",
    status: "Planned",
    description: "Poissaolot, epävarmat pelaajat ja avainpelaajien merkitys."
  },
  {
    title: "Lineup Intelligence",
    status: "Planned",
    description: "Avauskokoonpanot, maalivahdit ja viime hetken muutokset."
  },
  {
    title: "Source Trust",
    status: "Active",
    description: "Lähteiden luotettavuuspisteytys."
  },
  {
    title: "Polymarket",
    status: "Planned",
    description: "Markkinoiden kollektiivinen todennäköisyys."
  },
  {
    title: "Data Readiness",
    status: "Active",
    description: "Näyttää mitä tietoa agentilta vielä puuttuu."
  }
];

export default function AIResearchPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl">
        <div className="mb-2 inline-flex rounded-full border border-purple-400/30 bg-purple-400/10 px-3 py-1 text-sm text-purple-300">
          AI Research Center
        </div>

        <h1 className="text-4xl font-black tracking-tight">
          Scorecaster Intelligence Layer
        </h1>

        <p className="mt-3 text-slate-300">
          Tämä näkymä seuraa mitä ulkoista tietoa agentti käyttää ja mitä
          tietoja vielä puuttuu ennen vahvaa päätöstä.
        </p>
      </section>

      <Panel title="Research Modules" subtitle="Agentin tiedonkeruun tila">
        <div className="grid gap-4 md:grid-cols-2">
          {researchItems.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-xl font-black">{item.title}</div>

                <div
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    item.status === "Active"
                      ? "bg-emerald-400/10 text-emerald-300"
                      : "bg-yellow-400/10 text-yellow-300"
                  }`}
                >
                  {item.status}
                </div>
              </div>

              <p className="mt-3 text-sm text-slate-300">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
