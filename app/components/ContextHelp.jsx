"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { useLanguage } from "./LanguageProvider";

const guideDefinitions = {
  "/betting": {
    title: { fi: "Näin käytät Kohteet-sivua", en: "How to use Picks", es: "Cómo usar Pronósticos" },
    steps: [
      { fi: "Valitse laji, liiga ja markkina.", en: "Choose a sport, league and market.", es: "Elige deporte, liga y mercado." },
      { fi: "Avaa kiinnostava kerroin ja lue päätös sekä riskivaroitukset.", en: "Open an interesting price and read the decision and risk warnings.", es: "Abre una cuota interesante y lee la decisión y los avisos de riesgo." },
      { fi: "Tallenna vain PLAY- tai CAUTION-kohde paperiseurantaan.", en: "Save only PLAY or CAUTION picks to paper tracking.", es: "Guarda solo pronósticos PLAY o CAUTION en el seguimiento simulado." }
    ],
    link: { href: "/help", label: { fi: "Mitä edge ja EV tarkoittavat?", en: "What do edge and EV mean?", es: "¿Qué significan ventaja y EV?" } }
  },
  "/agent": {
    title: { fi: "Näin käytät AI-analyysia", en: "How to use AI analysis", es: "Cómo usar el análisis IA" },
    steps: [
      { fi: "Tarkista PLAY-, WATCH- ja SKIP-määrät.", en: "Check the PLAY, WATCH and SKIP counts.", es: "Comprueba los totales PLAY, WATCH y SKIP." },
      { fi: "Avaa kohde ja lue myös AI:n vastaväite sekä puuttuva evidenssi.", en: "Open a pick and also read the AI counterargument and missing evidence.", es: "Abre un pronóstico y lee también el contraargumento y la evidencia faltante." },
      { fi: "Tallenna vain palvelimen hyväksymä PLAY-kohde paperiseurantaan.", en: "Save only a server-approved PLAY pick to paper tracking.", es: "Guarda solo un pronóstico PLAY aprobado por el servidor." }
    ],
    link: { href: "/help", label: { fi: "Lue AI:n turvallisuusrajat", en: "Read the AI safety limits", es: "Lee los límites de seguridad de la IA" } }
  },
  "/tracking": {
    title: { fi: "Näin käytät Seurantaa", en: "How to use Tracking", es: "Cómo usar Seguimiento" },
    steps: [
      { fi: "Tarkista avoimet paperikohteet.", en: "Review open paper picks.", es: "Revisa los pronósticos simulados abiertos." },
      { fi: "Kirjaa tai tarkista lopputulos.", en: "Record or verify the result.", es: "Registra o verifica el resultado." },
      { fi: "Arvioi pidemmällä aikavälillä ROI:ta, CLV:tä ja kalibrointia.", en: "Evaluate ROI, CLV and calibration over time.", es: "Evalúa ROI, CLV y calibración a largo plazo." }
    ],
    link: { href: "/analytics", label: { fi: "Avaa tarkempi analyysi", en: "Open detailed analytics", es: "Abrir analítica detallada" } }
  },
  "/analytics": {
    title: { fi: "Näin luet Analyysi-sivua", en: "How to read Analytics", es: "Cómo leer Analítica" },
    steps: [
      { fi: "Katso ensin otoskoko.", en: "Start with the sample size.", es: "Empieza por el tamaño de la muestra." },
      { fi: "Vertaa ROI:n lisäksi CLV:tä ja Brier scorea.", en: "Compare CLV and Brier score as well as ROI.", es: "Compara CLV y puntuación Brier además del ROI." },
      { fi: "Älä tee johtopäätöstä muutaman kohteen perusteella.", en: "Do not draw conclusions from only a few picks.", es: "No saques conclusiones con pocos pronósticos." }
    ],
    link: { href: "/help", label: { fi: "Avaa termien selitykset", en: "Open terminology guide", es: "Abrir guía de términos" } }
  },
  "/simulator": {
    title: { fi: "Näin käytät Simulaattoria", en: "How to use Simulator", es: "Cómo usar el Simulador" },
    steps: [
      { fi: "Syötä joukkueiden ratingit ja haluamasi siemen.", en: "Enter team ratings and your chosen seed.", es: "Introduce los ratings de los equipos y una semilla." },
      { fi: "Aja riittävä määrä simulaatioita.", en: "Run a sufficient number of simulations.", es: "Ejecuta un número suficiente de simulaciones." },
      { fi: "Lue tulos epävarmuusvälinä, ei varmana ennusteena.", en: "Read the result as an uncertainty range, not a certain prediction.", es: "Lee el resultado como un intervalo de incertidumbre, no como una predicción segura." }
    ],
    link: { href: "/help", label: { fi: "Muista mallin rajoitukset", en: "Remember the model limits", es: "Recuerda los límites del modelo" } }
  },
  "/risk": {
    title: { fi: "Näin asetat paperirajat", en: "How to set paper limits", es: "Cómo definir límites simulados" },
    steps: [
      { fi: "Syötä vain virtuaalinen pelikassa.", en: "Enter a virtual bankroll only.", es: "Introduce solo una banca virtual." },
      { fi: "Pidä yksittäisen paperipanoksen ja kokonaisaltistuksen rajat pieninä.", en: "Keep individual stake and total exposure limits small.", es: "Mantén bajos los límites por importe y exposición total." },
      { fi: "Tallenna asetukset ennen kohteiden lisäämistä.", en: "Save settings before adding picks.", es: "Guarda los ajustes antes de añadir pronósticos." }
    ],
    link: { href: "/responsible-use", label: { fi: "Lue vastuullisen käytön ohje", en: "Read responsible-use guidance", es: "Leer la guía de uso responsable" } }
  },
  "/paper-trading": {
    title: { fi: "Näin käytät Paperisalkkua", en: "How to use the paper portfolio", es: "Cómo usar la cartera simulada" },
    steps: [
      { fi: "Tarkista käytettävissä oleva virtuaalikassa.", en: "Check the available virtual bankroll.", es: "Comprueba la banca virtual disponible." },
      { fi: "Vältä liian suurta kokonais- tai liigakohtaista altistusta.", en: "Avoid excessive total or league exposure.", es: "Evita una exposición total o por liga excesiva." },
      { fi: "Käsittele kaikki summat simulaationa, ei oikeana rahana.", en: "Treat all amounts as simulation, not real money.", es: "Trata todos los importes como simulación, no como dinero real." }
    ],
    link: { href: "/risk", label: { fi: "Muuta paperirajoja", en: "Change paper limits", es: "Cambiar límites simulados" } }
  },
  "/quick-use": {
    title: { fi: "Näin lisäät oman paperikohteen", en: "How to add your own paper pick", es: "Cómo añadir tu pronóstico simulado" },
    steps: [
      { fi: "Kirjoita ottelu, valinta ja kerroin.", en: "Enter the match, selection and odds.", es: "Introduce el partido, la selección y la cuota." },
      { fi: "Tarkista virtuaalinen panos ja riskipäätös.", en: "Check the virtual stake and risk decision.", es: "Comprueba el importe virtual y la decisión de riesgo." },
      { fi: "Tallenna paikalliseen seurantaan ilman oikean rahan tapahtumaa.", en: "Save to local tracking without a real-money transaction.", es: "Guarda en el seguimiento local sin transacción de dinero real." }
    ],
    link: { href: "/tracking", label: { fi: "Avaa tallennetut kohteet", en: "Open saved picks", es: "Abrir pronósticos guardados" } }
  },
  "/profile": {
    title: { fi: "Tilin hallinta", en: "Account management", es: "Gestión de la cuenta" },
    steps: [
      { fi: "Tarkista kirjautunut tili.", en: "Check the signed-in account.", es: "Comprueba la cuenta iniciada." },
      { fi: "Vie omat tiedot tarvittaessa.", en: "Export your data when needed.", es: "Exporta tus datos cuando sea necesario." },
      { fi: "Poista tili pysyvästi vain, kun olet varma.", en: "Delete the account permanently only when you are sure.", es: "Elimina la cuenta permanentemente solo cuando estés seguro." }
    ],
    link: { href: "/privacy", label: { fi: "Lue tietosuojaseloste", en: "Read the privacy notice", es: "Leer el aviso de privacidad" } }
  },
  "/cloud-sync": {
    title: { fi: "Pilvisynkronoinnin käyttö", en: "Using cloud sync", es: "Uso de la sincronización en la nube" },
    steps: [
      { fi: "Kirjaudu omalle tilille.", en: "Sign in to your account.", es: "Inicia sesión en tu cuenta." },
      { fi: "Tarkista paikalliset paperikohteet ennen siirtoa.", en: "Review local paper picks before transfer.", es: "Revisa los pronósticos locales antes de transferirlos." },
      { fi: "Varmista synkronoinnin jälkeen, ettei samoja rivejä syntynyt kahdesti.", en: "After syncing, confirm that no duplicate rows were created.", es: "Después de sincronizar, confirma que no se hayan creado duplicados." }
    ],
    link: { href: "/security", label: { fi: "Lue tietoturvamalli", en: "Read the security model", es: "Leer el modelo de seguridad" } }
  }
};

function guideForPath(pathname) {
  const exact = guideDefinitions[pathname];
  if (exact) return exact;
  const prefix = Object.keys(guideDefinitions).find((path) => pathname?.startsWith(`${path}/`));
  return prefix ? guideDefinitions[prefix] : null;
}

export default function ContextHelp() {
  const pathname = usePathname();
  const { tr, t } = useLanguage();
  const [hiddenPath, setHiddenPath] = useState(null);
  const definition = guideForPath(pathname);
  const guide = useMemo(() => definition ? {
    title: tr(definition.title),
    steps: definition.steps.map((step) => tr(step)),
    link: { href: definition.link.href, label: tr(definition.link.label) }
  } : null, [definition, tr]);

  if (!guide || hiddenPath === pathname) return null;

  return (
    <aside className="mb-6 rounded-2xl border border-sky-400/20 bg-sky-400/[0.08] p-4" aria-label={guide.title}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="font-black text-sky-200">{guide.title}</h2>
          <ol className="mt-2 grid gap-2 text-sm leading-6 text-slate-300 md:grid-cols-3">
            {guide.steps.map((step, index) => (
              <li key={step} className="flex gap-2 rounded-xl bg-slate-950/35 p-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-300 font-black text-slate-950">{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <Link href={guide.link.href} className="mt-3 inline-flex text-sm font-black text-sky-300 hover:text-sky-200">{guide.link.label} →</Link>
        </div>
        <button type="button" onClick={() => setHiddenPath(pathname)} className="shrink-0 rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-slate-400 hover:bg-white/5" aria-label={`${t("common.hide")}: ${guide.title}`}>
          {t("common.hide")}
        </button>
      </div>
    </aside>
  );
}
