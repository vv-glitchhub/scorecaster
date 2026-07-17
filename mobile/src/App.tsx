import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import type { Session } from "@supabase/supabase-js";
import AgentScreen from "./screens/AgentScreen";
import AnalyticsScreen from "./screens/AnalyticsScreen";
import AuthScreen from "./screens/AuthScreen";
import HomeScreen from "./screens/HomeScreen";
import PaperBetsScreen from "./screens/PaperBetsScreen";
import PicksScreen from "./screens/PicksScreen";
import SettingsScreen from "./screens/SettingsScreen";
import WatchlistScreen from "./screens/WatchlistScreen";
import { LanguageProvider, useLanguage } from "./i18n";
import { mobileAuthConfigured, supabase } from "./lib/supabase";
import type { Tab } from "./types";
import { styles } from "./ui";

function MainApp({ session }: { session: Session }) {
  const { tr } = useLanguage();
  const [tab, setTab] = useState<Tab>("home");
  const tabs = useMemo(() => [
    { key: "home" as Tab, label: tr({ fi: "Koti", en: "Home", es: "Inicio" }), accessibilityLabel: tr({ fi: "Etusivu ja papeririskit", en: "Home and paper risks", es: "Inicio y riesgos simulados" }) },
    { key: "picks" as Tab, label: tr({ fi: "Kohteet", en: "Picks", es: "Pronóst." }), accessibilityLabel: tr({ fi: "Lähiajan analysoidut kohteet", en: "Near-term analyzed picks", es: "Pronósticos próximos analizados" }) },
    { key: "watchlist" as Tab, label: tr({ fi: "Vahti", en: "Watch", es: "Lista" }), accessibilityLabel: tr({ fi: "Varmennettu seurantalista ja hälytykset", en: "Verified watchlist and alerts", es: "Lista verificada y alertas" }) },
    { key: "agent" as Tab, label: "AI", accessibilityLabel: tr({ fi: "Agent V11 päätöskopilotti", en: "Agent V11 decision copilot", es: "Copiloto de decisiones Agent V11" }) },
    { key: "paper" as Tab, label: tr({ fi: "Paperi", en: "Paper", es: "Papel" }), accessibilityLabel: tr({ fi: "Paperivetojen seuranta", en: "Paper-pick tracking", es: "Seguimiento de pronósticos simulados" }) },
    { key: "analytics" as Tab, label: tr({ fi: "Data", en: "Data", es: "Datos" }), accessibilityLabel: tr({ fi: "Paperiseurannan analytiikka", en: "Paper-tracking analytics", es: "Analítica del seguimiento simulado" }) },
    { key: "settings" as Tab, label: tr({ fi: "Profiili", en: "Profile", es: "Perfil" }), accessibilityLabel: tr({ fi: "Profiili, kieli ja tietosuoja", en: "Profile, language and privacy", es: "Perfil, idioma y privacidad" }) }
  ], [tr]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <View>
          <Text style={styles.headerBrand}>Scorecaster</Text>
          <Text style={styles.headerSubline}>{tr({ fi: "Urheiluanalyysi ja paperiseuranta", en: "Sports analysis and paper tracking", es: "Análisis deportivo y seguimiento simulado" })}</Text>
        </View>
        <Text style={styles.headerMode}>{tr({ fi: "PAPERITILA", en: "PAPER MODE", es: "MODO SIMULADO" })}</Text>
      </View>

      <View style={styles.content}>
        {tab === "home" && <HomeScreen />}
        {tab === "picks" && <PicksScreen />}
        {tab === "watchlist" && <WatchlistScreen />}
        {tab === "agent" && <AgentScreen />}
        {tab === "paper" && <PaperBetsScreen />}
        {tab === "analytics" && <AnalyticsScreen />}
        {tab === "settings" && <SettingsScreen session={session} />}
      </View>

      <View accessibilityRole="tablist" style={styles.tabBar}>
        {tabs.map((item) => (
          <Pressable
            accessibilityLabel={item.accessibilityLabel}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === item.key }}
            key={item.key}
            onPress={() => setTab(item.key)}
            style={({ pressed }) => [styles.tabButton, pressed && styles.tabButtonPressed]}
          >
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={[styles.tabText, tab === item.key && styles.tabTextActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

function ScorecasterApp() {
  const { tr } = useLanguage();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

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
      listener.subscription.unsubscribe();
    };
  }, []);

  if (!mobileAuthConfigured) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <View style={styles.centered}>
          <Text style={styles.title}>{tr({ fi: "Scorecaster ei ole vielä yhdistetty pilveen", en: "Scorecaster is not connected to the cloud yet", es: "Scorecaster aún no está conectado a la nube" })}</Text>
          <Text style={styles.subtitle}>{tr({ fi: "Lisää mobiilin ympäristöön vain Supabasen julkinen URL ja publishable key. Salaisia palvelinavaimia ei saa lisätä sovellukseen.", en: "Add only the public Supabase URL and publishable key to the mobile environment. Never add server secrets to the app.", es: "Añade al entorno móvil solo la URL pública de Supabase y la clave publicable. Nunca añadas secretos del servidor a la aplicación." })}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!ready) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <View style={styles.centered}>
          <ActivityIndicator color="#34d399" size="large" />
          <Text style={styles.muted}>{tr({ fi: "Avataan suojattua istuntoa…", en: "Opening secure session…", es: "Abriendo sesión segura…" })}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return session ? <MainApp session={session} /> : <AuthScreen />;
}

export default function App() {
  return (
    <LanguageProvider>
      <ScorecasterApp />
    </LanguageProvider>
  );
}
