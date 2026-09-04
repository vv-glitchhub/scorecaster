"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../components/LanguageProvider";

const TAB_KEYS = ["summary", "form", "lineups", "h2h", "standings", "players", "markets"];

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pct(value, digits = 0) {
  const number = finite(value);
  return number === null ? "—" : `${(number * 100).toFixed(digits)}%`;
}

function fixed(value, digits = 2) {
  const number = finite(value);
  return number === null ? "—" : number.toFixed(digits);
}

function decision(value) {
  const normalized = String(value || "CAUTION").toUpperCase();
  if (normalized === "BET") return "PLAY";
  if (normalized === "PASS") return "SKIP";
  return ["PLAY", "CAUTION", "SKIP"].includes(normalized) ? normalized : "CAUTION";
}

function evidenceCategory(item) {
  return String(item?.category || "").toLowerCase();
}

function probabilityOf(selection) {
  return finite(selection?.consensusProbability ?? selection?.marketProbability ?? selection?.noVigProbability);
}

function EmptyVerifiedState({ title, description }) {
  return (
    <div className="rounded-[1.35rem] border border-dashed border-[var(--sc-border-strong)] bg-[var(--sc-surface-soft)] p-5">
      <div className="font-black text-[var(--sc-text)]">{title}</div>
      <p className="mt-2 text-sm leading-6 text-[var(--sc-muted)]">{description}</p>
      <div className="mt-3 inline-flex rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-200">verified data required</div>
    </div>
  );
}

function StatusChip({ children, tone = "default" }) {
  const tones = {
    good: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
    warning: "border-amber-400/25 bg-amber-400/10 text-amber-200",
    info: "border-sky-400/25 bg-sky-400/10 text-sky-200",
    default: "border-[var(--sc-border)] bg-[var(--sc-surface-soft)] text-[var(--sc-muted)]"
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${tones[tone] || tones.default}`}>{children}</span>;
}

function TeamFormCard({ team, fallbackName, tr }) {
  const state = team?.evidenceState || "missing";
  const publishable = state === "observed" || state === "no-observations";
  return (
    <article className="rounded-[1.35rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-black text-[var(--sc-text)]">{team?.team || fallbackName || "—"}</div>
          <div className="mt-1 text-xs text-[var(--sc-muted)]">{tr({ fi: "Varmennettu form/rest-yhteenveto", en: "Verified form/rest summary", es: "Resumen verificado de forma/descanso" })}</div>
        </div>
        <StatusChip tone={state === "observed" ? "good" : state === "no-observations" ? "info" : "warning"}>{state}</StatusChip>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
        {[
          [tr({ fi: "Otos", en: "Sample", es: "Muestra" }), publishable ? finite(team?.sampleSize) ?? "—" : "—"],
          [tr({ fi: "Vire", en: "Form", es: "Forma" }), publishable ? fixed(team?.formStrength) : "—"],
          [tr({ fi: "Tulosvauhti", en: "Result rate", es: "Ritmo" }), publishable ? pct(team?.weightedResultRate) : "—"],
          [tr({ fi: "Lepo", en: "Rest days", es: "Descanso" }), publishable ? finite(team?.restDays) ?? "—" : "—"],
          [tr({ fi: "Ottelut 7 pv", en: "Games / 7d", es: "Partidos / 7d" }), publishable ? finite(team?.gamesLast7Days) ?? "—" : "—"],
          [tr({ fi: "B2B", en: "Back-to-back", es: "Consecutivo" }), publishable ? (team?.backToBack ? tr({ fi: "Kyllä", en: "Yes", es: "Sí" }) : tr({ fi: "Ei", en: "No", es: "No" })) : "—"]
        ].map(([label, value]) => <div key={label} className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-3"><div className="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--sc-faint)]">{label}</div><div className="mt-1 text-lg font-black text-[var(--sc-text)]">{value}</div></div>)}
      </div>
    </article>
  );
}

function EvidenceRows({ rows, tr }) {
  if (!rows.length) return null;
  return <div className="space-y-2">{rows.map((item, index) => (
    <article key={`${item.category}-${item.subject}-${index}`} className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0"><div className="font-black text-[var(--sc-text)]">{item.subject || item.detail || tr({ fi: "Varmennettu havainto", en: "Verified observation", es: "Observación verificada" })}</div>{item.detail ? <div className="mt-1 text-sm leading-5 text-[var(--sc-muted)]">{item.detail}</div> : null}</div>
        <div className="flex flex-wrap gap-1.5"><StatusChip tone={item.verified ? "good" : "warning"}>{item.verified ? "verified" : "unverified"}</StatusChip>{item.side ? <StatusChip tone="info">{item.side}</StatusChip> : null}</div>
      </div>
      <div className="mt-3 text-[11px] text-[var(--sc-faint)]">{[item.source, item.freshness, item.observedAt].filter(Boolean).join(" · ")}</div>
    </article>
  ))}</div>;
}

export default function MatchCenterV4({ eventId, sport, selection = "" }) {
  const { tr, locale } = useLanguage();
  const [tab, setTab] = useState("summary");
  const [state, setState] = useState({ loading: true, error: "", detail: null });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const query = new URLSearchParams({ eventId, sport });
        if (selection) query.set("selection", selection);
        const response = await fetch(`/api/event-detail?${query}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Match Center unavailable");
        if (!cancelled) setState({ loading: false, error: "", detail: payload?.detail || null });
      } catch (error) {
        if (!cancelled) setState({ loading: false, error: error instanceof Error ? error.message : "Match Center unavailable", detail: null });
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [eventId, selection, sport]);

  const detail = state.detail;
  const evidence = useMemo(() => Array.isArray(detail?.sportsIntelligence?.evidence) ? detail.sportsIntelligence.evidence : [], [detail]);
  const lineups = useMemo(() => evidence.filter((item) => /lineup|starter|kokoonpano/.test(evidenceCategory(item))), [evidence]);
  const injuries = useMemo(() => evidence.filter((item) => /injur|absence|suspension|poissa/.test(evidenceCategory(item))), [evidence]);
  const news = useMemo(() => evidence.filter((item) => /news|uutis/.test(evidenceCategory(item))), [evidence]);
  const players = useMemo(() => {
    const map = new Map();
    for (const item of lineups) {
      const name = String(item?.subject || "").trim();
      if (!name) continue;
      map.set(`${item.side || "unknown"}:${name}`, { name, side: item.side || null, status: item.status || null, verified: item.verified === true, source: item.source || null });
    }
    return [...map.values()].slice(0, 30);
  }, [lineups]);

  if (state.loading) return <section className="sc-surface rounded-[1.65rem] p-6"><div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Match Center V4</div><div className="mt-2 text-xl font-black text-[var(--sc-text)]">{tr({ fi: "Kootaan ottelukeskusta…", en: "Building match center…", es: "Construyendo el centro del partido…" })}</div></section>;
  if (!detail) return <section className="sc-surface rounded-[1.65rem] p-6"><div className="font-black text-[var(--sc-text)]">Match Center V4</div><div className="mt-2 text-sm text-[var(--sc-muted)]">{state.error || tr({ fi: "Ottelua ei voitu varmentaa.", en: "The event could not be verified.", es: "No se pudo verificar el evento." })}</div></section>;

  const kickoff = detail.commenceTime ? new Date(detail.commenceTime).toLocaleString(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
  const selections = Array.isArray(detail.selections) ? detail.selections : [];
  const formRest = detail.formRestShadow || {};
  const readiness = detail.sportsIntelligence?.readiness || {};
  const tabLabels = {
    summary: tr({ fi: "Yhteenveto", en: "Summary", es: "Resumen" }),
    form: tr({ fi: "Vire & uutiset", en: "Form & news", es: "Forma y noticias" }),
    lineups: tr({ fi: "Kokoonpanot", en: "Lineups", es: "Alineaciones" }),
    h2h: "H2H",
    standings: tr({ fi: "Sarjataulukko", en: "Standings", es: "Clasificación" }),
    players: tr({ fi: "Pelaajat", en: "Players", es: "Jugadores" }),
    markets: tr({ fi: "Kertoimet", en: "Markets", es: "Cuotas" })
  };

  return (
    <section className="sc-surface overflow-hidden rounded-[2rem]" data-match-center-v4="true">
      <div className="border-b border-[var(--sc-border)] p-5 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.17em] text-[var(--sc-brand)]">Match Center V4 · verified-first</div>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--sc-text)] sm:text-4xl">{detail.homeTeam} <span className="text-[var(--sc-faint)]">vs</span> {detail.awayTeam}</h2>
            <div className="mt-2 text-sm text-[var(--sc-muted)]">{detail.league || detail.sportTitle || detail.sportKey || "Sport"} · {kickoff}</div>
          </div>
          <div className="flex flex-wrap gap-2"><StatusChip tone={detail.fixtureVerifiedByProvider === false ? "warning" : "good"}>{detail.fixtureVerifiedByProvider === false ? "fixture unverified" : "fixture verified"}</StatusChip><StatusChip tone={readiness.fullyVerified ? "good" : "warning"}>{readiness.level || "market-only"}</StatusChip><StatusChip tone="info">paper only</StatusChip></div>
        </div>
      </div>

      <div className="overflow-x-auto border-b border-[var(--sc-border)] px-3 sm:px-5">
        <div className="flex min-w-max gap-1 py-2">{TAB_KEYS.map((key) => <button key={key} type="button" onClick={() => setTab(key)} aria-pressed={tab === key} className={`rounded-xl px-4 py-2.5 text-xs font-black transition ${tab === key ? "bg-[var(--sc-brand)] text-white shadow-[var(--sc-brand-shadow)]" : "text-[var(--sc-muted)] hover:bg-[var(--sc-surface-soft)] hover:text-[var(--sc-text)]"}`}>{tabLabels[key]}</button>)}</div>
      </div>

      <div className="p-5 sm:p-7">
        {tab === "summary" ? <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{selections.slice(0, 6).map((item) => <article key={item.id || item.selection} className="rounded-[1.35rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-black text-[var(--sc-text)]">{item.selection}</div><div className="mt-2 text-3xl font-black tracking-[-0.04em] text-[var(--sc-text)]">{fixed(item.odds)}</div></div><StatusChip tone={decision(item.decision) === "PLAY" ? "good" : decision(item.decision) === "SKIP" ? "warning" : "info"}>{decision(item.decision)}</StatusChip></div><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-3"><div className="text-[10px] font-black uppercase text-[var(--sc-faint)]">{tr({ fi: "Markkina P", en: "Market P", es: "P mercado" })}</div><div className="mt-1 text-xl font-black text-[var(--sc-text)]">{pct(probabilityOf(item), 1)}</div></div><div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-3"><div className="text-[10px] font-black uppercase text-[var(--sc-faint)]">EV</div><div className="mt-1 text-xl font-black text-[var(--sc-text)]">{pct(item.ev, 1)}</div></div></div></article>)}</div>
          <div className="grid gap-4 lg:grid-cols-2"><div><div className="mb-3 text-sm font-black text-[var(--sc-text)]">{tr({ fi: "Poissaolot ja saatavuus", en: "Absences & availability", es: "Ausencias y disponibilidad" })}</div>{injuries.length ? <EvidenceRows rows={injuries} tr={tr} /> : <EmptyVerifiedState title={tr({ fi: "Ei varmennettuja poissaolotietoja", en: "No verified absence data", es: "Sin datos verificados de ausencias" })} description={tr({ fi: "Scorecaster ei tulkitse puuttuvaa loukkaantumisdataa terveeksi kokoonpanoksi.", en: "Missing injury data is not interpreted as a healthy squad.", es: "La ausencia de datos no se interpreta como plantilla sana." })} />}</div><div><div className="mb-3 text-sm font-black text-[var(--sc-text)]">{tr({ fi: "Ottelu-uutiset", en: "Match news", es: "Noticias del partido" })}</div>{news.length ? <EvidenceRows rows={news} tr={tr} /> : <EmptyVerifiedState title={tr({ fi: "Ei varmennettuja ottelu-uutisia", en: "No verified match news", es: "Sin noticias verificadas" })} description={tr({ fi: "Uutisnäkymä täyttyy vain lähdevarmennetusta, otteluun kohdistetusta datasta.", en: "This area only fills from source-verified event-attributed news.", es: "Esta zona solo muestra noticias verificadas y vinculadas al evento." })} />}</div></div>
        </div> : null}

        {tab === "form" ? <div className="space-y-5"><div className="grid gap-4 lg:grid-cols-2"><TeamFormCard team={formRest.home} fallbackName={detail.homeTeam} tr={tr} /><TeamFormCard team={formRest.away} fallbackName={detail.awayTeam} tr={tr} /></div><div><div className="mb-3 text-sm font-black text-[var(--sc-text)]">{tr({ fi: "Uutiset ja konteksti", en: "News & context", es: "Noticias y contexto" })}</div>{[...news, ...injuries].length ? <EvidenceRows rows={[...news, ...injuries].slice(0, 12)} tr={tr} /> : <EmptyVerifiedState title={tr({ fi: "Kontekstihavaintoja ei ole", en: "No context observations", es: "Sin observaciones de contexto" })} description={tr({ fi: "Form/rest-metriikat voivat olla saatavilla vaikka uutis-, loukkaantumis- tai kokoonpanosyöte puuttuu.", en: "Form/rest metrics can exist even when news, injury or lineup feeds are unavailable.", es: "Las métricas de forma pueden existir aunque falten noticias, lesiones o alineaciones." })} />}</div></div> : null}

        {tab === "lineups" ? <div className="space-y-4">{lineups.length ? <EvidenceRows rows={lineups} tr={tr} /> : <EmptyVerifiedState title={tr({ fi: "Kokoonpanoa ei ole varmennettu", en: "Lineup not verified", es: "Alineación no verificada" })} description={tr({ fi: "Kun lineup-provider tai hyväksytty fallback palauttaa otteluun yksiselitteisesti kohdistetun kokoonpanon, se näkyy tässä. Ennustettua XI:tä ei keksitä.", en: "A lineup appears here only when the configured provider or approved fallback returns event-matched evidence. A predicted XI is never invented.", es: "La alineación solo aparece con evidencia verificada del proveedor. Nunca se inventa un XI." })} />}</div> : null}

        {tab === "h2h" ? <EmptyVerifiedState title={tr({ fi: "H2H-historia odottaa varmennettua historiadataa", en: "H2H awaits verified history data", es: "H2H espera historial verificado" })} description={tr({ fi: "Videon kaltainen keskinäisten otteluiden aikajana on osa Match Center V4 -rakennetta. Se julkaistaan vasta, kun sama tapahtuma- ja joukkueidentiteetti pystytään yhdistämään historiallisiin tuloksiin ilman nimihakuarvauksia.", en: "The head-to-head timeline is part of Match Center V4, but it stays closed until team identities can be matched to historical results without name-guessing.", es: "El historial H2H forma parte de Match Center V4, pero permanece cerrado hasta verificar las identidades." })} /> : null}

        {tab === "standings" ? <EmptyVerifiedState title={tr({ fi: "Sarjataulukon data bridge on vielä puuttuva", en: "Standings data bridge is not active yet", es: "El puente de clasificación aún no está activo" })} description={tr({ fi: "Sarjataulukko lisätään vain oikean kilpailun, kauden ja kierroksen varmennetulla tunnisteella. Nykyinen Event Detail ei vielä julkaise standings-rivejä.", en: "Standings will only render from a verified competition, season and round identity. Event Detail does not publish standings rows yet.", es: "La clasificación solo se mostrará con competición, temporada y jornada verificadas." })} /> : null}

        {tab === "players" ? <div className="space-y-4">{players.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{players.map((player) => <article key={`${player.side}:${player.name}`} className="rounded-[1.3rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><div className="font-black text-[var(--sc-text)]">{player.name}</div><div className="mt-2 flex flex-wrap gap-2"><StatusChip tone="info">{player.side || "team"}</StatusChip><StatusChip tone={player.verified ? "good" : "warning"}>{player.verified ? "verified" : "unverified"}</StatusChip></div><div className="mt-3 text-xs text-[var(--sc-muted)]">{[player.status, player.source].filter(Boolean).join(" · ") || tr({ fi: "Ei lisäprofiilidataa", en: "No additional profile data", es: "Sin datos adicionales" })}</div></article>)}</div> : <EmptyVerifiedState title={tr({ fi: "Pelaajaprofiilit odottavat lineup-dataa", en: "Player profiles await lineup data", es: "Los perfiles esperan alineaciones" })} description={tr({ fi: "Videon pelaajasivu (ottelut, arvosanat, ura, siirrot) vaatii erillisen pelaaja- ja siirto-oikeudet kattavan providerin. Match Center näyttää nyt vain varmennetusta kokoonpanosta johdettavat pelaajat.", en: "The video-style player page (matches, ratings, career and transfers) requires a separately entitled player provider. Match Center currently exposes only players grounded in verified lineup evidence.", es: "La página de jugador requiere un proveedor con derechos de jugadores y transferencias." })} />}</div> : null}

        {tab === "markets" ? <div className="space-y-3">{selections.length ? selections.map((item) => <article key={item.id || item.selection} className="grid gap-3 rounded-[1.3rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 sm:grid-cols-[minmax(0,1fr)_repeat(4,minmax(86px,auto))] sm:items-center"><div><div className="font-black text-[var(--sc-text)]">{item.selection}</div><div className="mt-1 text-xs text-[var(--sc-muted)]">{item.bookmaker || tr({ fi: "Paras varmennettu hinta", en: "Best verified price", es: "Mejor cuota verificada" })}</div></div><div><div className="text-[10px] font-black uppercase text-[var(--sc-faint)]">{tr({ fi: "Kerroin", en: "Odds", es: "Cuota" })}</div><div className="mt-1 font-black text-[var(--sc-text)]">{fixed(item.odds)}</div></div><div><div className="text-[10px] font-black uppercase text-[var(--sc-faint)]">P</div><div className="mt-1 font-black text-[var(--sc-text)]">{pct(probabilityOf(item), 1)}</div></div><div><div className="text-[10px] font-black uppercase text-[var(--sc-faint)]">Edge</div><div className="mt-1 font-black text-[var(--sc-text)]">{pct(item.edge, 1)}</div></div><div><StatusChip tone={decision(item.decision) === "PLAY" ? "good" : decision(item.decision) === "SKIP" ? "warning" : "info"}>{decision(item.decision)}</StatusChip></div></article>) : <EmptyVerifiedState title={tr({ fi: "Markkinarivejä ei ole", en: "No market rows", es: "Sin mercados" })} description={tr({ fi: "Ottelun markkinadata ei ole tällä hetkellä julkaistavissa.", en: "The event market data is not publishable right now.", es: "Los mercados no están disponibles." })} />}</div> : null}
      </div>
    </section>
  );
}
