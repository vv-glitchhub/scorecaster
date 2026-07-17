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
  return (
    <View style={localStyles.startStep}>
      <View style={localStyles.stepNumber}><Text style={localStyles.stepNumberText}>{number}</Text></View>
      <View style={{ flex: 1 }}><Text style={styles.value}>{title}</Text><Text style={styles.muted}>{text}</Text></View>
    </View>
  );
}

function kickoffLabel(value: string | undefined, locale: string, fallback: string) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export default function HomeScreen() {
  const { tr, locale } = useLanguage();
  const [bankroll, setBankroll] = useState<Bankroll | null>(null);
  const [bets, setBets] = useState<PaperBet[]>([]);
  const [topPick, setTopPick] = useState<Pick | null>(null);
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
        apiRequest<{ featured?: Pick[]; data?: Pick[]; featuredWindowHours?: number }>("/api/top-picks", { authenticated: false, timeoutMs: 30000 })
      ]);

      setStatus(healthResult.status === "fulfilled"
        ? `${healthResult.value.status || "unknown"} · ${healthResult.value.mode || "unknown"}`
        : tr({ fi: "Palvelun tilaa ei voitu tarkistaa", en: "Service status could not be checked", es: "No se pudo comprobar el estado del servicio" }));

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
        setTopPick(picksResult.value.featured?.[0] || null);
        setFeaturedHours(Number(picksResult.value.featuredWindowHours || 72));
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : tr({ fi: "Palveluvirhe", en: "Service error", es: "Error del servicio" }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [tr]);

  async function save() {
    const bankrollNumber = numberValue(bankrollInput);
    const maxStake = numberValue(maxStakeInput);
    const dailyExposure = numberValue(dailyExposureInput);
    const leagueExposure = numberValue(leagueExposureInput);
    const minEdgePercent = numberValue(minEdgeInput);
    const minConfidencePercent = numberValue(minConfidenceInput);

    if (
      bankrollNumber === null || bankrollNumber < 0 || bankrollNumber > 10000000 ||
      maxStake === null || maxStake < 0.1 || maxStake > 10 ||
      dailyExposure === null || dailyExposure < 0.5 || dailyExposure > 50 ||
      leagueExposure === null || leagueExposure < 0.5 || leagueExposure > 25 ||
      minEdgePercent === null || minEdgePercent < 0 || minEdgePercent > 20 ||
      minConfidencePercent === null || minConfidencePercent < 0 || minConfidencePercent > 100
    ) {
      Alert.alert(
        tr({ fi: "Tarkista rajat", en: "Check the limits", es: "Revisa los límites" }),
        tr({ fi: "Virtuaalikassa 0–10 000 000 €, panos 0,1–10 %, kokonaisaltistus 0,5–50 %, liiga-altistus 0,5–25 %, minimiedge 0–20 % ja confidence 0–100 %.", en: "Virtual bankroll 0–10,000,000 €, stake 0.1–10%, total exposure 0.5–50%, league exposure 0.5–25%, minimum edge 0–20% and confidence 0–100%.", es: "Banca virtual 0–10.000.000 €, importe 0,1–10 %, exposición total 0,5–50 %, exposición por liga 0,5–25 %, ventaja mínima 0–20 % y confianza 0–100 %." })
      );
      return;
    }

    setSaving(true);
    try {
      const response = await apiRequest<{ data: Bankroll }>("/api/cloud/bankroll", {
        method: "PUT",
        body: {
          bankroll: bankrollNumber,
          maxStakePercent: maxStake,
          maxDailyExposurePercent: dailyExposure,
          maxSingleLeagueExposurePercent: leagueExposure,
          minEdge: minEdgePercent / 100,
          minConfidence: minConfidencePercent / 100
        }
      });
      setBankroll(response.data);
      setShowRiskSettings(false);
      Alert.alert(tr({ fi: "Tallennettu", en: "Saved", es: "Guardado" }), tr({ fi: "Virtuaalikassa ja paperirajat päivitettiin.", en: "Virtual bankroll and paper limits were updated.", es: "Se actualizaron la banca virtual y los límites simulados." }));
    } catch (error) {
      Alert.alert(tr({ fi: "Tallennus epäonnistui", en: "Save failed", es: "No se pudo guardar" }), error instanceof Error ? error.message : tr({ fi: "Tuntematon virhe", en: "Unknown error", es: "Error desconocido" }));
    } finally {
      setSaving(false);
    }
  }

  const analytics = useMemo(() => calculatePaperAnalytics(bets), [bets]);
  const suggestedMaximum = bankroll ? bankroll.bankroll * bankroll.max_stake_percent / 100 : 0;
  const exposurePercent = bankroll?.bankroll ? analytics.openExposure / bankroll.bankroll : 0;
  const exposureLimit = Number(bankroll?.max_daily_exposure_percent || 0) / 100;
  const closeToLimit = exposureLimit > 0 && exposurePercent >= exposureLimit * 0.8;

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <View style={styles.rowBetween}>
        <View style={{ flex: 1 }}><Text style={styles.title}>{tr({ fi: "Lähiaika", en: "Near term", es: "Próximamente" })}</Text><Text style={styles.subtitle}>{tr({ fi: "Aloita rajasta, lue AI:n vastaväite ja tallenna vain paperiseurantaan.", en: "Start with limits, read the AI counterargument and save only to paper tracking.", es: "Empieza por los límites, lee el contraargumento de la IA y guarda solo en seguimiento simulado." })}</Text></View>
        <ActionButton label={tr({ fi: "Päivitä", en: "Refresh", es: "Actualizar" })} onPress={load} tone="secondary" compact disabled={loading} />
      </View>

      <Card>
        <Text style={styles.cardTitle}>{tr({ fi: "Aloita näin", en: "Start here", es: "Empieza así" })}</Text>
        <StartStep number="1" title={tr({ fi: "Tarkista paperiraja", en: "Check paper limits", es: "Revisa los límites simulados" })} text={tr({ fi: "Pidä virtuaalinen panos ja avoin altistus pieninä.", en: "Keep the virtual stake and open exposure small.", es: "Mantén bajos el importe virtual y la exposición abierta." })} />
        <StartStep number="2" title={tr({ fi: "Avaa Kohteet tai AI", en: "Open Picks or AI", es: "Abre Pronósticos o IA" })} text={tr({ fi: "AI näyttää myös vastaväitteen ja puuttuvan evidenssin.", en: "AI also shows the counterargument and missing evidence.", es: "La IA también muestra el contraargumento y la evidencia faltante." })} />
        <StartStep number="3" title={tr({ fi: "Seuraa tulosta", en: "Track the result", es: "Sigue el resultado" })} text={tr({ fi: "Seurannassa käsitellään vain virtuaalisia paperikohteita.", en: "Tracking contains virtual paper picks only.", es: "El seguimiento contiene solo pronósticos simulados." })} />
      </Card>

      {loading ? <ActivityIndicator color="#34d399" size="large" /> : (
        <>
          <View style={localStyles.metricGrid}>
            <Metric label={tr({ fi: "Paperipelikassa", en: "Paper bankroll", es: "Banca simulada" })} value={money(bankroll?.bankroll)} />
            <Metric label={tr({ fi: "Avoin altistus", en: "Open exposure", es: "Exposición abierta" })} value={money(analytics.openExposure)} />
            <Metric label={tr({ fi: "Paperitulos", en: "Paper result", es: "Resultado simulado" })} value={money(analytics.totalProfit)} />
            <Metric label="ROI" value={percent(analytics.roi)} />
          </View>

          {closeToLimit && <Card><Text style={localStyles.warningTitle}>{tr({ fi: "Riskiraja lähestyy", en: "Risk limit is close", es: "El límite de riesgo está cerca" })}</Text><Text style={styles.muted}>{tr({ fi: `Avoin altistus on ${percent(exposurePercent)} virtuaalikassasta. SKIP voi olla hyvä päätös.`, en: `Open exposure is ${percent(exposurePercent)} of the virtual bankroll. SKIP may be a good decision.`, es: `La exposición abierta es ${percent(exposurePercent)} de la banca virtual. SKIP puede ser una buena decisión.` })}</Text></Card>}

          <Card>
            <Text style={styles.cardTitle}>{tr({ fi: "Lähiajan paras markkina-arvo", en: "Best near-term market value", es: "Mejor valor próximo del mercado" })}</Text>
            {topPick ? <>
              <View style={styles.rowBetween}><View style={[styles.badge, topPick.productDecision === "CAUTION" && styles.warningBadge]}><Text style={styles.badgeText}>{topPick.productDecision || "CAUTION"}</Text></View><Text style={styles.muted}>{topPick.leagueTitle || topPick.league || ""}</Text></View>
              <Text style={localStyles.kickoff}>{kickoffLabel(topPick.commenceTime, locale, tr({ fi: "Alkamisaika puuttuu", en: "Kickoff unavailable", es: "Hora no disponible" }))}</Text>
              <Text style={styles.value}>{topPick.match}</Text>
              <Text style={styles.cardTitle}>{topPick.selection} · {Number(topPick.odds || 0).toFixed(2)}</Text>
              <Text style={styles.muted}>Edge {percent(topPick.edge)} · {tr({ fi: "datan confidence", en: "data confidence", es: "confianza de datos" })} {percent(topPick.confidence)} · {Number(topPick.bookmakerCount || 0)} {tr({ fi: "lähdettä", en: "sources", es: "fuentes" })}.</Text>
              <Text style={styles.muted}>{tr({ fi: "Ottelu tulee live-kertoimien tarjoajalta. Avaa AI-välilehti nähdäksesi stressitestin ja vastaväitteen.", en: "The fixture comes from the live odds provider. Open AI to see the stress test and counterargument.", es: "El partido procede del proveedor de cuotas en vivo. Abre IA para ver la prueba de estrés y el contraargumento." })}</Text>
            </> : <Text style={styles.muted}>{tr({ fi: `Seuraavan ${featuredHours} tunnin aikana ei löytynyt riittävän laadukasta live-API-kohdetta. Kaukaisia otteluita ei näytetä päivän kohteina.`, en: `No sufficiently strong live-API pick was found in the next ${featuredHours} hours. Distant fixtures are not presented as today's picks.`, es: `No se encontró un pronóstico suficiente de la API en vivo para las próximas ${featuredHours} horas. Los partidos lejanos no se presentan como pronósticos de hoy.` })}</Text>}
          </Card>

          <Card>
            <Text style={styles.cardTitle}>{tr({ fi: "Paperirajat", en: "Paper limits", es: "Límites simulados" })}</Text>
            <Text style={styles.value}>{tr({ fi: "Enimmäispanos", en: "Maximum stake", es: "Importe máximo" })} {money(suggestedMaximum)}</Text>
            <Text style={styles.muted}>{tr({ fi: "Rajat suojaavat paperiseurannan prosessia. Ne eivät ole suosituksia oikean rahan käyttöön.", en: "Limits protect the paper-tracking process. They are not recommendations for real-money use.", es: "Los límites protegen el proceso simulado. No son recomendaciones para usar dinero real." })}</Text>
            <ActionButton label={showRiskSettings ? tr({ fi: "Sulje asetukset", en: "Close settings", es: "Cerrar ajustes" }) : tr({ fi: "Muokkaa paperirajoja", en: "Edit paper limits", es: "Editar límites simulados" })} onPress={() => setShowRiskSettings((value) => !value)} tone="secondary" />
            {showRiskSettings && <>
              <Field label={tr({ fi: "Virtuaalikassa (€)", en: "Virtual bankroll (€)", es: "Banca virtual (€)" })} value={bankrollInput} onChangeText={setBankrollInput} keyboardType="decimal-pad" />
              <Field label={tr({ fi: "Yksittäisen panoksen yläraja (%)", en: "Single-stake limit (%)", es: "Límite por importe (%)" })} value={maxStakeInput} onChangeText={setMaxStakeInput} keyboardType="decimal-pad" />
              <Field label={tr({ fi: "Kokonaisaltistus (%)", en: "Total exposure (%)", es: "Exposición total (%)" })} value={dailyExposureInput} onChangeText={setDailyExposureInput} keyboardType="decimal-pad" />
              <Field label={tr({ fi: "Liiga-altistus (%)", en: "League exposure (%)", es: "Exposición por liga (%)" })} value={leagueExposureInput} onChangeText={setLeagueExposureInput} keyboardType="decimal-pad" />
              <Field label={tr({ fi: "Minimiedge (%)", en: "Minimum edge (%)", es: "Ventaja mínima (%)" })} value={minEdgeInput} onChangeText={setMinEdgeInput} keyboardType="decimal-pad" />
              <Field label={tr({ fi: "Minimi-confidence (%)", en: "Minimum confidence (%)", es: "Confianza mínima (%)" })} value={minConfidenceInput} onChangeText={setMinConfidenceInput} keyboardType="decimal-pad" />
              <ActionButton label={saving ? tr({ fi: "Tallennetaan…", en: "Saving…", es: "Guardando…" }) : tr({ fi: "Tallenna paperirajat", en: "Save paper limits", es: "Guardar límites simulados" })} onPress={save} disabled={saving} />
            </>}
          </Card>
        </>
      )}

      <Card><Text style={styles.cardTitle}>{tr({ fi: "Palvelun tila", en: "Service status", es: "Estado del servicio" })}</Text><Text style={styles.value}>{status}</Text><Text style={styles.muted}>{tr({ fi: "Todennäköisyys perustuu markkinan marginaalista puhdistettuun konsensukseen.", en: "Probability is based on market consensus after removing margin.", es: "La probabilidad se basa en el consenso de mercado después de eliminar el margen." })}</Text></Card>
      <Card><Text style={styles.cardTitle}>{tr({ fi: "Tuotteen raja", en: "Product boundary", es: "Límite del producto" })}</Text><Text style={styles.value}>{tr({ fi: "Analyysi + paperiseuranta", en: "Analysis + paper tracking", es: "Análisis + seguimiento simulado" })}</Text><Text style={styles.muted}>{tr({ fi: "Ei talletuksia, kotiutuksia, maksutietoja, vedonlyöntitilejä tai oikean rahan vedonvälitystä.", en: "No deposits, withdrawals, payment data, bookmaker accounts or real-money bet execution.", es: "Sin depósitos, retiradas, datos de pago, cuentas de apuestas ni ejecución con dinero real." })}</Text></Card>
    </ScrollView>
  );
}

const localStyles = StyleSheet.create({
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricBox: { width: "48%", minHeight: 86, borderWidth: 1, borderColor: "#1e293b", backgroundColor: "#0f172a", borderRadius: 16, padding: 13, justifyContent: "space-between" },
  metricLabel: { color: "#94a3b8", fontSize: 12, fontWeight: "700" },
  metricValue: { color: "#f8fafc", fontSize: 21, fontWeight: "900" },
  kickoff: { color: "#34d399", fontSize: 14, fontWeight: "900" },
  warningTitle: { color: "#fbbf24", fontSize: 17, fontWeight: "900" },
  startStep: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginTop: 12 },
  stepNumber: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#34d399" },
  stepNumberText: { color: "#052e16", fontWeight: "900" }
});
