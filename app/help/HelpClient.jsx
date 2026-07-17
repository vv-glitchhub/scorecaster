"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useLanguage } from "../components/LanguageProvider";

export default function HelpClient() {
  const { t, tr } = useLanguage();

  const steps = useMemo(() => [
    {
      number: "1",
      title: tr({ fi: "Määritä rajat", en: "Set limits", es: "Define límites" }),
      text: t("help.workflow1"),
      href: "/risk",
      action: t("help.openRisk")
    },
    {
      number: "2",
      title: tr({ fi: "Valitse analyysitapa", en: "Choose an analysis view", es: "Elige una vista de análisis" }),
      text: t("help.workflow2"),
      href: "/agent",
      action: t("help.openAi")
    },
    {
      number: "3",
      title: tr({ fi: "Lue päätös oikein", en: "Read the decision correctly", es: "Interpreta bien la decisión" }),
      text: t("help.decisions"),
      href: "/betting",
      action: t("help.openPicks")
    },
    {
      number: "4",
      title: tr({ fi: "Tallenna vain paperiseurantaan", en: "Save to paper tracking only", es: "Guarda solo en seguimiento simulado" }),
      text: t("help.paperStake"),
      href: "/tracking",
      action: t("help.openTracking")
    }
  ], [t, tr]);

  const terms = useMemo(() => [
    [tr({ fi: "Kerroin", en: "Odds", es: "Cuota" }), tr({
      fi: "Markkinan tarjoama desimaalikerroin. Korkea kerroin ei yksin tee valinnasta hyvää.",
      en: "The decimal price offered by the market. High odds alone do not make a good pick.",
      es: "La cuota decimal ofrecida por el mercado. Una cuota alta por sí sola no hace bueno un pronóstico."
    })],
    [tr({ fi: "Implied probability", en: "Implied probability", es: "Probabilidad implícita" }), tr({
      fi: "Kertoimesta laskettu markkinan todennäköisyys ennen marginaalin poistamista.",
      en: "The market probability derived from odds before removing margin.",
      es: "La probabilidad de mercado derivada de la cuota antes de eliminar el margen."
    })],
    [tr({ fi: "No-vig-konsensus", en: "No-vig consensus", es: "Consenso sin margen" }), t("help.consensus")],
    [t("term.edge"), t("help.edge")],
    [t("term.ev"), t("help.ev")],
    [t("term.confidence"), t("help.confidence")],
    [t("term.clv"), t("help.clv")],
    [t("term.brier"), t("help.brier")],
    ["PLAY", tr({ fi: "Kohde läpäisi nykyiset data- ja riskirajat. Päätös on silti epävarma.", en: "The pick passed the current data and risk gates. The outcome remains uncertain.", es: "El pronóstico superó los filtros actuales de datos y riesgo. El resultado sigue siendo incierto." })],
    ["WATCH", tr({ fi: "Kohde tarvitsee lisätarkistuksia ennen hyväksyntää.", en: "The pick needs more checks before approval.", es: "El pronóstico necesita más comprobaciones antes de aprobarse." })],
    ["SKIP", tr({ fi: "Kohde ei läpäise rajoja. SKIP on normaali ja usein paras päätös.", en: "The pick does not pass the gates. SKIP is normal and often the best decision.", es: "El pronóstico no supera los filtros. SKIP es normal y a menudo la mejor decisión." })],
    [t("term.paperStake"), t("help.paperStake")]
  ], [t, tr]);

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl md:p-10">
        <div className="inline-flex rounded-full border border-sky-400/25 bg-sky-400/10 px-4 py-2 text-sm font-black text-sky-200">{t("help.title")}</div>
        <h1 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">{tr({ fi: "Näin käytät Scorecasteria turvallisesti", en: "How to use Scorecaster safely", es: "Cómo usar Scorecaster de forma segura" })}</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">{t("help.description")} {t("help.productBoundary")}</p>
        <div className="mt-6 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm font-bold leading-6 text-yellow-100">
          {tr({
            fi: "Tärkein sääntö: älä tulkitse PLAY-päätöstä varmaksi voitoksi. Tarkista aina vastaväite, puuttuva evidenssi ja datan tuoreus.",
            en: "Most important rule: never treat PLAY as a guaranteed win. Always review the counterargument, missing evidence and data freshness.",
            es: "Regla principal: nunca interpretes PLAY como una victoria segura. Revisa siempre el contraargumento, la evidencia faltante y la actualidad de los datos."
          })}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-black">{t("help.workflowTitle")}</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {steps.map((step) => (
            <article key={step.number} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-400 font-black text-slate-950">{step.number}</div>
                <div>
                  <h3 className="text-xl font-black">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{step.text}</p>
                  <Link href={step.href} className="mt-4 inline-flex rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-2 text-sm font-black text-emerald-200 hover:bg-emerald-400/20">{step.action} →</Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-2xl font-black">{tr({ fi: "Mitä AI saa tehdä", en: "What AI may do", es: "Qué puede hacer la IA" })}</h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
            <div className="rounded-xl bg-emerald-400/10 p-4">✓ {tr({ fi: "Järjestää palvelimen laskemia kohteita tärkeysjärjestykseen.", en: "Rank server-calculated picks by priority.", es: "Ordenar por prioridad los pronósticos calculados por el servidor." })}</div>
            <div className="rounded-xl bg-emerald-400/10 p-4">✓ {tr({ fi: "Selittää evidenssin ja näyttää vahvan vastaväitteen.", en: "Explain evidence and show a strong counterargument.", es: "Explicar la evidencia y mostrar un contraargumento sólido." })}</div>
            <div className="rounded-xl bg-emerald-400/10 p-4">✓ {tr({ fi: "Ehdottaa virtuaalista paperipanosta asetettujen rajojen sisällä.", en: "Suggest a virtual paper stake within the configured limits.", es: "Sugerir un importe virtual dentro de los límites configurados." })}</div>
            <div className="rounded-xl bg-emerald-400/10 p-4">✓ {tr({ fi: "Sanoa WATCH tai SKIP, kun aineisto ei riitä.", en: "Say WATCH or SKIP when evidence is insufficient.", es: "Indicar WATCH o SKIP cuando la evidencia sea insuficiente." })}</div>
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-2xl font-black">{tr({ fi: "Mitä AI ei saa tehdä", en: "What AI may not do", es: "Qué no puede hacer la IA" })}</h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
            <div className="rounded-xl bg-red-400/10 p-4">✕ {tr({ fi: "Muuttaa laskettua todennäköisyyttä vakuuttavamman tekstin vuoksi.", en: "Change a calculated probability to make the text more persuasive.", es: "Cambiar una probabilidad calculada para hacer el texto más convincente." })}</div>
            <div className="rounded-xl bg-red-400/10 p-4">✕ {t("help.ai1")}</div>
            <div className="rounded-xl bg-red-400/10 p-4">✕ {tr({ fi: "Pyytää pankki-, kortti- tai vedonvälittäjätunnuksia.", en: "Request bank, card or bookmaker credentials.", es: "Solicitar datos bancarios, de tarjeta o credenciales de casas de apuestas." })}</div>
            <div className="rounded-xl bg-red-400/10 p-4">✕ {tr({ fi: "Asettaa oikean rahan vetoa tai luvata tuottoa.", en: "Place a real-money bet or promise returns.", es: "Realizar una apuesta con dinero real o prometer beneficios." })}</div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-black">{t("help.termsTitle")}</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {terms.map(([term, description]) => (
            <article key={term} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <h3 className="font-black text-emerald-300">{term}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <h2 className="text-2xl font-black">{tr({ fi: "Tili ja tietosuoja", en: "Account and privacy", es: "Cuenta y privacidad" })}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">{tr({
          fi: "Scorecaster ei tarvitse pankkitietoja, maksukorttia tai vedonvälittäjän salasanaa. Profiilissa voit tarkistaa tilisi, viedä tietosi ja poistaa tilin.",
          en: "Scorecaster does not need bank details, a payment card or bookmaker password. In Profile you can review your account, export your data and delete the account.",
          es: "Scorecaster no necesita datos bancarios, tarjeta de pago ni contraseña de una casa de apuestas. En Perfil puedes revisar la cuenta, exportar tus datos y eliminarla."
        })}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/profile" className="rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950">{tr({ fi: "Avaa profiili", en: "Open Profile", es: "Abrir Perfil" })}</Link>
          <Link href="/privacy" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black">{t("footer.privacy")}</Link>
          <Link href="/security" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black">{t("more.security")}</Link>
          <Link href="/responsible-use" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black">{t("footer.responsible")}</Link>
        </div>
      </section>
    </div>
  );
}
