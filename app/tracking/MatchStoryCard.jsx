"use client";

import Link from "next/link";
import { buildMatchStoryV1 } from "../../lib/match-story-v1.mjs";

function percent(value) {
  return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function decimal(value) {
  return value === null ? "—" : value.toFixed(2);
}

function verdictCopy(verdict, tr) {
  const copy = {
    "awaiting-settlement": {
      fi: "Päätös on tallessa. Jälkiarvio avautuu, kun paperitulos on ratkaistu.",
      en: "The decision is preserved. Review opens after the paper result is settled.",
      es: "La decisión está guardada. La revisión se abre al resolver el resultado simulado."
    },
    "process-and-outcome-aligned": {
      fi: "Hinta parani markkinaan nähden ja paperitulos oli myönteinen. Prosessi ja lopputulos olivat samalla puolella.",
      en: "The entry beat the closing price and the paper result was positive. Process and outcome aligned.",
      es: "La entrada superó al cierre y el resultado simulado fue positivo. Proceso y resultado coincidieron."
    },
    "price-over-outcome": {
      fi: "Paperitulos oli kielteinen, mutta päätöshinta voitti closing-linjan. Hyvää prosessia ei pidä hylätä yhden tuloksen vuoksi.",
      en: "The paper result was negative, but the entry beat the closing line. One outcome should not erase a sound price process.",
      es: "El resultado fue negativo, pero la entrada superó al cierre. Un resultado no invalida un buen proceso."
    },
    "outcome-over-price": {
      fi: "Paperitulos oli myönteinen, mutta markkina liikkui päätöstä vastaan. Voitto ei yksin todista hyvää hintaprosessia.",
      en: "The paper result was positive, but the market moved against the entry. A win alone does not prove a strong price process.",
      es: "El resultado fue positivo, pero el mercado se movió contra la entrada. Ganar no prueba por sí solo un buen proceso."
    },
    "process-and-outcome-negative": {
      fi: "Sekä paperitulos että hintakehitys olivat kielteisiä. Päätöshinta ja puuttuva evidenssi kannattaa tarkistaa ennen vastaavaa valintaa.",
      en: "Both the paper result and price process were negative. Review the entry price and missing evidence before a similar decision.",
      es: "Resultado y proceso de precio fueron negativos. Revisa la entrada y la evidencia ausente antes de una decisión similar."
    },
    "neutral-outcome": {
      fi: "Paperitulos oli neutraali. Closing-hinta kertoo prosessista enemmän kuin palautunut yksittäistulos.",
      en: "The paper result was neutral. The closing price says more about process than this pushed outcome.",
      es: "El resultado fue neutro. El cierre dice más del proceso que este resultado nulo."
    },
    "neutral-result-only": {
      fi: "Paperitulos oli neutraali, mutta closing-hinta puuttuu. Hintaprosessia ei arvioida arvauksella.",
      en: "The paper result was neutral, but the closing price is missing. Price process is not guessed.",
      es: "El resultado fue neutro, pero falta el cierre. El proceso de precio no se adivina."
    },
    "result-only": {
      fi: "Lopputulos tunnetaan, mutta closing-hinta puuttuu. Tämä on tuloshavainto, ei täydellinen prosessiarvio.",
      en: "The outcome is known, but the closing price is missing. This is an outcome observation, not a complete process review.",
      es: "Se conoce el resultado, pero falta el cierre. Es una observación, no una revisión completa del proceso."
    },
    "mixed-single-event": {
      fi: "Yksittäisen ottelun signaalit ovat ristiriitaiset. Kerää lisää ratkaistuja paperihavaintoja ennen johtopäätöksiä.",
      en: "Signals from this single event are mixed. Collect more settled paper observations before drawing conclusions.",
      es: "Las señales de este evento son mixtas. Recoge más observaciones resueltas antes de concluir."
    }
  };
  return tr(copy[verdict] || copy["mixed-single-event"]);
}

function focusCopy(focus, tr) {
  const copy = {
    "await-settlement": { fi: "Odota ratkaistua paperitulosta.", en: "Wait for a settled paper result.", es: "Espera el resultado simulado resuelto." },
    "capture-closing-price": { fi: "Lisää päätöskerroin, jotta CLV voidaan laskea.", en: "Add the closing price so CLV can be calculated.", es: "Añade la cuota de cierre para calcular CLV." },
    "protect-process-from-outcome-bias": { fi: "Säilytä hintaprosessi; älä ylireagoi tappioon.", en: "Protect the price process; do not overreact to the loss.", es: "Protege el proceso de precio; no sobrerreacciones a la derrota." },
    "review-entry-price-despite-win": { fi: "Arvioi päätöshinta uudelleen voitosta huolimatta.", en: "Review the entry price despite the win.", es: "Revisa la entrada pese a la victoria." },
    "review-entry-and-evidence": { fi: "Tarkista päätöshinta, evidenssivajeet ja riskirajat.", en: "Review entry price, evidence gaps and risk gates.", es: "Revisa entrada, evidencia ausente y límites de riesgo." },
    "repeat-process-not-result": { fi: "Toista kurinalainen prosessi, älä yksittäistä tulosta.", en: "Repeat the disciplined process, not the single outcome.", es: "Repite el proceso disciplinado, no el resultado aislado." },
    "collect-more-samples": { fi: "Kerää lisää ratkaistuja havaintoja ennen mallipäätelmiä.", en: "Collect more settled observations before model conclusions.", es: "Recoge más observaciones antes de concluir sobre el modelo." }
  };
  return tr(copy[focus] || copy["collect-more-samples"]);
}

function storyTone(state) {
  if (state === "positive") return "border-emerald-300/25 bg-emerald-300/10";
  if (state === "negative") return "border-rose-300/25 bg-rose-300/10";
  if (state === "unavailable") return "border-amber-300/25 bg-amber-300/10";
  return "border-sky-300/20 bg-sky-300/10";
}

export default function MatchStoryCard({ bet, tr, locale }) {
  const story = buildMatchStoryV1(bet);
  const money = (value) => value === null ? "—" : new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(value);
  const journeyHref = bet?.eventId && bet?.sportKey
    ? `/match-intelligence?eventId=${encodeURIComponent(bet.eventId)}&sport=${encodeURIComponent(bet.sportKey)}`
    : "";

  return (
    <details
      className="mt-5 overflow-hidden rounded-[1.4rem] border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)]"
      data-match-story-v1="true"
      data-story-status={story.status}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 sm:p-5">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.17em] text-[var(--sc-brand)]">Match Story V1</div>
          <div className="mt-1 font-black text-[var(--sc-text)]">
            {story.status === "settled"
              ? tr({ fi: "Avaa päätöksen jälkiarvio", en: "Open the decision review", es: "Abrir revisión de la decisión" })
              : tr({ fi: "Jälkiarvio odottaa ratkaisua", en: "Review awaits settlement", es: "La revisión espera resolución" })}
          </div>
        </div>
        <span className="rounded-full border border-[var(--sc-brand-border)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--sc-brand)]">
          {story.status === "settled" ? story.result : tr({ fi: "lukittu", en: "locked", es: "bloqueado" })}
        </span>
      </summary>

      <div className="border-t border-[var(--sc-brand-border)] p-4 sm:p-5">
        <p className="max-w-4xl text-sm leading-6 text-[var(--sc-text-secondary)]">{verdictCopy(story.verdict, tr)}</p>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <section className={`rounded-[1.2rem] border p-4 ${storyTone(story.outcome.state)}`}>
            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">{tr({ fi: "Lopputulos", en: "Outcome", es: "Resultado" })}</div>
            <div className="mt-2 text-2xl font-black text-[var(--sc-text)]">{story.result === "pending" ? "—" : story.result.toUpperCase()}</div>
            <div className="mt-1 text-xs text-[var(--sc-muted)]">{tr({ fi: "Paperitulos", en: "Paper result", es: "Resultado simulado" })}: {money(story.outcome.profit)}</div>
          </section>

          <section className={`rounded-[1.2rem] border p-4 ${storyTone(story.priceProcess.state)}`}>
            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">{tr({ fi: "Hintaprosessi", en: "Price process", es: "Proceso de precio" })}</div>
            <div className="mt-2 text-2xl font-black text-[var(--sc-text)]">{percent(story.priceProcess.clv)}</div>
            <div className="mt-1 text-xs text-[var(--sc-muted)]">{decimal(story.decisionSnapshot.entryOdds)} → {decimal(story.priceProcess.closingOdds)}</div>
          </section>

          <section className="rounded-[1.2rem] border border-violet-300/20 bg-violet-300/10 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">{tr({ fi: "Kehityskohde", en: "Learning focus", es: "Foco de aprendizaje" })}</div>
            <div className="mt-2 text-sm font-black leading-5 text-[var(--sc-text)]">{focusCopy(story.learning.focus, tr)}</div>
            <div className="mt-2 text-xs text-[var(--sc-muted)]">Edge {percent(story.decisionSnapshot.edge)} · EV {percent(story.decisionSnapshot.ev)}</div>
          </section>
        </div>

        {story.missing.length > 0 ? (
          <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100" data-match-story-missing="true">
            {tr({ fi: "Jälkiarvio ei täytä puuttuvaa tietoa nollalla. Puuttuu", en: "The review never fills missing evidence with zero. Missing", es: "La revisión no rellena datos ausentes con cero. Falta" })}: {story.missing.join(", ")}.
          </div>
        ) : null}

        <div className="mt-4 flex flex-col gap-3 border-t border-[var(--sc-brand-border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-[var(--sc-muted)]">
            {tr({
              fi: "Yksi tulos on havainto, ei todiste mallitaidosta. Se ei muuta production-todennäköisyyttä, mallipainoa tai PLAY-päätöstä.",
              en: "One result is an observation, not proof of model skill. It does not change production probability, model weight or a PLAY decision.",
              es: "Un resultado es una observación, no prueba de habilidad. No cambia probabilidad, peso del modelo ni decisión PLAY."
            })}
          </p>
          {journeyHref ? <Link href={journeyHref} className="sc-button-secondary shrink-0">{tr({ fi: "Palaa Match Journeyyn", en: "Return to Match Journey", es: "Volver a Match Journey" })}</Link> : null}
        </div>
      </div>
    </details>
  );
}
