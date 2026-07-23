import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useLanguage } from "../i18n";
import type { Tab } from "../types";
import { ActionButton, Card, styles } from "../ui";
import AutonomousIntelligenceScreen from "./AutonomousIntelligenceScreen";
import DataLayerScreen from "./DataLayerScreen";
import DiagnosticsScreen from "./DiagnosticsScreen";

type MoreScreenProps = { onNavigate: (tab: Tab) => void };

export default function MoreScreen({ onNavigate }: MoreScreenProps) {
  const { tr } = useLanguage();
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [dataLayerOpen, setDataLayerOpen] = useState(false);
  const [autonomousOpen, setAutonomousOpen] = useState(false);

  if (diagnosticsOpen || dataLayerOpen || autonomousOpen) {
    return (
      <View style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 18, paddingTop: 12 }}>
          <ActionButton label={`← ${tr({ fi: "Takaisin Lisää-keskukseen", en: "Back to More", es: "Volver a Más" })}`} onPress={() => { setDiagnosticsOpen(false); setDataLayerOpen(false); setAutonomousOpen(false); }} tone="secondary" compact />
        </View>
        {diagnosticsOpen ? <DiagnosticsScreen /> : dataLayerOpen ? <DataLayerScreen /> : <AutonomousIntelligenceScreen />}
      </View>
    );
  }

  const items: Array<{ tab: Tab; eyebrow: string; title: string; description: string; badge?: string }> = [
    { tab: "watchlist", eyebrow: tr({ fi: "SEURANTA", en: "TRACKING", es: "SEGUIMIENTO" }), title: tr({ fi: "Seurantalista ja hälytykset", en: "Watchlist and alerts", es: "Seguimiento y alertas" }), description: tr({ fi: "Seuraa hinnan ja päätöksen muutoksia varmennetuissa otteluissa.", en: "Track price and decision changes in verified events.", es: "Sigue cambios de cuota y decisión en eventos verificados." }), badge: "V2" },
    { tab: "analytics", eyebrow: tr({ fi: "SUORITUSKYKY", en: "PERFORMANCE", es: "RENDIMIENTO" }), title: tr({ fi: "Tulokset ja kalibrointi", en: "Results and calibration", es: "Resultados y calibración" }), description: tr({ fi: "Tarkista ROI, CLV, osumatarkkuus ja ratkaistun otoksen koko.", en: "Review ROI, CLV, hit rate and settled sample size.", es: "Revisa ROI, CLV, acierto y tamaño de muestra." }), badge: "V12" },
    { tab: "settings", eyebrow: tr({ fi: "TILI", en: "ACCOUNT", es: "CUENTA" }), title: tr({ fi: "Profiili ja asetukset", en: "Profile and settings", es: "Perfil y ajustes" }), description: tr({ fi: "Kieli, pilvitili, tietosuoja, vienti ja tilin poistaminen.", en: "Language, cloud account, privacy, export and account deletion.", es: "Idioma, cuenta, privacidad, exportación y eliminación." }) }
  ];

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.mobileHero}>
        <Text style={styles.kicker}>SCORECASTER MOBILE</Text>
        <Text style={styles.title}>{tr({ fi: "Lisää työkalut ilman ahdasta alapalkkia", en: "More tools without a crowded tab bar", es: "Más herramientas sin una barra saturada" })}</Text>
        <Text style={styles.subtitle}>{tr({ fi: "Autonominen V12, seuranta, analytiikka, diagnostiikka, datakerros ja profiili löytyvät tästä keskuksesta.", en: "Autonomous V12, tracking, analytics, diagnostics, the data layer and profile live in this hub.", es: "V12 autónomo, seguimiento, analítica, diagnóstico, datos y perfil están aquí." })}</Text>
      </View>

      <Pressable accessibilityLabel={tr({ fi: "Avaa Autonomous Intelligence V12", en: "Open Autonomous Intelligence V12", es: "Abrir Autonomous Intelligence V12" })} accessibilityRole="button" onPress={() => setAutonomousOpen(true)} style={({ pressed }) => [pressed && styles.cardPressed]}>
        <Card><View style={styles.rowBetween}><Text style={styles.kicker}>{tr({ fi: "AUTONOMINEN AI", en: "AUTONOMOUS AI", es: "IA AUTÓNOMA" })}</Text><View style={styles.badge}><Text style={styles.badgeText}>V12</Text></View></View><Text style={styles.cardTitle}>Autonomous Intelligence</Text><Text style={styles.muted}>{tr({ fi: "Health score, kill switch, provider-portit, champion–challenger, oppiminen ja paperiajot.", en: "Health score, kill switch, provider gates, champion–challenger, learning and paper cycles.", es: "Salud, parada automática, proveedores, modelos, aprendizaje y ciclos simulados." })}</Text><Text style={styles.openLabel}>{tr({ fi: "Avaa autonominen ohjaamo", en: "Open autonomous cockpit", es: "Abrir control autónomo" })} →</Text></Card>
      </Pressable>

      <Pressable accessibilityLabel={tr({ fi: "Avaa päätösdiagnostiikka", en: "Open decision diagnostics", es: "Abrir diagnóstico de decisiones" })} accessibilityRole="button" onPress={() => setDiagnosticsOpen(true)} style={({ pressed }) => [pressed && styles.cardPressed]}>
        <Card><View style={styles.rowBetween}><Text style={styles.kicker}>{tr({ fi: "JÄRJESTELMÄN TERVEYS", en: "SYSTEM HEALTH", es: "SALUD DEL SISTEMA" })}</Text><View style={styles.badge}><Text style={styles.badgeText}>V2.1</Text></View></View><Text style={styles.cardTitle}>{tr({ fi: "Päätösdiagnostiikka", en: "Decision diagnostics", es: "Diagnóstico de decisiones" })}</Text><Text style={styles.muted}>{tr({ fi: "Historia, all-SKIP- ja stale-hälytykset, Provider Health, tulokset, CLV ja kynnysarvosimulaatio.", en: "History, all-SKIP and stale alerts, Provider Health, outcomes, CLV and threshold simulation.", es: "Historial, alertas, proveedor, resultados, CLV y simulación." })}</Text><Text style={styles.openLabel}>{tr({ fi: "Avaa natiivinäkymä", en: "Open native view", es: "Abrir vista nativa" })} →</Text></Card>
      </Pressable>

      <Pressable accessibilityLabel={tr({ fi: "Avaa yhdistetty datakerros", en: "Open unified data layer", es: "Abrir capa de datos" })} accessibilityRole="button" onPress={() => setDataLayerOpen(true)} style={({ pressed }) => [pressed && styles.cardPressed]}>
        <Card><View style={styles.rowBetween}><Text style={styles.kicker}>DATA & AI</Text><View style={styles.badge}><Text style={styles.badgeText}>V2</Text></View></View><Text style={styles.cardTitle}>Unified Sports Data</Text><Text style={styles.muted}>{tr({ fi: "Nykyinen data-audit, historia, provider-laatu, closing odds ja chronology-safe kalibrointi.", en: "Current data audit, history, provider quality, closing odds and chronology-safe calibration.", es: "Auditoría, historial, calidad, cierre y calibración segura." })}</Text><Text style={styles.openLabel}>{tr({ fi: "Avaa data-audit", en: "Open data audit", es: "Abrir auditoría" })} →</Text></Card>
      </Pressable>

      {items.map((item) => <Pressable accessibilityLabel={item.title} accessibilityRole="button" key={item.tab} onPress={() => onNavigate(item.tab)} style={({ pressed }) => [pressed && styles.cardPressed]}><Card><View style={styles.rowBetween}><Text style={styles.kicker}>{item.eyebrow}</Text>{item.badge ? <View style={styles.badge}><Text style={styles.badgeText}>{item.badge}</Text></View> : null}</View><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.muted}>{item.description}</Text><Text style={styles.openLabel}>{tr({ fi: "Avaa", en: "Open", es: "Abrir" })} →</Text></Card></Pressable>)}

      <Card><Text style={styles.cardTitle}>{tr({ fi: "Paperitila säilyy kaikkialla", en: "Paper mode stays everywhere", es: "El modo simulado permanece" })}</Text><Text style={styles.muted}>{tr({ fi: "V12 ei käsittele talletuksia, vedonvälittäjätilejä tai oikean rahan vetoja.", en: "V12 does not handle deposits, bookmaker accounts or real-money bets.", es: "V12 no gestiona depósitos, cuentas ni apuestas reales." })}</Text></Card>
    </ScrollView>
  );
}
