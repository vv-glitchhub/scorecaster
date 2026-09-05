"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLanguage } from "../../components/LanguageProvider";

const TABS = ["summary", "form", "lineups", "h2h", "standings", "players", "markets", "media"];
const LAZY_INTELLIGENCE_TABS = new Set(["lineups", "players", "media"]);

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function pct(value, digits = 0) {
  const number = finite(value);
  return number === null ? "—" : `${(number * 100).toFixed(digits)}%`;
}

function fixed(value, digits = 2) {
  const number = finite(value);
  return number === null ? "—" : number.toFixed(digits);
}

function clean(value) {
  return String(value || "").trim();
}

function normalize(value) {
  return clean(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function initials(value) {
  const parts = clean(value).split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function decision(value) {
  const normalized = clean(value).toUpperCase();
  if (normalized === "BET") return "PLAY";
  if (normalized === "PASS") return "SKIP";
  return ["PLAY", "CAUTION", "SKIP"].includes(normalized) ? normalized : "CAUTION";
}

function decisionTone(value) {
  const current = decision(value);
  if (current === "PLAY") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (current === "SKIP") return "border-rose-400/30 bg-rose-400/10 text-rose-200";
  return "border-amber-400/30 bg-amber-400/10 text-amber-200";
}

function safeExternalUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function eventKey(row = {}) {
  return clean(row.gameId || row.eventId || row.id);
}

function probabilityOf(row = {}) {
  return finite(row.consensusProbability ?? row.marketProbability ?? row.noVigProbability);
}

function selectionMatches(selection, team) {
  const left = normalize(selection);
  const right = normalize(team);
  return Boolean(left && right && (left === right || left.includes(right) || right.includes(left)));
}

function outcomeSelections(detail) {
  const rows = Array.isArray(detail?.selections) ? detail.selections : [];
  const home = rows.find((row) => selectionMatches(row.selection, detail?.homeTeam));
  const away = rows.find((row) => selectionMatches(row.selection, detail?.awayTeam));
  const draw = rows.find((row) => /^(draw|tasapeli|x)$/.test(normalize(row.selection)) || normalize(row.selection).includes("draw"));
  const primary = [home, draw, away].filter(Boolean);
  if (primary.length >= 2) return primary;
  return rows.filter((row) => probabilityOf(row) !== null).slice(0, 3);
}

function statusChipClass(tone = "default") {
  const tones = {
    good: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    warning: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    bad: "border-rose-400/30 bg-rose-400/10 text-rose-200",
    info: "border-sky-400/30 bg-sky-400/10 text-sky-200",
    default: "border-[var(--sc-border)] bg-[var(--sc-surface-soft)] text-[var(--sc-muted)]"
  };
  return tones[tone] || tones.default;
}

function StatusChip({ children, tone = "default" }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${statusChipClass(tone)}`}>{children}</span>;
}

function EmptyVerifiedState({ title, description, compact = false }) {
  return (
    <div className={`rounded-[1.35rem] border border-dashed border-[var(--sc-border-strong)] bg-[var(--sc-surface-soft)] ${compact ? "p-4" : "p-6"}`}>
      <div className="font-black text-[var(--sc-text)]">{title}</div>
      <p className="mt-2 text-sm leading-6 text-[var(--sc-muted)]">{description}</p>
      <div className="mt-3 inline-flex rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-200">verified data required</div>
    </div>
  );
}

function Crest({ team }) {
  return <div className="grid h-16 w-16 place-items-center rounded-2xl border border-[var(--sc-border-strong)] bg-[var(--sc-surface)] text-xl font-black text-[var(--sc-brand)] shadow-sm">{initials(team)}</div>;
}

function ProbabilityCenter({ detail, tr }) {
  const outcomes = outcomeSelections(detail);
  const probabilities = outcomes.map(probabilityOf);
  const total = probabilities.reduce((sum, value) => sum + (value || 0), 0);
  if (!outcomes.length) return null;

  return (
    <section className="overflow-hidden rounded-[1.55rem] border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)]" data-probability-center-v5="true">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--sc-brand-border)] px-5 py-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Scorecaster Probability Center</div>
          <div className="mt-1 text-sm font-bold text-[var(--sc-text)]">{tr({ fi: "No-vig markkinakonsensus", en: "No-vig market consensus", es: "Consenso de mercado sin margen" })}</div>
        </div>
        <StatusChip tone="info">probability source: market</StatusChip>
      </div>
      <div className={`grid ${outcomes.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {outcomes.map((row, index) => {
          const probability = probabilities[index];
          const width = total > 0 && probability !== null ? `${Math.max(4, (probability / total) * 100)}%` : "0%";
          return (
            <div key={`${row.selection}-${index}`} className="border-r border-[var(--sc-brand-border)] p-4 last:border-r-0 sm:p-5">
              <div className="truncate text-[11px] font-black uppercase tracking-[0.08em] text-[var(--sc-muted)]">{row.selection}</div>
              <div className="mt-1 text-3xl font-black tracking-tight text-[var(--sc-text)] sm:text-4xl">{pct(probability)}</div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/10"><div className="h-full rounded-full bg-[var(--sc-brand)]" style={{ width }} /></div>
              <div className="mt-2 text-[11px] text-[var(--sc-faint)]">{tr({ fi: "Reilu kerroin", en: "Fair odds", es: "Cuota justa" })}: {fixed(row.fairOdds)}</div>
            </div>
          );
        })}
      </div>
      <div className="border-t border-[var(--sc-brand-border)] px-5 py-3 text-[11px] leading-5 text-[var(--sc-muted)]">
        {tr({ fi: "Tätä ei esitetä riippumattoman mallin voittotodennäköisyytenä. Scorecaster näyttää markkinan reiluksi puhdistetun konsensuksen ja pitää shadow-mallit erillään.", en: "This is not presented as an independent model win probability. Scorecaster shows de-vigged market consensus and keeps shadow models separate.", es: "No se presenta como probabilidad de un modelo independiente; se muestra el consenso de mercado sin margen." })}
      </div>
    </section>
  );
}

function MetricTile({ label, value, detail }) {
  return <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-3"><div className="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--sc-faint)]">{label}</div><div className="mt-1 text-lg font-black text-[var(--sc-text)]">{value}</div>{detail ? <div className="mt-1 text-[10px] text-[var(--sc-muted)]">{detail}</div> : null}</div>;
}

function teamTrend(rows = []) {
  const sample = rows.slice(0, 8);
  if (!sample.length) return null;
  let wins = 0; let draws = 0; let losses = 0; let gf = 0; let ga = 0; let btts = 0; let over25 = 0; let cleanSheets = 0;
  for (const row of sample) {
    const result = clean(row.result).toUpperCase();
    if (result === "W") wins += 1; else if (result === "D") draws += 1; else if (result === "L") losses += 1;
    const goalsFor = finite(row.goalsFor) ?? 0;
    const goalsAgainst = finite(row.goalsAgainst) ?? 0;
    gf += goalsFor; ga += goalsAgainst;
    if (goalsFor > 0 && goalsAgainst > 0) btts += 1;
    if (goalsFor + goalsAgainst > 2.5) over25 += 1;
    if (goalsAgainst === 0) cleanSheets += 1;
  }
  const first = clean(sample[0]?.result).toUpperCase();
  let streak = 0;
  for (const row of sample) {
    if (clean(row.result).toUpperCase() !== first) break;
    streak += 1;
  }
  return {
    sample: sample.length,
    wins, draws, losses,
    avgFor: gf / sample.length,
    avgAgainst: ga / sample.length,
    bttsRate: btts / sample.length,
    over25Rate: over25 / sample.length,
    cleanSheetRate: cleanSheets / sample.length,
    streak: first && streak ? `${first}${streak}` : "—"
  };
}

function TrendCard({ team, rows, tr }) {
  const trend = teamTrend(rows);
  if (!trend) return <EmptyVerifiedState compact title={team} description={tr({ fi: "Nykykauden varmennettua tuloshistoriaa ei ole vielä riittävästi trendikorttiin.", en: "Not enough verified current-season result history for a trend card.", es: "Aún no hay suficiente historial verificado para tendencias." })} />;
  const items = [
    [tr({ fi: "Saldo", en: "Record", es: "Balance" }), `${trend.wins}-${trend.draws}-${trend.losses}`],
    [tr({ fi: "Maalit / ottelu", en: "Goals / game", es: "Goles / partido" }), `${trend.avgFor.toFixed(1)}–${trend.avgAgainst.toFixed(1)}`],
    ["BTTS", pct(trend.bttsRate)],
    ["Over 2.5", pct(trend.over25Rate)],
    [tr({ fi: "Nollapelit", en: "Clean sheets", es: "Porterías a cero" }), pct(trend.cleanSheetRate)],
    [tr({ fi: "Putki", en: "Streak", es: "Racha" }), trend.streak]
  ];
  return (
    <article className="rounded-[1.35rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-5">
      <div className="flex items-center justify-between gap-3"><div className="font-black text-[var(--sc-text)]">{team}</div><StatusChip tone="good">verified results</StatusChip></div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">{items.map(([label, value]) => <MetricTile key={label} label={label} value={value} />)}</div>
      <div className="mt-3 text-[10px] text-[var(--sc-faint)]">n={trend.sample} · {tr({ fi: "johdettu vain ennen ottelua varmennetuista lopputuloksista", en: "derived only from final results verified before kickoff", es: "derivado solo de resultados verificados antes del inicio" })}</div>
    </article>
  );
}

function ResultRows({ title, rows, locale, tr }) {
  return (
    <article className="rounded-[1.35rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-5">
      <div className="font-black text-[var(--sc-text)]">{title}</div>
      {rows.length ? <div className="mt-4 space-y-2">{rows.slice(0, 8).map((row) => <div key={row.eventId} className="grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-3"><StatusChip tone={row.result === "W" ? "good" : row.result === "L" ? "bad" : "info"}>{row.result}</StatusChip><div className="min-w-0"><div className="truncate text-sm font-black text-[var(--sc-text)]">{row.opponent}</div><div className="mt-1 text-[11px] text-[var(--sc-faint)]">{new Date(row.commenceTime).toLocaleDateString(locale)} · {row.venue}</div></div><div className="text-lg font-black text-[var(--sc-text)]">{row.goalsFor}–{row.goalsAgainst}</div></div>)}</div> : <div className="mt-3 text-sm text-[var(--sc-muted)]">{tr({ fi: "Ei varmennettuja aiempia otteluita.", en: "No verified previous matches.", es: "Sin partidos anteriores verificados." })}</div>}
    </article>
  );
}

function EvidenceRows({ rows, tr }) {
  if (!rows.length) return null;
  return <div className="space-y-2">{rows.slice(0, 14).map((item, index) => <article key={`${item.category}-${item.subject}-${index}`} className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><div className="font-black text-[var(--sc-text)]">{item.subject || item.detail || tr({ fi: "Varmennettu havainto", en: "Verified observation", es: "Observación verificada" })}</div>{item.detail ? <div className="mt-1 text-sm leading-5 text-[var(--sc-muted)]">{item.detail}</div> : null}</div><div className="flex flex-wrap gap-1.5"><StatusChip tone={item.verified ? "good" : "warning"}>{item.verified ? "verified" : "unverified"}</StatusChip>{item.side ? <StatusChip tone="info">{item.side}</StatusChip> : null}</div></div><div className="mt-3 text-[11px] text-[var(--sc-faint)]">{[item.source, item.freshness, item.observedAt].filter(Boolean).join(" · ")}</div></article>)}</div>;
}

function H2HRows({ rows, locale, tr }) {
  if (!rows.length) return <EmptyVerifiedState title={tr({ fi: "Ei varmennettua H2H-historiaa", en: "No verified H2H history", es: "Sin historial H2H verificado" })} description={tr({ fi: "Scorecaster ei löytänyt näiden joukkueiden välisiä finality-verified tuloksia ennen tätä ottelua.", en: "Scorecaster found no finality-verified meetings between these teams before this event.", es: "No se encontraron enfrentamientos finales verificados antes del partido." })} />;
  return <div className="space-y-2">{rows.slice(0, 10).map((row) => <article key={row.eventId} className="grid gap-3 rounded-[1.25rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 sm:grid-cols-[110px_minmax(0,1fr)_auto] sm:items-center"><div className="text-xs font-bold text-[var(--sc-faint)]">{new Date(row.commenceTime).toLocaleDateString(locale)}</div><div><div className="font-black text-[var(--sc-text)]">{row.homeTeam} <span className="text-[var(--sc-faint)]">vs</span> {row.awayTeam}</div><div className="mt-1 text-[11px] text-[var(--sc-muted)]">{row.league || row.sportKey} · finality verified</div></div><div className="text-2xl font-black text-[var(--sc-text)]">{row.homeScore}–{row.awayScore}</div></article>)}</div>;
}

function StandingsTable({ standings, homeTeam, awayTeam, tr }) {
  const rows = Array.isArray(standings?.rows) ? standings.rows : [];
  if (!standings?.available || !rows.length) return <EmptyVerifiedState title={tr({ fi: "Sarjataulukkoa ei voida vielä julkaista", en: "Standings cannot be published yet", es: "La clasificación aún no se puede publicar" })} description={tr({ fi: "Taulukko vaatii riittävästi saman kilpailun current-season finality-verified tuloksia. Puuttuvaa dataa ei täytetä arvauksella.", en: "The table requires enough current-season finality-verified results from the same competition. Missing data is not guessed.", es: "La tabla requiere suficientes resultados verificados de la temporada." })} />;
  return <div className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--sc-muted)]"><span>{tr({ fi: "Scorecasterin varmennetuista lopputuloksista johdettu taulukko", en: "Table derived from Scorecaster verified final results", es: "Tabla derivada de resultados verificados" })}</span><span>{standings.fixtureCount} {tr({ fi: "ottelua", en: "fixtures", es: "partidos" })} · {standings.teamCount} {tr({ fi: "joukkuetta", en: "teams", es: "equipos" })}</span></div><div className="overflow-x-auto rounded-[1.3rem] border border-[var(--sc-border)]"><table className="min-w-[680px] w-full text-sm"><thead className="bg-[var(--sc-surface-soft)] text-[10px] font-black uppercase tracking-[0.1em] text-[var(--sc-faint)]"><tr><th className="px-3 py-3 text-left">#</th><th className="px-3 py-3 text-left">{tr({ fi: "Joukkue", en: "Team", es: "Equipo" })}</th>{["P","W","D","L","GF","GA","GD","Pts"].map((label) => <th key={label} className="px-3 py-3 text-right">{label}</th>)}</tr></thead><tbody>{rows.map((row) => { const selected = row.team === homeTeam || row.team === awayTeam; return <tr key={row.team} className={`border-t border-[var(--sc-border)] ${selected ? "bg-[var(--sc-brand-soft)]" : "bg-[var(--sc-surface)]"}`}><td className="px-3 py-3 font-black text-[var(--sc-muted)]">{row.rank}</td><td className="px-3 py-3 font-black text-[var(--sc-text)]">{row.team}</td>{[row.played,row.wins,row.draws,row.losses,row.goalsFor,row.goalsAgainst,row.goalDifference,row.points].map((value, index) => <td key={index} className="px-3 py-3 text-right font-bold text-[var(--sc-text)]">{value}</td>)}</tr>; })}</tbody></table></div><div className="text-[11px] leading-5 text-[var(--sc-faint)]">{tr({ fi: "Ei väitä olevansa liigan virallinen taulukko. Sijoitus lasketaan vain Scorecasterin ennen ottelua varmennetuista tuloksista.", en: "Not claimed as the league's official table. Ranking uses only Scorecaster results verified before kickoff.", es: "No se presenta como clasificación oficial; usa solo resultados verificados." })}</div></div>;
}

function positionGroup(value) {
  const pos = normalize(value);
  if (!pos) return "UNK";
  if (/goalkeeper|keeper|(^| )gk($| )/.test(pos)) return "GK";
  if (/defender|centre back|center back|full back|left back|right back|(^| )(cb|lb|rb|df)($| )/.test(pos)) return "DEF";
  if (/midfield|midfielder|defensive mid|attacking mid|(^| )(cm|dm|am|mf)($| )/.test(pos)) return "MID";
  if (/forward|striker|winger|(^| )(fw|st|cf|lw|rw)($| )/.test(pos)) return "ATT";
  return "UNK";
}

function lineupForSide(lineups, side) {
  return (Array.isArray(lineups) ? lineups : []).find((row) => clean(row?.side).toLowerCase() === side) || null;
}

function PitchPlayer({ player, side, onOpen }) {
  return <button type="button" onClick={() => onOpen?.({ ...player, side })} className="min-w-0 rounded-xl border border-white/20 bg-black/30 px-2 py-2 text-center text-white shadow-sm backdrop-blur transition hover:bg-black/40"><div className="mx-auto grid h-7 w-7 place-items-center rounded-full bg-white/90 text-[10px] font-black text-slate-950">{initials(player.name)}</div><div className="mt-1 truncate text-[10px] font-black">{player.name}</div><div className="text-[9px] text-white/70">{player.position || "verified"}</div></button>;
}

function LineupPitch({ lineup, team, onOpen, tr }) {
  const players = Array.isArray(lineup?.startingPlayers) ? lineup.startingPlayers.filter((player) => player?.name) : [];
  const groups = { GK: [], DEF: [], MID: [], ATT: [], UNK: [] };
  players.forEach((player) => groups[positionGroup(player.position)].push(player));
  const recognized = players.length - groups.UNK.length;
  const canPlace = players.length >= 7 && recognized >= Math.min(7, players.length);

  if (!lineup) return <EmptyVerifiedState compact title={team} description={tr({ fi: "Tälle joukkueelle ei ole varmennettua lineup-providerin dataa.", en: "No verified lineup-provider data is available for this team.", es: "No hay datos verificados de alineación para este equipo." })} />;

  return (
    <article className="rounded-[1.4rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-lg font-black text-[var(--sc-text)]">{team}</div><div className="mt-1 text-xs text-[var(--sc-muted)]">{lineup.source || "verified lineup provider"}</div></div><div className="flex flex-wrap gap-1.5"><StatusChip tone={lineup.startersConfirmed ? "good" : "warning"}>{lineup.startersConfirmed ? "starters confirmed" : "lineup observed"}</StatusChip>{lineup.goalieConfirmed ? <StatusChip tone="good">GK confirmed</StatusChip> : null}</div></div>
      {players.length ? canPlace ? <div className="relative mt-4 overflow-hidden rounded-[1.25rem] border border-emerald-200/30 bg-emerald-900/80 p-4"><div className="pointer-events-none absolute inset-3 rounded-xl border border-white/25" /><div className="pointer-events-none absolute left-1/2 top-3 bottom-3 w-px bg-white/25" /><div className="pointer-events-none absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25" /><div className="relative z-10 flex min-h-[430px] flex-col justify-between gap-4">{["ATT", "MID", "DEF", "GK"].map((group) => <div key={group} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(1, groups[group].length)}, minmax(0, 1fr))` }}>{groups[group].map((player) => <PitchPlayer key={`${group}-${player.playerId || player.name}`} player={player} side={lineup.side} onOpen={onOpen} />)}</div>)}{groups.UNK.length ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{groups.UNK.map((player) => <PitchPlayer key={`unknown-${player.playerId || player.name}`} player={player} side={lineup.side} onOpen={onOpen} />)}</div> : null}</div></div> : <div className="mt-4"><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{players.map((player) => <button type="button" key={player.playerId || player.name} onClick={() => onOpen?.({ ...player, side: lineup.side })} className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-3 text-left"><div className="font-black text-[var(--sc-text)]">{player.name}</div><div className="mt-1 text-xs text-[var(--sc-muted)]">{player.position || tr({ fi: "Pelipaikkaa ei varmennettu", en: "Position not verified", es: "Posición no verificada" })}</div></button>)}</div><div className="mt-3 text-[11px] text-[var(--sc-faint)]">{tr({ fi: "Pelaajia ei sijoiteta kentälle arvauksella. Kenttämuodostelma näytetään vasta, kun riittävä määrä pelipaikkoja on providerin vahvistamia.", en: "Players are never placed on the pitch by guesswork. The field view appears only when enough positions are provider-confirmed.", es: "Nunca se colocan jugadores por estimación; el campo aparece solo con posiciones verificadas." })}</div></div> : <EmptyVerifiedState compact title={tr({ fi: "Kokoonpanon tila on varmennettu, mutta pelaajalistaa ei saatu", en: "Lineup status is verified, but player names are unavailable", es: "El estado está verificado, pero faltan los nombres" })} description={tr({ fi: "Scorecaster ei rakenna ennakoitua XI:tä ilman providerin pelaajakohtaista dataa.", en: "Scorecaster does not invent a predicted XI without provider-level player data.", es: "Scorecaster no inventa un XI sin datos del proveedor." })} />}
    </article>
  );
}

function PlayerPanel({ player, injuries, lineups, tr }) {
  if (!player) return null;
  const injury = (Array.isArray(injuries) ? injuries : []).find((row) => normalize(row?.name || row?.subject) === normalize(player.name));
  const lineup = lineupForSide(lineups, player.side);
  return <aside className="rounded-[1.4rem] border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] p-5"><div className="flex items-start gap-4"><div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[var(--sc-brand)] text-lg font-black text-white">{initials(player.name)}</div><div className="min-w-0"><div className="text-xl font-black text-[var(--sc-text)]">{player.name}</div><div className="mt-1 text-sm text-[var(--sc-muted)]">{player.position || tr({ fi: "Pelipaikka ei providerissa", en: "Position unavailable from provider", es: "Posición no disponible" })}</div><div className="mt-2 flex flex-wrap gap-1.5"><StatusChip tone={player.confirmed !== false ? "good" : "warning"}>{player.confirmed !== false ? "confirmed" : "unconfirmed"}</StatusChip>{injury ? <StatusChip tone="bad">{injury.status || "availability issue"}</StatusChip> : <StatusChip tone="good">no verified absence</StatusChip>}</div></div></div><div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4"><MetricTile label={tr({ fi: "Tärkeys", en: "Importance", es: "Importancia" })} value={fixed(player.importance, 1)} /><MetricTile label={tr({ fi: "Joukkue", en: "Team", es: "Equipo" })} value={lineup?.team || player.side || "—"} /><MetricTile label={tr({ fi: "Lähde", en: "Source", es: "Fuente" })} value={lineup?.source || "—"} /><MetricTile label="Player ID" value={player.playerId ? String(player.playerId) : "—"} /></div>{injury ? <div className="mt-4 rounded-xl border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-100"><div className="font-black">{injury.status || "Availability issue"}</div><div className="mt-1">{injury.injury || injury.reason || tr({ fi: "Provider ei antanut tarkempaa syytä.", en: "Provider did not supply a more specific reason.", es: "El proveedor no dio un motivo más específico." })}</div></div> : null}<div className="mt-4 grid grid-cols-3 gap-2">{[tr({ fi: "Otteluhistoria", en: "Match history", es: "Historial" }), tr({ fi: "Ura / siirrot", en: "Career / transfers", es: "Carrera / fichajes" }), tr({ fi: "Markkina-arvo", en: "Market value", es: "Valor de mercado" })].map((label) => <div key={label} className="rounded-xl border border-dashed border-[var(--sc-border-strong)] bg-[var(--sc-surface-soft)] p-3 text-center"><div className="text-[10px] font-black uppercase text-[var(--sc-faint)]">{label}</div><div className="mt-1 text-[10px] text-[var(--sc-muted)]">licensed player provider required</div></div>)}</div></aside>;
}

function MarketTable({ detail, tr }) {
  const rows = Array.isArray(detail?.selections) ? detail.selections : [];
  if (!rows.length) return <EmptyVerifiedState title={tr({ fi: "Markkinoita ei ole saatavilla", en: "No markets available", es: "No hay mercados disponibles" })} description={tr({ fi: "Nykyisestä varmennetusta analyysistä ei löytynyt julkaistavia markkinoita.", en: "No publishable markets were found in the current verified analysis.", es: "No se encontraron mercados publicables." })} />;
  return <div className="overflow-x-auto rounded-[1.3rem] border border-[var(--sc-border)]"><table className="min-w-[820px] w-full text-sm"><thead className="bg-[var(--sc-surface-soft)] text-[10px] font-black uppercase tracking-[0.1em] text-[var(--sc-faint)]"><tr><th className="px-3 py-3 text-left">{tr({ fi: "Valinta", en: "Selection", es: "Selección" })}</th><th className="px-3 py-3 text-right">{tr({ fi: "Kerroin", en: "Odds", es: "Cuota" })}</th><th className="px-3 py-3 text-right">P</th><th className="px-3 py-3 text-right">Fair</th><th className="px-3 py-3 text-right">Edge</th><th className="px-3 py-3 text-right">EV</th><th className="px-3 py-3 text-right">Conf</th><th className="px-3 py-3 text-right">Decision</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.selection}-${index}`} className="border-t border-[var(--sc-border)] bg-[var(--sc-surface)]"><td className="px-3 py-3 font-black text-[var(--sc-text)]">{row.selection}</td><td className="px-3 py-3 text-right font-black text-[var(--sc-text)]">{fixed(row.odds)}</td><td className="px-3 py-3 text-right font-bold text-[var(--sc-text)]">{pct(probabilityOf(row))}</td><td className="px-3 py-3 text-right font-bold text-[var(--sc-text)]">{fixed(row.fairOdds)}</td><td className="px-3 py-3 text-right font-bold text-[var(--sc-text)]">{pct(row.edge, 1)}</td><td className="px-3 py-3 text-right font-bold text-[var(--sc-text)]">{pct(row.ev, 1)}</td><td className="px-3 py-3 text-right font-bold text-[var(--sc-text)]">{pct(row.confidence)}</td><td className="px-3 py-3 text-right"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black ${decisionTone(row.productDecision || row.decision)}`}>{decision(row.productDecision || row.decision)}</span></td></tr>)}</tbody></table></div>;
}

export default function MatchCenterV5({ eventId, sport, selection = "" }) {
  const { tr, locale } = useLanguage();
  const [tab, setTab] = useState("summary");
  const [state, setState] = useState({ loading: true, error: "", detail: null });
  const [raw, setRaw] = useState({ loading: false, loaded: false, intelligence: null, error: "" });
  const [selectedPlayer, setSelectedPlayer] = useState(null);

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

  useEffect(() => {
    if (!LAZY_INTELLIGENCE_TABS.has(tab) || raw.loaded || raw.loading || !sport || !eventId) return;
    let cancelled = false;
    async function loadStructured() {
      setRaw((current) => ({ ...current, loading: true, error: "" }));
      try {
        const response = await fetch(`/api/top-picks?sports=${encodeURIComponent(sport)}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Structured intelligence unavailable");
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        const match = rows.find((row) => eventKey(row) === clean(eventId));
        if (!cancelled) setRaw({ loading: false, loaded: true, intelligence: match?.sportsIntelligence || null, error: "" });
      } catch (error) {
        if (!cancelled) setRaw({ loading: false, loaded: true, intelligence: null, error: error instanceof Error ? error.message : "Structured intelligence unavailable" });
      }
    }
    void loadStructured();
    return () => { cancelled = true; };
  }, [eventId, raw.loaded, raw.loading, sport, tab]);

  const detail = state.detail;
  const evidence = useMemo(() => Array.isArray(detail?.sportsIntelligence?.evidence) ? detail.sportsIntelligence.evidence : [], [detail]);
  const evidenceNews = useMemo(() => evidence.filter((item) => /news|uutis/.test(normalize(item?.category))), [evidence]);
  const evidenceInjuries = useMemo(() => evidence.filter((item) => /injur|absence|suspension|poissa/.test(normalize(item?.category))), [evidence]);
  const history = detail?.verifiedEventHistory || {};
  const recentHome = Array.isArray(history?.recent?.home) ? history.recent.home : [];
  const recentAway = Array.isArray(history?.recent?.away) ? history.recent.away : [];
  const h2h = Array.isArray(history?.h2h) ? history.h2h : [];
  const standings = history?.standings || {};
  const lineups = Array.isArray(raw.intelligence?.lineups) ? raw.intelligence.lineups : [];
  const rawInjuries = Array.isArray(raw.intelligence?.injuries) ? raw.intelligence.injuries : [];
  const rawNews = Array.isArray(raw.intelligence?.news) ? raw.intelligence.news : [];
  const players = useMemo(() => lineups.flatMap((lineup) => (Array.isArray(lineup?.startingPlayers) ? lineup.startingPlayers.map((player) => ({ ...player, side: lineup.side })) : [])), [lineups]);

  if (state.loading) return <section className="sc-surface rounded-[1.65rem] p-6"><div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Match Center V5</div><div className="mt-2 text-xl font-black text-[var(--sc-text)]">{tr({ fi: "Kootaan ottelukeskusta…", en: "Building match center…", es: "Construyendo el centro del partido…" })}</div></section>;
  if (!detail) return <section className="sc-surface rounded-[1.65rem] p-6"><div className="font-black text-[var(--sc-text)]">Match Center unavailable</div><div className="mt-2 text-sm text-[var(--sc-muted)]">{state.error}</div></section>;

  const selected = detail.selections?.find((row) => row.selection === detail.selectedSelection) || detail.selections?.[0] || {};
  const date = detail.commenceTime ? new Date(detail.commenceTime) : null;
  const tabLabels = {
    summary: tr({ fi: "Yhteenveto", en: "Summary", es: "Resumen" }),
    form: tr({ fi: "Vire & uutiset", en: "Form & news", es: "Forma y noticias" }),
    lineups: tr({ fi: "Kokoonpanot", en: "Lineups", es: "Alineaciones" }),
    h2h: "H2H",
    standings: tr({ fi: "Sarjataulukko", en: "Standings", es: "Clasificación" }),
    players: tr({ fi: "Pelaajat", en: "Players", es: "Jugadores" }),
    markets: tr({ fi: "Kertoimet", en: "Markets", es: "Cuotas" }),
    media: tr({ fi: "Media", en: "Media", es: "Medios" })
  };

  return (
    <section className="space-y-5" data-match-center-v5="true">
      <div className="overflow-hidden rounded-[1.8rem] border border-[var(--sc-border)] bg-[var(--sc-surface)] shadow-sm">
        <div className="border-b border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Match Center V5 · {detail.leagueTitle || detail.league || detail.sportKey}</div><div className="mt-1 text-xs text-[var(--sc-muted)]">{date ? date.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) : "—"}</div></div><div className="flex flex-wrap gap-1.5"><StatusChip tone={detail.fixtureVerifiedByProvider === false ? "warning" : "good"}>{detail.fixtureVerifiedByProvider === false ? "fixture unverified" : "fixture verified"}</StatusChip><StatusChip tone="info">paper only</StatusChip></div></div>
        </div>
        <div className="grid items-center gap-4 px-5 py-6 sm:grid-cols-[1fr_auto_1fr]">
          <div className="flex flex-col items-center gap-3 text-center sm:items-end sm:text-right"><Crest team={detail.homeTeam} /><div><div className="text-lg font-black text-[var(--sc-text)] sm:text-xl">{detail.homeTeam}</div><div className="mt-1 text-xs text-[var(--sc-muted)]">{tr({ fi: "Koti", en: "Home", es: "Local" })}</div></div></div>
          <div className="text-center"><div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-faint)]">{tr({ fi: "Ottelu", en: "Match", es: "Partido" })}</div><div className="mt-2 text-2xl font-black text-[var(--sc-text)]">VS</div><div className="mt-2"><span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black ${decisionTone(selected.productDecision || selected.decision)}`}>{decision(selected.productDecision || selected.decision)}</span></div></div>
          <div className="flex flex-col items-center gap-3 text-center sm:items-start sm:text-left"><Crest team={detail.awayTeam} /><div><div className="text-lg font-black text-[var(--sc-text)] sm:text-xl">{detail.awayTeam}</div><div className="mt-1 text-xs text-[var(--sc-muted)]">{tr({ fi: "Vieras", en: "Away", es: "Visitante" })}</div></div></div>
        </div>
        <div className="overflow-x-auto border-t border-[var(--sc-border)] bg-[var(--sc-surface-soft)]"><div className="flex min-w-max px-2">{TABS.map((key) => <button key={key} type="button" onClick={() => setTab(key)} className={`border-b-2 px-4 py-3 text-xs font-black transition ${tab === key ? "border-[var(--sc-brand)] text-[var(--sc-brand)]" : "border-transparent text-[var(--sc-muted)] hover:text-[var(--sc-text)]"}`}>{tabLabels[key]}</button>)}</div></div>
      </div>

      {tab === "summary" ? <div className="space-y-5">
        <ProbabilityCenter detail={detail} tr={tr} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><MetricTile label={tr({ fi: "Valinta", en: "Selection", es: "Selección" })} value={selected.selection || "—"} /><MetricTile label={tr({ fi: "Kerroin", en: "Odds", es: "Cuota" })} value={fixed(selected.odds)} /><MetricTile label="Edge" value={pct(selected.edge, 1)} /><MetricTile label="EV" value={pct(selected.ev, 1)} /><MetricTile label={tr({ fi: "Luottamus", en: "Confidence", es: "Confianza" })} value={pct(selected.confidence)} /></div>
        <div className="grid gap-4 lg:grid-cols-2"><TrendCard team={detail.homeTeam} rows={recentHome} tr={tr} /><TrendCard team={detail.awayTeam} rows={recentAway} tr={tr} /></div>
        {(evidenceInjuries.length || evidenceNews.length) ? <div className="grid gap-4 lg:grid-cols-2"><div><div className="mb-3 text-sm font-black text-[var(--sc-text)]">{tr({ fi: "Avainpelaajat ja poissaolot", en: "Key players & absences", es: "Jugadores clave y bajas" })}</div>{evidenceInjuries.length ? <EvidenceRows rows={evidenceInjuries} tr={tr} /> : <EmptyVerifiedState compact title={tr({ fi: "Ei varmennettuja poissaoloja", en: "No verified absences", es: "Sin bajas verificadas" })} description={tr({ fi: "Scorecaster ei päättele poissaoloja uutisista ilman varmennettua evidenssiä.", en: "Scorecaster does not infer absences without verified evidence.", es: "Scorecaster no infiere bajas sin evidencia verificada." })} />}</div><div><div className="mb-3 text-sm font-black text-[var(--sc-text)]">{tr({ fi: "Ottelu-uutiset", en: "Match news", es: "Noticias" })}</div>{evidenceNews.length ? <EvidenceRows rows={evidenceNews} tr={tr} /> : <EmptyVerifiedState compact title={tr({ fi: "Ei varmennettuja uutisia", en: "No verified match news", es: "Sin noticias verificadas" })} description={tr({ fi: "Vanhentunutta tai huonosti kohdistettua uutista ei nosteta Match Centeriin.", en: "Stale or poorly attributed news is not promoted into Match Center.", es: "No se muestran noticias antiguas o mal atribuidas." })} />}</div></div> : null}
        <div className="flex flex-wrap gap-2"><Link href={`/match-intelligence?eventId=${encodeURIComponent(detail.eventId)}&sport=${encodeURIComponent(detail.sportKey || sport)}${selected.selection ? `&selection=${encodeURIComponent(selected.selection)}` : ""}`} className="sc-button-primary">{tr({ fi: "Avaa Match Journey", en: "Open Match Journey", es: "Abrir Match Journey" })}</Link><Link href="/tracking" className="sc-button-secondary">{tr({ fi: "My Picks / paper history", en: "My Picks / paper history", es: "My Picks / historial paper" })}</Link></div>
      </div> : null}

      {tab === "form" ? <div className="space-y-5"><div className="grid gap-4 lg:grid-cols-2"><TrendCard team={detail.homeTeam} rows={recentHome} tr={tr} /><TrendCard team={detail.awayTeam} rows={recentAway} tr={tr} /></div><div className="grid gap-4 lg:grid-cols-2"><ResultRows title={`${detail.homeTeam} · ${tr({ fi: "viime ottelut", en: "recent matches", es: "últimos partidos" })}`} rows={recentHome} locale={locale} tr={tr} /><ResultRows title={`${detail.awayTeam} · ${tr({ fi: "viime ottelut", en: "recent matches", es: "últimos partidos" })}`} rows={recentAway} locale={locale} tr={tr} /></div>{evidence.length ? <EvidenceRows rows={[...evidenceInjuries, ...evidenceNews]} tr={tr} /> : null}</div> : null}

      {tab === "lineups" ? <div className="space-y-4">{raw.loading ? <div className="sc-surface rounded-[1.35rem] p-5 text-sm font-bold text-[var(--sc-muted)]">{tr({ fi: "Ladataan varmennettua kokoonpanodataa…", en: "Loading verified lineup data…", es: "Cargando alineaciones verificadas…" })}</div> : null}{!raw.loading && !lineups.length ? <EmptyVerifiedState title={tr({ fi: "Vahvistettu kokoonpanoprovider puuttuu tästä ottelusta", en: "Confirmed lineup provider data is missing for this match", es: "Faltan datos confirmados de alineación" })} description={tr({ fi: "Kenttää tai ennakoitua XI:tä ei täytetä arvauksella. Kun provider toimittaa startingPlayers + position -datan, Match Center V5 piirtää muodostelman automaattisesti.", en: "The pitch and predicted XI are never filled by guesswork. Once the provider supplies startingPlayers + position data, Match Center V5 renders the formation automatically.", es: "No se rellena el campo por estimación; V5 dibuja la formación cuando el proveedor entrega jugadores y posiciones." })} /> : null}<div className="grid gap-4 xl:grid-cols-2"><LineupPitch lineup={lineupForSide(lineups, "home")} team={detail.homeTeam} onOpen={setSelectedPlayer} tr={tr} /><LineupPitch lineup={lineupForSide(lineups, "away")} team={detail.awayTeam} onOpen={setSelectedPlayer} tr={tr} /></div><PlayerPanel player={selectedPlayer} injuries={rawInjuries} lineups={lineups} tr={tr} /></div> : null}

      {tab === "h2h" ? <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="text-lg font-black text-[var(--sc-text)]">Head to head</div><StatusChip tone="good">finality verified only</StatusChip></div><H2HRows rows={h2h} locale={locale} tr={tr} /></div> : null}

      {tab === "standings" ? <StandingsTable standings={standings} homeTeam={detail.homeTeam} awayTeam={detail.awayTeam} tr={tr} /> : null}

      {tab === "players" ? <div className="space-y-4">{raw.loading ? <div className="sc-surface rounded-[1.35rem] p-5 text-sm font-bold text-[var(--sc-muted)]">{tr({ fi: "Ladataan pelaajia…", en: "Loading players…", es: "Cargando jugadores…" })}</div> : null}{players.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{players.map((player) => <button key={`${player.side}-${player.playerId || player.name}`} type="button" onClick={() => setSelectedPlayer(player)} className="rounded-[1.25rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 text-left transition hover:border-[var(--sc-brand-border)]"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--sc-brand-soft)] font-black text-[var(--sc-brand)]">{initials(player.name)}</div><div className="min-w-0"><div className="truncate font-black text-[var(--sc-text)]">{player.name}</div><div className="mt-1 text-xs text-[var(--sc-muted)]">{player.position || tr({ fi: "Pelipaikka ei varmennettu", en: "Position not verified", es: "Posición no verificada" })}</div></div></div></button>)}</div> : !raw.loading ? <EmptyVerifiedState title={tr({ fi: "Pelaajakohtaista lineup-dataa ei ole", en: "Player-level lineup data is unavailable", es: "No hay datos de jugadores" })} description={tr({ fi: "Pelaajaprofiilia ei rakenneta joukkueen nimestä tai geneerisistä rosteriarvauksista. Lisensoitu provider tarvitaan otteluhistoriaan, uraan, siirtoihin ja markkina-arvoon.", en: "Player profiles are not fabricated from team names or generic roster guesses. A licensed provider is required for match history, career, transfers and market value.", es: "Se requiere un proveedor con licencia para historial, carrera, fichajes y valor de mercado." })} /> : null}<PlayerPanel player={selectedPlayer} injuries={rawInjuries} lineups={lineups} tr={tr} /></div> : null}

      {tab === "markets" ? <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><div className="text-lg font-black text-[var(--sc-text)]">{tr({ fi: "Markkinat ja Scorecaster-päätös", en: "Markets & Scorecaster decision", es: "Mercados y decisión Scorecaster" })}</div><div className="mt-1 text-xs text-[var(--sc-muted)]">{tr({ fi: "Kertoimet, reilut todennäköisyydet, Edge, EV ja päätös samassa näkymässä.", en: "Odds, fair probabilities, Edge, EV and decision in one view.", es: "Cuotas, probabilidades, Edge, EV y decisión en una vista." })}</div></div><StatusChip tone="info">paper only</StatusChip></div><MarketTable detail={detail} tr={tr} /></div> : null}

      {tab === "media" ? <div className="space-y-4">{raw.loading ? <div className="sc-surface rounded-[1.35rem] p-5 text-sm font-bold text-[var(--sc-muted)]">{tr({ fi: "Ladataan lähteitä…", en: "Loading sources…", es: "Cargando fuentes…" })}</div> : null}{rawNews.length ? <div className="grid gap-3 lg:grid-cols-2">{rawNews.slice(0, 10).map((item, index) => { const href = safeExternalUrl(item.url); return <article key={`${item.title}-${index}`} className="rounded-[1.25rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><div className="font-black text-[var(--sc-text)]">{item.title}</div>{item.description ? <p className="mt-2 text-sm leading-6 text-[var(--sc-muted)]">{item.description}</p> : null}<div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--sc-faint)]"><span>{[item.source, item.publishedAt].filter(Boolean).join(" · ")}</span>{href ? <a href={href} target="_blank" rel="noreferrer" className="font-black text-[var(--sc-brand)]">{tr({ fi: "Avaa lähde", en: "Open source", es: "Abrir fuente" })}</a> : null}</div></article>; })}</div> : !raw.loading ? <EmptyVerifiedState title={tr({ fi: "Ei julkaistavaa mediaa tai lähdelinkkiä", en: "No publishable media or source links", es: "No hay medios o enlaces publicables" })} description={tr({ fi: "Scorecaster ei kopioi tai upota kolmannen osapuolen videoita ilman käyttöoikeutta. Varmennetut HTTPS-lähdelinkit näytetään, kun provider toimittaa ne.", en: "Scorecaster does not copy or embed third-party video without rights. Verified HTTPS source links are shown when the provider supplies them.", es: "Scorecaster no copia ni incrusta vídeo de terceros sin derechos; muestra enlaces HTTPS verificados." })} /> : null}</div> : null}

      <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-4 py-3 text-[11px] leading-5 text-[var(--sc-muted)]">Match Center V5 · paper only · probability source is always labelled · future data is excluded from verified history · predicted lineups are never invented · real-money actions unavailable.</div>
    </section>
  );
}
