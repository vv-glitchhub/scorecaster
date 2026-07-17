import Link from "next/link";

export const metadata = {
  title: "Ohje | Scorecaster",
  description: "Selkokielinen käyttöohje Scorecasterin urheiluanalyysiin ja paperiseurantaan."
};

const steps = [
  {
    number: "1",
    title: "Määritä rajat",
    text: "Aloita virtuaalisesta pelikassasta ja pienestä enimmäispanosprosentista. Nämä ovat vain paperiseurannan numeroita.",
    href: "/risk",
    action: "Avaa riskiasetukset"
  },
  {
    number: "2",
    title: "Valitse tapa analysoida",
    text: "Kohteet-sivu näyttää koko markkinan. AI-analyysi nostaa tärkeimmät päätökset ja haastaa oman suosituksensa.",
    href: "/agent",
    action: "Avaa AI-analyysi"
  },
  {
    number: "3",
    title: "Lue päätös oikein",
    text: "PLAY tarkoittaa, että kohde läpäisi nykyiset data- ja riskirajat. WATCH vaatii lisätarkistuksia. SKIP tarkoittaa, ettei kohdetta kannata tallentaa.",
    href: "/betting",
    action: "Katso päivän kohteet"
  },
  {
    number: "4",
    title: "Tallenna vain paperiseurantaan",
    text: "Paperikohde ei ole oikea veto. Se auttaa mittaamaan päätöksenteon laatua ilman talletuksia tai maksuja.",
    href: "/tracking",
    action: "Avaa seuranta"
  }
];

const terms = [
  ["Kerroin", "Markkinan tarjoama desimaalikerroin. Scorecaster ei takaa, että korkea kerroin olisi hyvä valinta."],
  ["Implied probability", "Kertoimesta laskettu markkinan todennäköisyys ennen marginaalin poistamista."],
  ["No-vig-konsensus", "Usean vedonvälittäjän hinnoista muodostettu arvio sen jälkeen, kun marginaalia on poistettu."],
  ["Edge", "Konsensuksen ja parhaan tarjotun hinnan välinen ero. Positiivinen edge ei takaa voittoa."],
  ["EV", "Odotusarvo nykyisellä hinnalla ja käytetyllä todennäköisyydellä."],
  ["Confidence", "Scorecasterissa ensisijaisesti datan laadun mittari, ei varmuus ottelun voittajasta."],
  ["CLV", "Vertaa tallennettua kerrointa myöhempään päätöskertoimeen. Se auttaa arvioimaan hintapäätöksen laatua."],
  ["Brier score", "Mittaa todennäköisyysarvioiden ja toteutuneiden tulosten välistä virhettä. Pienempi on parempi."],
  ["PLAY", "Kohde läpäisi Scorecasterin ja käyttäjän nykyiset rajat. Päätös on silti epävarma."],
  ["WATCH", "Kohde on kiinnostava, mutta data, hinta tai riskiprofiili ei riitä täyteen hyväksyntään."],
  ["SKIP", "Kohde ei läpäise rajoja. SKIP on normaali ja usein paras päätös."],
  ["Paperipanos", "Virtuaalinen panos seurantaa varten. Se ei siirrä rahaa eikä aseta vetoa."]
];

export default function HelpPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl md:p-10">
        <div className="inline-flex rounded-full border border-sky-400/25 bg-sky-400/10 px-4 py-2 text-sm font-black text-sky-200">
          Scorecaster-ohje
        </div>
        <h1 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">Näin käytät Scorecasteria turvallisesti</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
          Scorecaster on urheiluanalyysin, riskinhallinnan ja virtuaalisen paperiseurannan työkalu. Se ei ole vedonlyöntipalvelu eikä käsittele oikeaa rahaa.
        </p>
        <div className="mt-6 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm font-bold leading-6 text-yellow-100">
          Tärkein sääntö: älä tulkitse PLAY-päätöstä varmaksi voitoksi. Tarkista aina myös vastaväite, puuttuva evidenssi ja datan tuoreus.
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-black">Suositeltu käyttöjärjestys</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {steps.map((step) => (
            <article key={step.number} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-400 font-black text-slate-950">{step.number}</div>
                <div>
                  <h3 className="text-xl font-black">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{step.text}</p>
                  <Link href={step.href} className="mt-4 inline-flex rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-2 text-sm font-black text-emerald-200 hover:bg-emerald-400/20">
                    {step.action} →
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-2xl font-black">Mitä AI saa tehdä</h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
            <div className="rounded-xl bg-emerald-400/10 p-4">✓ Järjestää palvelimen laskemia kohteita tärkeysjärjestykseen.</div>
            <div className="rounded-xl bg-emerald-400/10 p-4">✓ Selittää evidenssin ja näyttää vahvan vastaväitteen.</div>
            <div className="rounded-xl bg-emerald-400/10 p-4">✓ Ehdottaa virtuaalista paperipanosta asetettujen rajojen sisällä.</div>
            <div className="rounded-xl bg-emerald-400/10 p-4">✓ Sanoa WATCH tai SKIP, kun aineisto ei riitä.</div>
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-2xl font-black">Mitä AI ei saa tehdä</h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
            <div className="rounded-xl bg-red-400/10 p-4">✕ Muuttaa laskettua todennäköisyyttä vakuuttavamman tekstin vuoksi.</div>
            <div className="rounded-xl bg-red-400/10 p-4">✕ Keksiä loukkaantumisia, kokoonpanoja, uutisia tai varmoja tuloksia.</div>
            <div className="rounded-xl bg-red-400/10 p-4">✕ Pyytää pankki-, kortti- tai vedonvälittäjätunnuksia.</div>
            <div className="rounded-xl bg-red-400/10 p-4">✕ Asettaa oikean rahan vetoa tai luvata tuottoa.</div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-black">Termit selkokielellä</h2>
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
        <h2 className="text-2xl font-black">Tili ja tietosuoja</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Scorecaster ei tarvitse pankkitietoja, maksukorttia tai vedonvälittäjän salasanaa. Profiilissa voit tarkistaa tilisi, viedä tietosi ja poistaa tilin, kun tuotannon pilvipalvelut on aktivoitu.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/profile" className="rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950">Avaa profiili</Link>
          <Link href="/privacy" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black">Tietosuojaseloste</Link>
          <Link href="/security" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black">Tietoturva</Link>
          <Link href="/responsible-use" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black">Vastuullinen käyttö</Link>
        </div>
      </section>
    </div>
  );
}
