import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, SafeAreaView, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import type { Session } from "@supabase/supabase-js";
import HeaderAlertButton from "./components/HeaderAlertButton";
import AgentScreen from "./screens/AgentScreen";
import AnalyticsScreen from "./screens/AnalyticsScreen";
import AuthScreen from "./screens/AuthScreen";
import EventDetailScreen from "./screens/EventDetailScreen";
import HomeScreen from "./screens/HomeScreen";
import MoreScreen from "./screens/MoreScreen";
import PaperBetsScreen from "./screens/PaperBetsScreen";
import PicksScreen from "./screens/PicksScreen";
import SettingsScreen from "./screens/SettingsScreen";
import WatchlistScreen from "./screens/WatchlistScreen";
import { LanguageProvider, useLanguage } from "./i18n";
import { handleAuthCallbackUrl } from "./lib/auth-deep-link";
import { mobileAuthConfigured, supabase } from "./lib/supabase";
import type { Pick, Tab } from "./types";
import { BrandMark, styles } from "./ui";

function MainApp({ session }: { session: Session }) {
  const { tr } = useLanguage();
  const [tab, setTab] = useState<Tab>("home");
  const [selectedEvent, setSelectedEvent] = useState<Pick | null>(null);
  const tabs = useMemo(() => [
    { key: "home" as Tab, icon: "⌂", label: tr({ fi: "Koti", en: "Home", es: "Inicio" }), accessibilityLabel: tr({ fi: "Etusivu ja papeririskit", en: "Home and paper risks", es: "Inicio y riesgos simulados" }) },
    { key: "picks" as Tab, icon: "◫", label: tr({ fi: "Kohteet", en: "Picks", es: "Pronóst." }), accessibilityLabel: tr({ fi: "Lähiajan analysoidut kohteet", en: "Near-term analyzed picks", es: "Pronósticos próximos analizados" }) },
    { key: "agent" as Tab, icon: "✦", label: "AI", accessibilityLabel: tr({ fi: "Agent V11 päätöskopilotti", en: "Agent V11 decision copilot", es: "Copiloto de decisiones Agent V11" }) },
    { key: "paper" as Tab, icon: "◎", label: tr({ fi: "Paperi", en: "Paper", es: "Papel" }), accessibilityLabel: tr({ fi: "Paperivetojen seuranta", en: "Paper-pick tracking", es: "Seguimiento de pronósticos simulados" }) },
    { key: "more" as Tab, icon: "•••", label: tr({ fi: "Lisää", en: "More", es: "Más" }), accessibilityLabel: tr({ fi: "Seuranta, analytiikka ja profiili", en: "Tracking, analytics and profile", es: "Seguimiento, analítica y perfil" }) }
  ], [tr]);

  function chooseTab(next: Tab) {
    setSelectedEvent(null);
    setTab(next);
  }

  const activePrimaryTab: Tab = ["watchlist", "analytics", "settings"].includes(tab) ? "more" : tab;
  const subline = selectedEvent
    ? tr({ fi: "Varmennettu ottelunäkymä", en: "Verified event detail", es: "Detalle verificado" })
    : tab === "watchlist"
      ? tr({ fi: "Seurantalista ja hälytykset", en: "Watchlist and alerts", es: "Seguimiento y alertas" })
      : tab === "analytics"
        ? tr({ fi: "Tulokset ja kalibrointi", en: "Results and calibration", es: "Resultados y calibración" })
        : tab === "settings"
          ? tr({ fi: "Profiili ja tietosuoja", en: "Profile and privacy", es: "Perfil y privacidad" })
          : tr({ fi: "Urheiluanalyysi ja paperiseuranta", en: "Sports analysis and paper tracking", es: "Análisis deportivo y seguimiento simulado" });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <View style={styles.headerBrandRow}>
          <BrandMark compact />
          <View style={{ flex: 1 }}>
            <Text style={styles.headerBrand}>Scorecaster</Text>
            <Text numberOfLines={1} style={styles.headerSubline}>{subline}</Text>
          </View>
        </View>
        <HeaderAlertButton onPress={() => chooseTab("watchlist")} />
        <Text style={styles.headerMode}>{tr({ fi: "PAPERITILA", en: "PAPER MODE", es: "MODO SIMULADO" })}</Text>
      </View>

      <View style={styles.content}>
        {selectedEvent ? <EventDetailScreen pick={selectedEvent} onBack={() => setSelectedEvent(null)} /> : <>
          {tab === "home" && <HomeScreen />}
          {tab === "picks" && <PicksScreen onOpenEvent={setSelectedEvent} />}
          {tab === "agent" && <AgentScreen />}
          {tab === "paper" && <PaperBetsScreen />}
          {tab === "more" && <MoreScreen onNavigate={chooseTab} />}
          {tab === "watchlist" && <WatchlistScreen />}
          {tab === "analytics" && <AnalyticsScreen />}
          {tab === "settings" && <SettingsScreen session={session} />}
        </>}
      </View>

      {!selectedEvent && <View accessibilityRole="tablist" style={styles.tabBar}>
        {tabs.map((item) => {
          const selected = activePrimaryTab === item.key;
          return (
            <Pressable
              accessibilityLabel={item.accessibilityLabel}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={item.key}
              onPress={() => chooseTab(item.key)}
              style={({ pressed }) => [styles.tabButton, pressed && styles.tabButtonPressed]}
            >
              {selected ? <View style={styles.tabIndicator} /> : null}
              <Text style={[styles.tabIcon, selected && styles.tabIconActive]}>{item.icon}</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78} style={[styles.tabText, selected && styles.tabTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>}
    </SafeAreaView>
  );
}

function ScorecasterApp() {
  const { tr } = useLanguage();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function processAuthUrl(url: string | null) {
      if (!url) return;
      const result = await handleAuthCallbackUrl(url);
      if (mounted && result.handled && result.error) {
        Alert.alert(
          tr({ fi: "Vahvistuslinkki ei toiminut", en: "Confirmation link failed", es: "El enlace de confirmación falló" }),
          tr({ fi: "Avaa uusin vahvistuslinkki tai kirjaudu sähköpostilla ja salasanalla.", en: "Open the newest confirmation link or sign in with your email and password.", es: "Abre el enlace de confirmación más reciente o inicia sesión con correo y contraseña." })
        );
      }
    }

    void Linking.getInitialURL().then(processAuthUrl);
    const linkListener = Linking.addEventListener("url", ({ url }) => { void processAuthUrl(url); });
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setReady(true);
    });
    return () => {
      mounted = false;
      linkListener.remove();
      listener.subscription.unsubscribe();
    };
  }, [tr]);

  if (!mobileAuthConfigured) {
    return <SafeAreaView style={styles.safeArea}><StatusBar style="light" /><View style={styles.centered}><BrandMark /><Text style={styles.title}>{tr({ fi: "Scorecaster ei ole vielä yhdistetty pilveen", en: "Scorecaster is not connected to the cloud yet", es: "Scorecaster aún no está conectado a la nube" })}</Text><Text style={styles.subtitle}>{tr({ fi: "Lisää mobiilin ympäristöön vain Supabasen julkinen URL ja publishable key. Salaisia palvelinavaimia ei saa lisätä sovellukseen.", en: "Add only the public Supabase URL and publishable key to the mobile environment. Never add server secrets to the app.", es: "Añade al entorno móvil solo la URL pública de Supabase y la clave publicable. Nunca añadas secretos del servidor a la aplicación." })}</Text></View></SafeAreaView>;
  }

  if (!ready) {
    return <SafeAreaView style={styles.safeArea}><StatusBar style="light" /><View style={styles.centered}><BrandMark /><ActivityIndicator color="#bef264" size="large" /><Text style={styles.muted}>{tr({ fi: "Avataan suojattua istuntoa…", en: "Opening secure session…", es: "Abriendo sesión segura…" })}</Text></View></SafeAreaView>;
  }

  return session ? <MainApp session={session} /> : <AuthScreen />;
}

export default function App() {
  return <LanguageProvider><ScorecasterApp /></LanguageProvider>;
}
