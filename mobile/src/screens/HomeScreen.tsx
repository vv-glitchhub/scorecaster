import { useEffect, useMemo, useState } from "react";
import { Alert, ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLanguage } from "../i18n";
import { apiRequest } from "../lib/api";
import { calculatePaperAnalytics } from "../lib/paperAnalytics";
import type { Bankroll, PaperBet, Pick } from "../types";
import { ActionButton, Card, Field, percent, styles } from "../ui";

function numberValue(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={localStyles.metricBox}><Text style={localStyles.metricLabel}>{label}</Text><Text style={localStyles.metricValue}>{value}</Text></View>;
}

function StartStep({ number, title, text }: { number: string; title: string; text: string }) {
  return <View style={localStyles.startStep}><View style={localStyles.stepNumber}><Text style={localStyles.stepNumberText}>{number}</Text></View><View style={{ flex: 1 }}><Text style={styles.value}>{title}</Text><Text style={styles.muted}>{text}</Text></View></View>;
}

function kickoffLabel(value: string | undefined, locale: string, fallback: string) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

function TopPickCard({ pick, index, locale, fallback }: { pick: Pick; index: number; locale: string; fallback: string }) {
  const decision = pick.productDecision || "CAUTION";
  return <View style={localStyles.topPickCard}>
    <View style={styles.rowBetween}>
      <View style={localStyles.rankBadge}><Text style={localStyles.rankText}>#{index + 1}</Text></View>
      <View style={[styles.badge, decision === "CAUTION" && styles.warningBadge]}><Text style={styles.badgeText}>{decision}</Text></View>
    </View>
    <Text style={localStyles.kickoff}>{kickoffLabel(pick.commenceTime, locale, fallback)}</Text>
    <Text style={styles.value}>{pick.match}</Text>
    <Text style={styles.cardTitle}>{pick.selection} · {Number(pick.odds || 0).toFixed(2)}</Text>
    <Text style={styles.muted}>{pick.leagueTitle || pick.league || ""}</Text>
    <View style={localStyles.topMetrics}>
      <Metric label="Edge" value={percent(pick.edge)} />
      <Metric label="Confidence" value={percent(pick.confidence)} />
    </View>
    <Text style={localStyles.reasonTitle}>Miksi tämä on Top 5?</Text>
    <Text style={styles.muted}>AI nosti kohteen yhdistämällä markkina-arvon, datan luottamuksen, lähteiden määrän ja ajankohtaisuuden. Avaa AI-välilehti nähdäksesi kaikki käytetyt ja hylätyt tiedot.</Text>
  </View>;
}

export default function HomeScreen() {
  const { tr, locale } = useLanguage();
  const [bankroll, setBankroll] = useState<Bankroll | null>(null);
  const [bets, setBets] = useState<PaperBet[]>([]);
  const [topPicks, setTopPicks] = useState<Pick[]>([]);
  const [featuredHours, setFeaturedHours] = useState(72);
  const [bankrollInput, setBankrollInput] = useState("1000");
  const [maxStakeInput, setMaxStakeInput] = useState("2");
  const [dailyExposureInput, setDailyExposureInput] = useState("8");
  const [leagueExposureInput, setLeagueExposureInput] = useState("4");
  const [minEdgeInput, setMinEdgeInput] = useState("2.5");
  const [minConfidenceInput, setMinConfidenceInput] = useState("58");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showRiskSettings, setShowRiskSettings] = useState(false);
  const money = (value: unknown) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(Number(value || 0));

  async function load() {
    setLoading(true);
    setStatus(tr({ fi: "Tarkistetaan palvelua…", en: "Checking service…", es: "Comprobando el servicio…" }));
    try {
      const [healthResult, bankrollResult, betsResult, picksResult] = await Promise.allSettled([
        apiRequest<{ status?: string; mode?: string }>("/api/health", { authenticated: false }),
        apiRequest<{ data: Bankroll }>("/api/cloud/bankroll"),
        apiRequest<{ data: PaperBet[] }>("/api/cloud/bets"),
        apiRequest<{ featured?: Pick[]; data?: Pick[]; featuredWindowHours?: number }>("/api/top-picks?view=summary", { authenticated: false, timeoutMs: 30000 })
      ]);

      setStatus(healthResult.status === "fulfilled" ? `${healthResult.value.status || "unknown"} · ${healthResult.value.mode || "unknown"}` : tr({ fi: "Palvelun tilaa ei voitu tarkistaa", en: "Service status could not be checked", es: "No se pudo comprobar el estado del servicio" }));
      if (bankrollResult.status === "fulfilled") {
        const next = bankrollResult.value.data;
        setBankroll(next);
        setBankrollInput(String(next.bankroll));
        setMaxStakeInput(String(next.max_stake_percent));
        setDailyExposureInput(String(next.max_daily_exposure_percent));
        setLeagueExposureInput(String(next.max_single_league_exposure_percent || 4));
        setMinEdgeInput(String(Number(next.min_edge || 0.025) * 100));
        setMinConfidenceInput(String(Number(next.min_confidence || 0.58) * 100));
      }
      if (betsResult.status === "fulfilled") setBets(betsResult.value.data || []);
      if (picksResult.status === "fulfilled") {
        const candidates = picksResult.value.featured?.length ? picksResult.value.featured : picksResult.value.data || [];
        setTopPicks(candidates.slice(0, 5));
        setFeaturedHours(Number(picksResult.value.featuredWindowHours || 72));
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : tr({ fi: "Palveluvirhe", en: "Service error", es: "Error del servicio" }));
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [tr]);

  async function save() {
    const bankrollNumber = numberValue(bankrollInput);
    const maxStake = numberValue(maxStakeInput);
    const dailyExposure = numberValue(dailyExposureInput);
    const leagueExposure = numberValue(leagueExposureInput);
    const minEdgePercent = numberValue(minEdgeInput);
    const minConfidencePercent = numberValue(minConfidenceInput);
    if (bankrollNumber === null || bankrollNumber < 0 || bankrollNumber > 10000000 || maxStake === null || maxStake < 0.1 || maxStake > 10 || dailyExposure === null || dailyExposure < 0.5 || dailyExposure > 50 || leagueExposure === null || leagueExposure < 0.5 || leagueExposure > 25 || minEdgePercent === null || minEdgePercent < 0 || minEdgePercent > 20 || minConfidencePercent === null || minConfidencePercent < 0 || minConfidencePercent > 100) {
      Alert.alert(tr({ fi: "Tarkista rajat", en: "Check the limits", es: "Revisa los límites" }), tr({ fi: "Virtuaalikassa 0–10 000 000 €, panos 0,1–10 %, kokonaisaltistus 0,5–50 %, liiga-altistus 0,5–25 %, minimiedge 0–20 % ja confidence 0–100 %.", en: "Virtual bankroll 0–10,000,000 €, stake 0.1–10%, total exposure 0.5–50%, league exposure 0.5–25%, minimum edge 0–20% and confidence 0–100%.", es: "Banca virtual 0–10.000.000 €, importe 0,1–10 %, exposición total 0,5–50 %, exposición por liga 0,5–25 %, ventaja mínima 0–20 % y confianza 0–100 %." }));
      return;
    }
    setSaving(true);
    try {
      const response = await apiRequest<{ data: Bankroll }>("/api/cloud/bankroll", { method: "PUT", body: { bankroll: bankrollNumber, maxStakePercent: maxStake, maxDailyExposurePercent: dailyExposure, maxSingleLeagueExposurePercent: leagueExposure, minEdge: minEdgePercent / 100, minConfidence: minConfidencePercent / 100 } });
      setBankroll(response.data);
      setShowRiskSettings(false);
      Alert.alert(tr({ fi: "Tallennettu", en: "Saved", es: "Guardado" }), tr({ fi: "Virtuaalikassa ja paperirajat päivitettiin.", en: "Virtual bankroll and paper limits were updated.", es: "Se actualizaron la banca virtual y los límites simulados." }));
    } catch (error) {
      Alert.alert(tr({ fi: "Tallennus epäonnistui", en: "Save failed", es: "No se pudo guardar" }), error instanceof Error ? error.message : tr({ fi: "Tuntematon virhe", en: "Unknown error", es: "Error desconocido" }));
    } finally { setSaving(false); }
  }

  const analytics = useMemo(() => calculatePaperAnalytics(bets), [bets]);
  const suggestedMaximum = bankroll ? bankroll.bankroll * bankroll.max_stake_percent / 100 : 0;
  const exposurePercent = bankroll?.bankroll ? analytics.openExposure / bankroll.bankroll : 0;
  const exposureLimit = Number(bankroll?.max_daily_exposure_percent || 0) / 100;
  const closeToLimit = exposureLimit > 0 && exposurePercent >= exposureLimit * 0.8;
  const fallback = tr({ fi: "Alkamisaika puuttuu", en: "Kickoff unavailable", es: "Hora no disponible" });

  return <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
    <View style={styles.rowBetween}><View style={{ flex: 1 }}><Text style={styles.title}>{tr({ fi: "AI:n 5 parasta kohdetta", en: "AI Top 5 picks", es: "Top 5 de la IA" })}</Text><Text style={styles.subtitle}>{tr({ fi: "Kaikki lajit samassa vertailussa. Ihminen tekee lopullisen päätöksen.", en: "All sports ranked together. The user makes the final decision.", es: "Todos los deportes en una sola clasificación. La decisión final es del usuario." })}</Text></View><ActionButton label={tr({ fi: "Päivitä", en: "Refresh", es: "Actualizar" })} onPress={load} tone="secondary" compact disabled={loading} /></View>

    {loading ? <ActivityIndicator color="#34d399" size="large" /> : <Card>
      <Text style={styles.cardTitle}>{tr({ fi: "Parhaat kohteet juuri nyt", en: "Best picks right now", es: "Mejores opciones ahora" })}</Text>
      {topPicks.length ? topPicks.map((pick, index) => <TopPickCard key={`${pick.match}-${pick.selection}-${index}`} pick={pick} index={index} locale={locale} fallback={fallback} />) : <Text style={styles.muted}>{tr({ fi: `Seuraavan ${featuredHours} tunnin aikana ei löytynyt viittä riittävän laadukasta live-kohdetta.`, en: `Five sufficiently strong live picks were not found in the next ${featuredHours} hours.`, es: `No se encontraron cinco opciones suficientemente sólidas en las próximas ${featuredHours} horas.` })}</Text>}
    </Card>}

    <Card><Text style={styles.cardTitle}>{tr({ fi: "Aloita näin", en: "Start here", es: "Empieza así" })}</Text><StartStep number="1" title={tr({ fi: "Avaa Top 5", en: "Open Top 5", es: "Abre el Top 5" })} text={tr({ fi: "Katso ensin AI:n parhaat tutkittavat kohteet.", en: "Start with the AI-ranked candidates.", es: "Empieza por las opciones clasificadas por la IA." })} /><StartStep number="2" title={tr({ fi: "Lue koko perustelu", en: "Read the full reasoning", es: "Lee el razonamiento completo" })} text={tr({ fi: "Tarkista lähteet, riskit, vastaväite ja pois jätetyt tiedot.", en: "Check sources, risks, counterargument and excluded evidence.", es: "Revisa fuentes, riesgos, contraargumentos y datos excluidos." })} /><StartStep number="3" title={tr({ fi: "Seuraa paperilla", en: "Track on paper", es: "Haz seguimiento simulado" })} text={tr({ fi: "Käytä vain virtuaalista paperiseurantaa.", en: "Use virtual paper tracking only.", es: "Usa solo seguimiento simulado." })} /></Card>

    {!loading && <><View style={localStyles.metricGrid}><Metric label={tr({ fi: "Paperipelikassa", en: "Paper bankroll", es: "Banca simulada" })} value={money(bankroll?.bankroll)} /><Metric label={tr({ fi: "Avoin altistus", en: "Open exposure", es: "Exposición abierta" })} value={money(analytics.openExposure)} /><Metric label={tr({ fi: "Paperitulos", en: "Paper result", es: "Resultado simulado" })} value={money(analytics.totalProfit)} /><Metric label="ROI" value={percent(analytics.roi)} /></View>{closeToLimit && <Card><Text style={localStyles.warningTitle}>{tr({ fi: "Riskiraja lähestyy", en: "Risk limit is close", es: "El límite de riesgo está cerca" })}</Text><Text style={styles.muted}>{tr({ fi: `Avoin altistus on ${percent(exposurePercent)} virtuaalikassasta. SKIP voi olla hyvä päätös.`, en: `Open exposure is ${percent(exposurePercent)} of the virtual bankroll. SKIP may be a good decision.`, es: `La exposición abierta es ${percent(exposurePercent)} de la banca virtual. SKIP puede ser una buena decisión.` })}</Text></Card>}<Card><Text style={styles.cardTitle}>{tr({ fi: "Paperirajat", en: "Paper limits", es: "Límites simulados" })}</Text><Text style={styles.value}>{tr({ fi: "Enimmäispanos", en: "Maximum stake", es: "Importe máximo" })} {money(suggestedMaximum)}</Text><Text style={styles.muted}>{tr({ fi: "Rajat suojaavat paperiseurannan prosessia. Ne eivät ole suosituksia oikean rahan käyttöön.", en: "Limits protect the paper-tracking process. They are not recommendations for real-money use.", es: "Los límites protegen el proceso simulado. No son recomendaciones para usar dinero real." })}</Text><ActionButton label={showRiskSettings ? tr({ fi: "Sulje asetukset", en: "Close settings", es: "Cerrar ajustes" }) : tr({ fi: "Muokkaa paperirajoja", en: "Edit paper limits", es: "Editar límites simulados" })} onPress={() => setShowRiskSettings((value) => !value)} tone="secondary" />{showRiskSettings && <><Field label={tr({ fi: "Virtuaalikassa (€)", en: "Virtual bankroll (€)", es: "Banca virtual (€)" })} value={bankrollInput} onChangeText={setBankrollInput} keyboardType="decimal-pad" /><Field label={tr({ fi: "Yksittäisen panoksen yläraja (%)", en: "Single-stake limit (%)", es: "Límite por importe (%)" })} value={maxStakeInput} onChangeText={setMaxStakeInput} keyboardType="decimal-pad" /><Field label={tr({ fi: "Kokonaisaltistus (%)", en: "Total exposure (%)", es: "Exposición total (%)" })} value={dailyExposureInput} onChangeText={setDailyExposureInput} keyboardType="decimal-pad" /><Field label={tr({ fi: "Liiga-altistus (%)", en: "League exposure (%)", es: "Exposición por liga (%)" })} value={leagueExposureInput} onChangeText={setLeagueExposureInput} keyboardType="decimal-pad" /><Field label={tr({ fi: "Minimiedge (%)", en: "Minimum edge (%)", es: "Ventaja mínima (%)" })} value={minEdgeInput} onChangeText={setMinEdgeInput} keyboardType="decimal-pad" /><Field label={tr({ fi: "Minimi-confidence (%)", en: "Minimum confidence (%)", es: "Confianza mínima (%)" })} value={minConfidenceInput} onChangeText={setMinConfidenceInput} keyboardType="decimal-pad" /><ActionButton label={saving ? tr({ fi: "Tallennetaan…", en: "Saving…", es: "Guardando…" }) : tr({ fi: "Tallenna paperirajat", en: "Save paper limits", es: "Guardar límites simulados" })} onPress={save} disabled={saving} /></>}</Card></>}

    <Card><Text style={styles.cardTitle}>{tr({ fi: "Palvelun tila", en: "Service status", es: "Estado del servicio" })}</Text><Text style={styles.value}>{status}</Text></Card>
    <Card><Text style={styles.cardTitle}>{tr({ fi: "Tuotteen raja", en: "Product boundary", es: "Límite del producto" })}</Text><Text style={styles.value}>{tr({ fi: "Analyysi + paperiseuranta", en: "Analysis + paper tracking", es: "Análisis + seguimiento simulado" })}</Text><Text style={styles.muted}>{tr({ fi: "Ei talletuksia, kotiutuksia, maksutietoja, vedonlyöntitilejä tai oikean rahan vedonvälitystä.", en: "No deposits, withdrawals, payment data, bookmaker accounts or real-money bet execution.", es: "Sin depósitos, retiradas, datos de pago, cuentas de apuestas ni ejecución con dinero real." })}</Text></Card>
  </ScrollView>;
}

const localStyles = StyleSheet.create({
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricBox: { width: "48%", minHeight: 86, borderWidth: 1, borderColor: "#1e293b", backgroundColor: "#0f172a", borderRadius: 16, padding: 13, justifyContent: "space-between" },
  metricLabel: { color: "#94a3b8", fontSize: 12, fontWeight: "700" },
  metricValue: { color: "#f8fafc", fontSize: 21, fontWeight: "900" },
  kickoff: { color: "#34d399", fontSize: 14, fontWeight: "900", marginTop: 10 },
  warningTitle: { color: "#fbbf24", fontSize: 17, fontWeight: "900" },
  startStep: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginTop: 12 },
  stepNumber: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#34d399" },
  stepNumberText: { color: "#052e16", fontWeight: "900" },
  topPickCard: { borderTopWidth: 1, borderTopColor: "#1e293b", paddingTop: 16, marginTop: 16 },
  rankBadge: { backgroundColor: "#34d399", borderRadius: 999, minWidth: 42, paddingHorizontal: 12, paddingVertical: 7, alignItems: "center" },
  rankText: { color: "#052e16", fontWeight: "900" },
  topMetrics: { flexDirection: "row", gap: 10, marginTop: 12 },
  reasonTitle: { color: "#f8fafc", fontSize: 14, fontWeight: "900", marginTop: 14, marginBottom: 4 }
});
