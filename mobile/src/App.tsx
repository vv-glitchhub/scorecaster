import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import type { Session } from "@supabase/supabase-js";
import AuthScreen from "./screens/AuthScreen";
import HomeScreen from "./screens/HomeScreen";
import PaperBetsScreen from "./screens/PaperBetsScreen";
import PicksScreen from "./screens/PicksScreen";
import SettingsScreen from "./screens/SettingsScreen";
import { mobileAuthConfigured, supabase } from "./lib/supabase";
import type { Tab } from "./types";
import { styles } from "./ui";

const tabs: { key: Tab; label: string }[] = [
  { key: "home", label: "Etusivu" },
  { key: "picks", label: "Kohteet" },
  { key: "paper", label: "Paperivedot" },
  { key: "settings", label: "Profiili" }
];

function MainApp({ session }: { session: Session }) {
  const [tab, setTab] = useState<Tab>("home");

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.headerBrand}>Scorecaster</Text>
        <Text style={styles.headerMode}>PAPER MODE</Text>
      </View>

      <View style={styles.content}>
        {tab === "home" && <HomeScreen />}
        {tab === "picks" && <PicksScreen />}
        {tab === "paper" && <PaperBetsScreen />}
        {tab === "settings" && <SettingsScreen session={session} />}
      </View>

      <View style={styles.tabBar}>
        {tabs.map((item) => (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === item.key }}
            key={item.key}
            onPress={() => setTab(item.key)}
            style={styles.tabButton}
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
