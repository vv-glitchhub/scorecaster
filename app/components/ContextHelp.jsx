"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const guides = {
  "/betting": {
    title: "Näin käytät Kohteet-sivua",
    steps: ["Valitse laji, liiga ja markkina.", "Avaa kiinnostava kerroin ja lue päätös sekä riskivaroitukset.", "Tallenna vain PLAY- tai CAUTION-kohde paperiseurantaan."],
    link: { href: "/help", label: "Mitä edge ja EV tarkoittavat?" }
  },
  "/agent": {
    title: "Näin käytät AI-analyysia",
    steps: ["Tarkista PLAY-, WATCH- ja SKIP-määrät.", "Avaa kohde ja lue myös AI:n vastaväite sekä puuttuva evidenssi.", "Tallenna vain palvelimen hyväksymä PLAY-kohde paperiseurantaan."],
    link: { href: "/help", label: "Lue AI:n turvallisuusrajat" }
  },
  "/tracking": {
    title: "Näin käytät Seurantaa",
    steps: ["Tarkista avoimet paperikohteet.", "Kirjaa tai tarkista lopputulos.", "Arvioi pidemmällä aikavälillä ROI:ta, CLV:tä ja kalibrointia."],
    link: { href: "/analytics", label: "Avaa tarkempi analyysi" }
  },
  "/analytics": {
    title: "Näin luet Analyysi-sivua",
    steps: ["Katso ensin otoskoko.", "Vertaa ROI:n lisäksi CLV:tä ja Brier scorea.", "Älä tee johtopäätöstä muutaman kohteen perusteella."],
    link: { href: "/help", label: "Avaa termien selitykset" }
  },
  "/simulator": {
    title: "Näin käytät Simulaattoria",
    steps: ["Syötä joukkueiden ratingit ja haluamasi siemen.", "Aja riittävä määrä simulaatioita.", "Lue tulos epävarmuusvälinä, ei varmana ennusteena."],
    link: { href: "/help", label: "Muista mallin rajoitukset" }
  },
  "/risk": {
    title: "Näin asetat paperirajat",
    steps: ["Syötä vain virtuaalinen pelikassa.", "Pidä yksittäisen paperipanoksen ja kokonaisaltistuksen rajat pieninä.", "Tallenna asetukset ennen kohteiden lisäämistä."],
    link: { href: "/responsible-use", label: "Lue vastuullisen käytön ohje" }
  },
  "/paper-trading": {
    title: "Näin käytät Paperisalkkua",
    steps: ["Tarkista käytettävissä oleva virtuaalikassa.", "Vältä liian suurta kokonais- tai liigakohtaista altistusta.", "Käsittele kaikki summat simulaationa, ei oikeana rahana."],
    link: { href: "/risk", label: "Muuta paperirajoja" }
  },
  "/quick-use": {
    title: "Näin lisäät oman paperikohteen",
    steps: ["Kirjoita ottelu, valinta ja kerroin.", "Tarkista virtuaalinen panos ja riskipäätös.", "Tallenna paikalliseen seurantaan ilman oikean rahan tapahtumaa."],
    link: { href: "/tracking", label: "Avaa tallennetut kohteet" }
  },
  "/profile": {
    title: "Tilin hallinta",
    steps: ["Tarkista kirjautunut tili.", "Vie omat tiedot tarvittaessa.", "Poista tili pysyvästi vain, kun olet varma."],
    link: { href: "/privacy", label: "Lue tietosuojaseloste" }
  },
  "/cloud-sync": {
    title: "Pilvisynkronoinnin käyttö",
    steps: ["Kirjaudu omalle tilille.", "Tarkista paikalliset paperikohteet ennen siirtoa.", "Varmista synkronoinnin jälkeen, ettei samoja rivejä syntynyt kahdesti."],
    link: { href: "/security", label: "Lue tietoturvamalli" }
  }
};

function guideForPath(pathname) {
  const exact = guides[pathname];
  if (exact) return exact;
  const prefix = Object.keys(guides).find((path) => pathname?.startsWith(`${path}/`));
  return prefix ? guides[prefix] : null;
}

export default function ContextHelp() {
  const pathname = usePathname();
  const [hiddenPath, setHiddenPath] = useState(null);
  const guide = guideForPath(pathname);

  if (!guide || hiddenPath === pathname) return null;

  return (
    <aside className="mb-6 rounded-2xl border border-sky-400/20 bg-sky-400/[0.08] p-4" aria-label="Sivun käyttöohje">
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
          <Link href={guide.link.href} className="mt-3 inline-flex text-sm font-black text-sky-300 hover:text-sky-200">
            {guide.link.label} →
          </Link>
        </div>
        <button type="button" onClick={() => setHiddenPath(pathname)} className="shrink-0 rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-slate-400 hover:bg-white/5" aria-label="Piilota tämän sivun käyttöohje">
          Piilota
        </button>
      </div>
    </aside>
  );
}
