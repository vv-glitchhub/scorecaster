import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useLanguage } from "../i18n";
import type { Tab } from "../types";
import { ActionButton, Card, styles } from "../ui";
import AutoWatchScreen from "./AutoWatchScreen";
import AutonomousAgentScreen from "./AutonomousAgentScreen";
import DataLayerScreen from "./DataLayerScreen";
import DiagnosticsScreen from "./DiagnosticsScreen";
import MissionControlScreen from "./MissionControlScreen";

type MoreScreenProps = {
  onNavigate: (tab: Tab) => void;
};

export default function MoreScreen({ onNavigate }: MoreScreenProps) {
  const { tr } = useLanguage();
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [dataLayerOpen, setDataLayerOpen] = useState(false);
  const [missionControlOpen, setMissionControlOpen] = useState(false);
  const [autonomousOpen, setAutonomousOpen] = useState(false);
  const [autoWatchOpen, setAutoWatchOpen] = useState(false);

  if (diagnosticsOpen || dataLayerOpen || missionControlOpen || autonomousOpen || autoWatchOpen) {
    return (
      <View style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 18, paddingTop: 12 }}>
          <ActionButton label={`← ${tr({ fi: "Takaisin Lisää-keskukseen", en: "Back to More", es: "Volver a Más" })}`} onPress={() => { setDiagnosticsOpen(false); setDataLayerOpen(false); setMissionControlOpen(false); setAutonomousOpen(false); setAutoWatchOpen(false); }} tone="secondary" compact />
        </View>
        {diagnosticsOpen ? <DiagnosticsScreen /> : dataLayerOpen ? <DataLayerScreen /> : autonomousOpen ? <AutonomousAgentScreen /> : autoWatchOpen ? <AutoWatchScreen /> : <MissionControlScreen />}
      </View>
    );
  }

  const items: Array<{
    tab: Tab;
    eyebrow: string;
    title: string;
    description: string;
    badge?: string;
  }> = [
    {
      tab: "watchlist",
      eyebrow: tr({ fi: "SEURANTA", en: "TRACKING", es: "SEGUIMIENTO" }),
      title: tr({ fi: "Seurantalista ja hälytykset", en: "Watchlist and alerts", es: "Seguimiento y alertas" }),
      description: tr({ fi: "Seuraa hinnan ja päätöksen muutoksia varmennetuissa otteluissa.", en: "Track price and decision changes in verified events.", es: "Sigue cambios de cuota y decisión en eventos verificados." }),
      badge: "V2"
    },
    {
      tab: "analytics",
      eyebrow: tr({ fi: "SUORITUSKYKY", en: "PERFORMANCE", es: "RENDIMIENTO" }),
      title: tr({ fi: "Tulokset ja kalibrointi", en: "Results and calibration", es: "Resultados y calibración" }),
      description: tr({ fi: "Tarkista ROI, CLV, osumatarkkuus ja ratkaistun otoksen koko.", en: "Review ROI, CLV, hit rate and settled sample size.", es: "Revisa ROI, CLV, acierto y tamaño de muestra." }),
      badge: "V11"
    },
    {
      tab: "settings",
      eyebrow: tr({ fi: "TILI", en: "ACCOUNT", es: "CUENTA" }),
      title: tr({ fi: "Profiili ja asetukset", en: "Profile and settings", es: "Perfil y ajustes" }),
      description: tr({ fi: "Kieli, pilvitili, tietosuoja, vienti ja tilin poistaminen.", en: "Language, cloud account, privacy, export and account deletion.", es: "Idioma, cuenta, privacidad, exportación y eliminación." })
    }
  ];

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.mobileHero}>
        <Text style={styles.kicker}>SCORECASTER MOBILE</Text>
        <Text style={styles.title}>{tr({ fi: "Lisää työkalut ilman ahdasta alapalkkia", en: "More tools without a crowded tab bar", es: "Más herramientas sin una barra saturada" })}</Text>
        <Text style={styles.subtitle}>{tr({ fi: "Päivittäiset päätoiminnot pysyvät alapalkissa. Recommendation Auto-Watch, Mission Control, V13-autonomia, seuranta, analytiikka, diagnostiikka, datakerros ja profiili löytyvät tästä keskuksesta.", en: "Daily actions stay in the tab bar. Recommendation Auto-Watch, Mission Control, V13 autonomy, tracking, analytics, diagnostics, the data layer and profile live here.", es: "Las acciones diarias quedan en la barra. Recommendation Auto-Watch, Mission Control, autonomía V13, seguimiento, analítica, diagnóstico y perfil están aquí." })}</Text>
      </View>

      <Pressable accessibilityLabel={tr({ fi: "Avaa Recommendation Auto-Watch", en: "Open Recommendation Auto-Watch", es: "Abrir Recommendation Auto-Watch" })} accessibilityRole="button" onPress={() => setAutoWatchOpen(true)} style={({ pressed }) => [pressed && styles.cardPressed]}>
        <Card>
          <View style={styles.rowBetween}><Text style={styles.kicker}>RECOMMENDATION OPERATIONS</Text><View style={styles.badge}><Text style={styles.badgeText}>V1</Text></View></View>
          <Text style={styles.cardTitle}>{tr({ fi: "Auto-Watch Top 1–10", en: "Auto-Watch Top 1–10", es: "Auto-Watch Top 1–10" })}</Text>
          <Text style={styles.muted}>{tr({ fi: "Näe Recommendation Top 3, seuraava päätösportti ja evidenssin readiness sekä valvo kärkiehdokkaita automaattisesti nykyisen Alert Inboxin kautta.", en: "See the Recommendation Top 3, next decision gate and evidence readiness, and monitor leading candidates automatically through the existing Alert Inbox.", es: "Consulta el Top 3, el siguiente filtro y la evidencia, y supervisa candidatos automáticamente mediante Alert Inbox." })}</Text>
          <Text style={styles.openLabel}>{tr({ fi: "Avaa Auto-Watch", en: "Open Auto-Watch", es: "Abrir Auto-Watch" })} →</Text>
        </Card>
      </Pressable>

      <Pressable accessibilityLabel={tr({ fi: "Avaa autonominen Mission Control", en: "Open Autonomous Mission Control", es: "Abrir Mission Control autónomo" })} accessibilityRole="button" onPress={() => setMissionControlOpen(true)} style={({ pressed }) => [pressed && styles.cardPressed]}>
        <Card>
          <View style={styles.rowBetween}><Text style={styles.kicker}>{tr({ fi: "MISSION CONTROL", en: "MISSION CONTROL", es: "MISSION CONTROL" })}</Text><View style={styles.badge}><Text style={styles.badgeText}>V12</Text></View></View>
          <Text style={styles.cardTitle}>{tr({ fi: "Autonomous Mission Control", en: "Autonomous Mission Control", es: "Mission Control autónomo" })}</Text>
          <Text style={styles.muted}>{tr({ fi: "Autonomiatila, circuit breakerit, mallidrift, provider-data, ehdokkaat ja worker-ajot.", en: "Autonomy mode, circuit breakers, model drift, provider data, candidates and worker cycles.", es: "Modo, límites, deriva, datos, candidatos y ciclos." })}</Text>
          <Text style={styles.openLabel}>{tr({ fi: "Avaa ohjaamo", en: "Open cockpit", es: "Abrir centro" })} →</Text>
        </Card>
      </Pressable>

      <Pressable accessibilityLabel={tr({ fi: "Avaa V13-autonomian hallinta", en: "Open V13 autonomy governance", es: "Abrir control autónomo V13" })} accessibilityRole="button" onPress={() => setAutonomousOpen(true)} style={({ pressed }) => [pressed && styles.cardPressed]}>
        <Card>
          <View style={styles.rowBetween}><Text style={styles.kicker}>{tr({ fi: "AUTONOMIA & RISKI", en: "AUTONOMY & RISK", es: "AUTONOMÍA & RIESGO" })}</Text><View style={styles.badge}><Text style={styles.badgeText}>V13</Text></View></View>
          <Text style={styles.cardTitle}>{tr({ fi: "Autonomous Governance", en: "Autonomous Governance", es: "Gobierno autónomo" })}</Text>
          <Text style={styles.muted}>{tr({ fi: "Readiness, hätäpysäytys, Unified Data -portit, drawdown/CLV-jarru, daily brief ja täydellinen päätösaudit.", en: "Readiness, emergency stop, Unified Data gates, drawdown/CLV brake, daily brief and complete decision audit.", es: "Preparación, parada, datos, drawdown/CLV, resumen y auditoría." })}</Text>
          <Text style={styles.openLabel}>{tr({ fi: "Avaa V13-hallinta", en: "Open V13 governance", es: "Abrir V13" })} →</Text>
        </Card>
      </Pressable>

      <Pressable accessibilityLabel={tr({ fi: "Avaa päätösdiagnostiikka", en: "Open decision diagnostics", es: "Abrir diagnóstico de decisiones" })} accessibilityRole="button" onPress={() => setDiagnosticsOpen(true)} style={({ pressed }) => [pressed && styles.cardPressed]}>
        <Card>
          <View style={styles.rowBetween}><Text style={styles.kicker}>{tr({ fi: "JÄRJESTELMÄN TERVEYS", en: "SYSTEM HEALTH", es: "SALUD DEL SISTEMA" })}</Text><View style={styles.badge}><Text style={styles.badgeText}>V2.1</Text></View></View>
          <Text style={styles.cardTitle}>{tr({ fi: "Päätösdiagnostiikka", en: "Decision diagnostics", es: "Diagnóstico de decisiones" })}</Text>
          <Text style={styles.muted}>{tr({ fi: "Historia, all-SKIP- ja stale-hälytykset, Provider Health, tulokset, CLV ja kynnysarvosimulaatio.", en: "History, all-SKIP and stale alerts, Provider Health, outcomes, CLV and threshold simulation.", es: "Historial, alertas, proveedor, resultados, CLV y simulación." })}</Text>
          <Text style={styles.openLabel}>{tr({ fi: "Avaa natiivinäkymä", en: "Open native view", es: "Abrir vista nativa" })} →</Text>
        </Card>
      </Pressable>

      <Pressable accessibilityLabel={tr({ fi: "Avaa yhdistetty datakerros", en: "Open unified data layer", es: "Abrir capa de datos" })} accessibilityRole="button" onPress={() => setDataLayerOpen(true)} style={({ pressed }) => [pressed && styles.cardPressed]}>
        <Card>
          <View style={styles.rowBetween}><Text style={styles.kicker}>DATA & AI</Text><View style={styles.badge}><Text style={styles.badgeText}>V2</Text></View></View>
          <Text style={styles.cardTitle}>Unified Sports Data</Text>
          <Text style={styles.muted}>{tr({ fi: "Näe mitä odds-, kokoonpano-, loukkaantumis-, vire-, lepo-, matka-, sää- ja uutisdataa AI käytti sekä mihin se vaikutti.", en: "See which odds, lineup, injury, form, rest, travel, weather and news data AI used and how it affected the analysis.", es: "Consulta qué datos utilizó la IA y cómo afectaron al análisis." })}</Text>
          <Text style={styles.openLabel}>{tr({ fi: "Avaa data-audit", en: "Open data audit", es: "Abrir auditoría" })} →</Text>
        </Card>
      </Pressable>

      {items.map((item) => (
        <Pressable accessibilityLabel={item.title} accessibilityRole="button" key={item.tab} onPress={() => onNavigate(item.tab)} style={({ pressed }) => [pressed && styles.cardPressed]}>
          <Card>
            <View style={styles.rowBetween}><Text style={styles.kicker}>{item.eyebrow}</Text>{item.badge ? <View style={styles.badge}><Text style={styles.badgeText}>{item.badge}</Text></View> : null}</View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.muted}>{item.description}</Text>
            <Text style={styles.openLabel}>{tr({ fi: "Avaa", en: "Open", es: "Abrir" })} →</Text>
          </Card>
        </Pressable>
      ))}

      <Card><Text style={styles.cardTitle}>{tr({ fi: "Paperitila säilyy kaikkialla", en: "Paper mode stays everywhere", es: "El modo simulado permanece" })}</Text><Text style={styles.muted}>{tr({ fi: "Mobiilisovellus ei käsittele talletuksia, vedonvälittäjätilejä tai oikean rahan vetoja. V13:n oppiminen pysyy shadow-tilassa.", en: "The mobile app does not handle deposits, bookmaker accounts or real-money bets. V13 learning remains shadow-only.", es: "La app no gestiona dinero real y el aprendizaje V13 permanece en sombra." })}</Text></Card>
    </ScrollView>
  );
}
