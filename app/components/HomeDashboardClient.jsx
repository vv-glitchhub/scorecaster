"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardCard from "@/app/components/DashboardCard";
import DashboardGrid from "@/app/components/DashboardGrid";
import { getParlaySummary, getTopValuePicks, percent } from "@/lib/bookmaker-odds";

export default function HomeDashboardClient() {
  const [matches, setMatches] = useState([]);
  const [status, setStatus] = useState("Ladataan...");

  async function loadData() {
    try {
      const res = await fetch("/api/odds?sport=all&league=ALL", { cache: "no-store" });
      const data = await res.json();
      const next = Array.isArray(data?.matches) ? data.matches : Array.isArray(data?.data) ? data.data : [];
      setMatches(next);
      setStatus(data?.source === "live" ? `Live-data · ${next.length} ottelua` : data?.reason || "Ei live-dataa");
    } catch {
      setMatches([]);
      setStatus("Datan haku epäonnistui");
    }
  }

  useEffect(() => { loadData(); }, []);

  const topFive = useMemo(() => getTopValuePicks(matches, 5), [matches]);
  const parlayCandidates = useMemo(() => topFive.filter((pick) => pick.edge > 0).slice(0, 3), [topFive]);
  const parlaySummary = useMemo(() => getParlaySummary(parlayCandidates), [parlayCandidates]);

  return (
    <DashboardGrid>
      <DashboardCard
        title="AI:n 5 parasta kohdetta kaikista lajeista"
        description="Etusivun tärkein näkymä. AI vertaa kaikkien saatavilla olevien lajien kohteet ja nostaa viisi parasta jatkoanalyysiin. Ihminen tekee lopullisen päätöksen."
      >
        <div style={headerRow()}>
          <div style={livePill()}>{status}</div>
          <button onClick={loadData} style={refreshButton()}>Päivitä kohteet</button>
        </div>

        {topFive.length === 0 ? (
          <p style={muted()}>Riittävän laadukkaita kohteita ei ole juuri nyt saatavilla.</p>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {topFive.map((pick, index) => <ValuePickCard key={pick.id || `${pick.selection}-${index}`} pick={pick} index={index} />)}
          </div>
        )}
      </DashboardCard>

      <DashboardCard
        title="AI Rekka"
        description="Kolme parasta positiivisen edgen kohdetta erillisenä korkeamman riskin jatkoanalyysinä."
      >
        {parlayCandidates.length < 2 ? (
          <p style={muted()}>Rekkaa ei muodostettu. Tarvitaan vähintään kaksi riittävän laadukasta value-kohdetta.</p>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {parlayCandidates.map((pick, index) => (
              <div key={pick.id || index} style={miniPick()}>
                <div style={rank()}>Kohde {index + 1}</div>
                <div style={matchTitle()}>{pick.match.home_team} vs {pick.match.away_team}</div>
                <div style={book()}>{pick.selection} · {pick.odds} · {pick.bookmaker}</div>
              </div>
            ))}
            <div style={summaryBox()}>
              <div style={muted()}>Rekan kokonaiskerroin</div>
              <div style={totalOdds()}>{parlaySummary.totalOdds.toFixed(2)}</div>
              <div style={book()}>Keskimääräinen edge {percent(parlaySummary.avgEdge)} · luottamus {parlaySummary.avgConfidence.toFixed(0)}/100</div>
            </div>
            <p style={muted()}>Rekka ei ole automaattinen vedonlyöntisuositus, vaan korkeamman riskin lista ihmisen jatkoarvioon.</p>
          </div>
        )}
      </DashboardCard>

      <DashboardCard title="Datan tila" description="Datalähde, tuoreus ja analysoitujen otteluiden määrä.">
        <div style={livePill()}>{status}</div>
      </DashboardCard>

      <DashboardCard title="Otteluesikatselu" description="Seuraava saatavilla oleva ottelu kaikista lajeista.">
        {matches[0] ? (
          <div style={miniPick()}>
            <div style={matchTitle()}>{matches[0].home_team} vs {matches[0].away_team}</div>
            <div style={muted()}>{matches[0].sport_title}</div>
          </div>
        ) : <p style={muted()}>Otteluesikatselua ei ole saatavilla.</p>}
      </DashboardCard>
    </DashboardGrid>
  );
}

function ValuePickCard({ pick, index }) {
  const score = Math.max(0, Math.min(100, Math.round((Number(pick.confidence || 0) * 45) + (Math.max(0, Number(pick.edge || 0)) * 700) + (Math.max(0, Number(pick.modelProbability || 0) - 0.5) * 20))));
  return (
    <article style={pickCard()}>
      <div style={cardHeader()}>
        <div style={rank()}>#{index + 1} AI-KOHDE</div>
        <div style={scorePill()}>AI-pisteet {score}/100</div>
      </div>
      <div style={matchTitle()}>{pick.match.home_team} vs {pick.match.away_team}</div>
      <div style={muted()}>{pick.match.sport_title || pick.match.sport_key}</div>
      <div style={selection()}>Kohde: {pick.selection}</div>
      <div style={odds()}>{pick.odds}</div>
      <div style={book()}>Paras kerroin: {pick.bookmaker}</div>
      <div style={statsGrid()}>
        <Stat label="Markkina" value={percent(pick.impliedProbability)} />
        <Stat label="Mallin arvio" value={percent(pick.modelProbability)} green />
        <Stat label="Edge" value={percent(pick.edge)} green />
      </div>
      <div style={reasonBox()}>
        <strong>Miksi tämä on Top 5 -listalla?</strong>
        <ul style={{ margin: "10px 0 0", paddingLeft: 20 }}>
          {(pick.reason || ["Kohde läpäisi AI:n value- ja datalaatuseulan."]).map((line, i) => <li key={i} style={{ marginBottom: 8 }}>{line}</li>)}
        </ul>
        <div style={{ marginTop: 10, color: "#94a3b8" }}>Avaa kohteen AI-analyysi nähdäksesi kaikki käytetyt ja pois jätetyt tiedot, lähteet, riskit ja laskentaketjun.</div>
      </div>
    </article>
  );
}

function Stat({ label, value, green }) {
  return <div style={statBox()}><div style={statLabel()}>{label}</div><div style={{ ...statValue(), color: green ? "#86efac" : "#fff" }}>{value}</div></div>;
}

const pickCard = () => ({ border: "1px solid rgba(52,211,153,.28)", borderRadius: 24, padding: 20, background: "linear-gradient(180deg,rgba(16,185,129,.10),rgba(255,255,255,.04))" });
const miniPick = () => ({ border: "1px solid rgba(255,255,255,.10)", borderRadius: 22, padding: 18, background: "rgba(255,255,255,.05)" });
const rank = () => ({ color: "#86efac", fontWeight: 950, marginBottom: 8 });
const matchTitle = () => ({ fontSize: 20, fontWeight: 950, lineHeight: 1.25 });
const muted = () => ({ color: "#94a3b8", fontWeight: 800, lineHeight: 1.55 });
const selection = () => ({ marginTop: 12, color: "#fff", fontWeight: 950, fontSize: 18 });
const odds = () => ({ marginTop: 8, fontSize: 52, lineHeight: 1, fontWeight: 950 });
const book = () => ({ color: "#86efac", fontWeight: 950, lineHeight: 1.45 });
const statsGrid = () => ({ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 16 });
const statBox = () => ({ border: "1px solid rgba(255,255,255,.08)", borderRadius: 16, padding: 10, background: "rgba(2,6,23,.40)" });
const statLabel = () => ({ color: "#94a3b8", fontSize: 12, fontWeight: 900 });
const statValue = () => ({ marginTop: 4, fontSize: 18, fontWeight: 950 });
const reasonBox = () => ({ marginTop: 16, border: "1px solid rgba(255,255,255,.08)", borderRadius: 18, padding: 14, background: "rgba(2,6,23,.35)", color: "#cbd5e1", lineHeight: 1.5, fontWeight: 750 });
const summaryBox = () => ({ border: "1px solid rgba(34,197,94,.35)", borderRadius: 24, padding: 18, background: "rgba(34,197,94,.10)" });
const totalOdds = () => ({ fontSize: 56, lineHeight: 1, fontWeight: 950, marginTop: 6 });
const livePill = () => ({ border: "1px solid rgba(34,197,94,.4)", background: "rgba(34,197,94,.12)", color: "#86efac", borderRadius: 999, padding: "10px 14px", fontWeight: 950, display: "inline-flex" });
const headerRow = () => ({ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 16 });
const refreshButton = () => ({ border: "1px solid rgba(255,255,255,.14)", borderRadius: 999, padding: "10px 14px", background: "rgba(255,255,255,.06)", color: "#fff", fontWeight: 900, cursor: "pointer" });
const cardHeader = () => ({ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" });
const scorePill = () => ({ color: "#d1fae5", background: "rgba(16,185,129,.18)", border: "1px solid rgba(52,211,153,.25)", borderRadius: 999, padding: "7px 10px", fontSize: 12, fontWeight: 950 });
