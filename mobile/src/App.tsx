import { useEffect, useState } from "react";
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
import { mobileAuthConfigured, supabase } from "./lib/supabase";
import type { Tab } from "./types";
import { styles } from "./ui";

const tabs: { key: Tab; label: string; accessibilityLabel: string }[] = [
  { key: "home", label: "Koti", accessibilityLabel: "Etusivu ja papeririskit" },
  { key: "picks", label: "Kohteet", accessibilityLabel: "Päivän analysoidut kohteet" },
  { key: "agent", label: "AI", accessibilityLabel: "Agent V10 päätöskopilotti" },
  { key: "paper", label: "Seuranta", accessibilityLabel: "Paperivetojen seuranta" },
  { key: "analytics", label: "Analyysi", accessibilityLabel: "Paperiseurannan analytiikka" },
  { key: "settings", label: "Profiili", accessibilityLabel: "Profiili ja tietosuoja" }
];

function MainApp({ session }: { session: Session }) {
  const [tab, setTab] = useState<Tab>("home");

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <View>
          <Text style={styles.headerBrand}>Scorecaster</Text>
          <Text style={styles.headerSubline}>Urheiluanalyysi ja paperiseuranta</Text>
        </View>
        <Text style={styles.headerMode}>PAPERITILA</Text>
      </View>

      <View style={styles.content}>
        {tab === "home" && <HomeScreen />}
        {tab === "picks" && <PicksScreen />}
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
            <Text style={[styles.tabText, tab === item.key && styles.tabTextActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

export default function App() {
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
          <Text style={styles.title}>Scorecaster ei ole vielä yhdistetty pilveen</Text>
          <Text style={styles.subtitle}>
            Lisää mobile/.env-tiedostoon vain Supabasen julkinen URL ja publishable key. Salaisia palvelinavaimia ei saa lisätä mobiilisovellukseen.
          </Text>
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
          <Text style={styles.muted}>Avataan suojattua istuntoa…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return session ? <MainApp session={session} /> : <AuthScreen />;
}
