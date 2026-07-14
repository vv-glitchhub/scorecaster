import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { StatusBar } from "expo-status-bar";
import type { Session } from "@supabase/supabase-js";
import { apiRequest } from "./src/lib/api";
import { mobileAuthConfigured, supabase } from "./src/lib/supabase";

type Tab = "home" | "picks" | "paper" | "settings";

type Pick = {
  id?: string;
  eventId?: string;
  match?: string;
  homeTeam?: string;
  awayTeam?: string;
  selection?: string;
  label?: string;
  odds?: number;
  edge?: number;
  ev?: number;
  confidence?: number;
  decision?: string;
  league?: string;
  leagueTitle?: string;
  sportKey?: string;
  bookmaker?: string;
  qualityGrade?: string;
};

type PaperBet = {
  id: string;
  label: string;
  match: string;
  odds: number;
  stake: number;
  status: string;
  profit: number | null;
  clv: number | null;
  created_at: string;
};

type Bankroll = {
  bankroll: number;
  max_stake_percent: number;
  max_daily_exposure_percent: number;
  paper_trading_mode: boolean;
};

const tabs: { key: Tab; label: string }[] = [
  { key: "home", label: "Etusivu" },
  { key: "picks", label: "Kohteet" },
  { key: "paper", label: "Paperivedot" },
  { key: "settings", label: "Profiili" }
];

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR" }).format(value || 0);
}

function percent(value: number | null | undefined) {
  const number = Number(value || 0);
  return `${(Math.abs(number) <= 1 ? number * 100 : number).toFixed(1)} %`;
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function ActionButton({
  label,
  onPress,
  disabled = false,
  tone = "primary"
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: "primary" | "secondary" | "danger";
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === "secondary" && styles.buttonSecondary,
        tone === "danger" && styles.buttonDanger,
        (pressed || disabled) && styles.buttonMuted
      ]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(mode: "signin" | "signup") {
    if (!email.trim() || password.length < 8) {
      Alert.alert("Tarkista tiedot", "Anna sähköposti ja vähintään 8 merkin salasana.");
      return;
    }

    setBusy(true);
    const result = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({ email: email.trim(), password });
    setBusy(false);

    if (result.error) {
      Alert.alert("Kirjautuminen epäonnistui", result.error.message);
      return;
    }

    if (mode === "signup" && !result.data.session) {
      Alert.alert("Vahvista sähköposti", "Avaa vahvistuslinkki sähköpostistasi ennen kirjautumista.");
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.authContainer} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>S</Text>
        <Text style={styles.title}>Scorecaster</Text>
        <Text style={styles.subtitle}>Urheiluanalyysi, paperivedot ja riskinhallinta. Ei oikean rahan vedonlyöntiä.</Text>
        <Card>
          <Text style={styles.label}>Sähköposti</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="sinä@example.com"
            placeholderTextColor="#64748b"
            style={styles.input}
            value={email}
          />
          <Text style={styles.label}>Salasana</Text>
          <TextInput
            autoCapitalize="none"
            onChangeText={setPassword}
            placeholder="Vähintään 8 merkkiä"
            placeholderTextColor="#64748b"
            secureTextEntry
            style={styles.input}
            value={password}
          />
          <ActionButton label={busy ? "Odota…" : "Kirjaudu"} onPress={() => submit("signin")} disabled={busy} />
          <ActionButton label="Luo tili" onPress={() => submit("signup")} disabled={busy} tone="secondary" />
        </Card>
        <Text style={styles.privacyNote}>Scorecaster ei pyydä pankki-, maksukortti- tai vedonlyöntitilien tietoja.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function HomeScreen() {
  const [bankroll, setBankroll] = useState<Bankroll | null>(null);
  const [status, setStatus] = useState("Tarkistetaan palvelua…");

  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest<{ status?: string; mode?: string }>("/api/health", { authenticated: false }),
      apiRequest<{ data: Bankroll }>("/api/cloud/bankroll")
    ])
      .then(([health, bankrollResponse]) => {
        if (!active) return;
        setStatus(`${health.status || "unknown"} · ${health.mode || "unknown"}`);
        setBankroll(bankrollResponse.data);
      })
      .catch((error) => active && setStatus(error instanceof Error ? error.message : "Palveluvirhe"));
    return () => { active = false; };
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.title}>Tänään</Text>
      <Text style={styles.subtitle}>Tee päätös numeroiden perusteella ja hyväksy myös SKIP.</Text>
      <Card>
        <Text style={styles.cardTitle}>Paperipelikassa</Text>
        <Text style={styles.metric}>{money(bankroll?.bankroll)}</Text>
        <Text style={styles.muted}>Yksittäisen paperipanoksen raja {bankroll?.max_stake_percent || 2} %</Text>
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Palvelun tila</Text>
        <Text style={styles.value}>{status}</Text>
        <Text style={styles.muted}>Mobiilisovellus käyttää vain suojattuja käyttäjäkohtaisia pilvireittejä.</Text>
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Tuotteen raja</Text>
        <Text style={styles.value}>Analyysi + paperiseuranta</Text>
        <Text style={styles.muted}>Ei talletuksia, kotiutuksia, maksutietoja tai oikean rahan vedonvälitystä.</Text>
      </Card>
    </ScrollView>
  );
}

function PicksScreen() {
  const [picks, setPicks] = useState<Pick[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const response = await apiRequest<{ data?: Pick[] }>("/api/top-picks", { authenticated: false, timeoutMs: 30000 });
      setPicks((response.data || []).slice(0, 20));
    } catch (error) {
      Alert.alert("Kohteita ei voitu ladata", error instanceof Error ? error.message : "Tuntematon virhe");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function savePick(pick: Pick, index: number) {
    const odds = Number(pick.odds || 0);
    const selection = String(pick.selection || pick.label || "").trim();
    const match = String(pick.match || [pick.homeTeam, pick.awayTeam].filter(Boolean).join(" – ")).trim();
    if (!match || !selection || odds <= 1) {
      Alert.alert("Kohde puutteellinen", "Kohteen tietoja ei voida tallentaa turvallisesti.");
      return;
    }

    const id = String(pick.id || pick.eventId || `${match}-${selection}-${index}`);
    setSavingId(id);
    try {
      await apiRequest("/api/cloud/bets", {
        method: "POST",
        body: {
          bets: [{
            id,
            match,
            selection,
            odds,
            stake: 0,
            edge: pick.edge,
            ev: pick.ev,
            confidence: pick.confidence,
            league: pick.league || pick.leagueTitle,
            sport: pick.sportKey,
            bookmaker: pick.bookmaker,
            decision: pick.decision,
            qualityGrade: pick.qualityGrade,
            source: "scorecaster-mobile"
          }]
        }
      });
      Alert.alert("Tallennettu", "Kohde lisättiin paperiseurantaan. Oikeaa vetoa ei asetettu.");
    } catch (error) {
      Alert.alert("Tallennus epäonnistui", error instanceof Error ? error.message : "Tuntematon virhe");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.rowBetween}>
        <Text style={styles.title}>Päivän kohteet</Text>
        <ActionButton label="Päivitä" onPress={load} tone="secondary" disabled={loading} />
      </View>
      {loading && <ActivityIndicator color="#34d399" size="large" />}
      {!loading && picks.length === 0 && <Text style={styles.muted}>Tällä hetkellä ei löytynyt laadun läpäiseviä kohteita.</Text>}
      {picks.map((pick, index) => {
        const id = String(pick.id || pick.eventId || index);
        const match = pick.match || [pick.homeTeam, pick.awayTeam].filter(Boolean).join(" – ") || "Ottelu";
        return (
          <Card key={`${id}-${index}`}>
            <Text style={styles.cardTitle}>{match}</Text>
            <Text style={styles.value}>{pick.selection || pick.label || "Valinta"} · {Number(pick.odds || 0).toFixed(2)}</Text>
            <Text style={styles.muted}>Edge {percent(pick.edge)} · Confidence {percent(pick.confidence)} · {pick.decision || "WATCH"}</Text>
            <ActionButton
              label={savingId === id ? "Tallennetaan…" : "Lisää paperiseurantaan"}
              onPress={() => savePick(pick, index)}
              disabled={savingId !== null}
            />
          </Card>
        );
      })}
    </ScrollView>
  );
}

function PaperBetsScreen() {
  const [bets, setBets] = useState<PaperBet[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const response = await apiRequest<{ data: PaperBet[] }>("/api/cloud/bets");
      setBets(response.data || []);
    } catch (error) {
      Alert.alert("Historiaa ei voitu ladata", error instanceof Error ? error.message : "Tuntematon virhe");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function settle(id: string, status: "won" | "lost" | "void") {
    try {
      await apiRequest("/api/cloud/bets", { method: "PATCH", body: { id, status } });
      await load();
    } catch (error) {
      Alert.alert("Päivitys epäonnistui", error instanceof Error ? error.message : "Tuntematon virhe");
    }
  }

  async function remove(id: string) {
    try {
      await apiRequest("/api/cloud/bets", { method: "DELETE", body: { ids: [id] } });
      setBets((current) => current.filter((bet) => bet.id !== id));
    } catch (error) {
      Alert.alert("Poisto epäonnistui", error instanceof Error ? error.message : "Tuntematon virhe");
    }
  }

  const totalProfit = useMemo(
    () => bets.reduce((sum, bet) => sum + Number(bet.profit || 0), 0),
    [bets]
  );

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.rowBetween}>
        <View>
          <Text style={styles.title}>Paperiseuranta</Text>
          <Text style={styles.subtitle}>Laskennallinen tulos {money(totalProfit)}</Text>
        </View>
        <ActionButton label="Päivitä" onPress={load} tone="secondary" disabled={loading} />
      </View>
      {loading && <ActivityIndicator color="#34d399" size="large" />}
      {bets.map((bet) => (
        <Card key={bet.id}>
          <Text style={styles.cardTitle}>{bet.match}</Text>
          <Text style={styles.value}>{bet.label} · {Number(bet.odds).toFixed(2)}</Text>
          <Text style={styles.muted}>Tila {bet.status.toUpperCase()} · paperipanos {money(bet.stake)} · tulos {money(bet.profit)}</Text>
          {bet.status === "open" && (
            <View style={styles.actionRow}>
              <ActionButton label="Voitto" onPress={() => settle(bet.id, "won")} />
              <ActionButton label="Tappio" onPress={() => settle(bet.id, "lost")} tone="danger" />
              <ActionButton label="Mitätön" onPress={() => settle(bet.id, "void")} tone="secondary" />
            </View>
          )}
          <ActionButton label="Poista" onPress={() => remove(bet.id)} tone="secondary" />
        </Card>
      ))}
    </ScrollView>
  );
}

function SettingsScreen({ session }: { session: Session }) {
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);

  async function exportData() {
    setBusy(true);
    try {
      const response = await apiRequest<{ paperBets?: unknown[]; exportedAt?: string }>("/api/account/export");
      Alert.alert("Tietojen vienti toimii", `Paperivetoja: ${response.paperBets?.length || 0}\nViety: ${response.exportedAt || "nyt"}`);
    } catch (error) {
      Alert.alert("Vienti epäonnistui", error instanceof Error ? error.message : "Tuntematon virhe");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    const email = session.user.email || "";
    if (confirmation !== "DELETE MY SCORECASTER ACCOUNT") {
      Alert.alert("Vahvistus puuttuu", "Kirjoita vahvistuslause täsmälleen oikein.");
      return;
    }

    Alert.alert(
      "Poistetaanko tili pysyvästi?",
      "Profiili, paperivedot ja paperipelikassa poistetaan. Tätä ei voi perua.",
      [
        { text: "Peruuta", style: "cancel" },
        {
          text: "Poista tili",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await apiRequest("/api/account", {
                method: "DELETE",
                body: { confirmation, email }
              });
              await supabase.auth.signOut({ scope: "local" });
            } catch (error) {
              Alert.alert("Tilin poisto epäonnistui", error instanceof Error ? error.message : "Tuntematon virhe");
            } finally {
              setBusy(false);
            }
          }
        }
      ]
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Profiili ja tietosuoja</Text>
      <Card>
        <Text style={styles.cardTitle}>Kirjautunut käyttäjä</Text>
        <Text style={styles.value}>{session.user.email}</Text>
        <Text style={styles.muted}>Session tunnus säilytetään laitteen suojatussa avainsäilössä.</Text>
        <ActionButton label="Kirjaudu ulos" onPress={() => supabase.auth.signOut()} tone="secondary" />
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Omat tiedot</Text>
        <Text style={styles.muted}>Vie oma profiili, paperipelikassa ja paperivetohistoria JSON-muodossa.</Text>
        <ActionButton label="Tarkista tietojen vienti" onPress={exportData} disabled={busy} />
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Poista tili</Text>
        <Text style={styles.muted}>Kirjoita DELETE MY SCORECASTER ACCOUNT. Poisto on pysyvä.</Text>
        <TextInput
          autoCapitalize="characters"
          onChangeText={setConfirmation}
          placeholder="DELETE MY SCORECASTER ACCOUNT"
          placeholderTextColor="#64748b"
          style={styles.input}
          value={confirmation}
        />
        <ActionButton label="Poista tili pysyvästi" onPress={deleteAccount} disabled={busy} tone="danger" />
      </Card>
    </ScrollView>
  );
}

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
          <Pressable key={item.key} onPress={() => setTab(item.key)} style={styles.tabButton}>
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
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setReady(true);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (!mobileAuthConfigured) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.title}>Scorecaster ei ole vielä yhdistetty pilveen</Text>
          <Text style={styles.subtitle}>Lisää mobile/.env-tiedostoon vain Supabasen julkinen URL ja publishable key.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!ready) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}><ActivityIndicator color="#34d399" size="large" /></View>
      </SafeAreaView>
    );
  }

  return session ? <MainApp session={session} /> : <AuthScreen />;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#020617" },
  content: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  authContainer: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 14 },
  screen: { padding: 16, paddingBottom: 32, gap: 12 },
  header: { height: 58, paddingHorizontal: 18, borderBottomWidth: 1, borderColor: "#1e293b", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerBrand: { color: "#f8fafc", fontSize: 20, fontWeight: "900" },
  headerMode: { color: "#34d399", fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  logo: { alignSelf: "center", width: 64, height: 64, borderRadius: 20, backgroundColor: "#34d399", color: "#020617", textAlign: "center", textAlignVertical: "center", fontSize: 34, fontWeight: "900", lineHeight: 64 },
  title: { color: "#f8fafc", fontSize: 28, fontWeight: "900" },
  subtitle: { color: "#94a3b8", fontSize: 14, lineHeight: 21 },
  privacyNote: { color: "#64748b", textAlign: "center", fontSize: 12, lineHeight: 18 },
  card: { borderWidth: 1, borderColor: "#1e293b", backgroundColor: "#0f172a", borderRadius: 18, padding: 16, gap: 10 },
  cardTitle: { color: "#f8fafc", fontSize: 16, fontWeight: "800" },
  metric: { color: "#34d399", fontSize: 32, fontWeight: "900" },
  value: { color: "#e2e8f0", fontSize: 16, fontWeight: "700" },
  muted: { color: "#94a3b8", fontSize: 13, lineHeight: 19 },
  label: { color: "#cbd5e1", fontSize: 13, fontWeight: "700" },
  input: { borderWidth: 1, borderColor: "#334155", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: "#f8fafc", backgroundColor: "#020617" },
  button: { minHeight: 44, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#10b981" },
  buttonSecondary: { backgroundColor: "#334155" },
  buttonDanger: { backgroundColor: "#be123c" },
  buttonMuted: { opacity: 0.55 },
  buttonText: { color: "#f8fafc", fontWeight: "900", fontSize: 13 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tabBar: { minHeight: 66, borderTopWidth: 1, borderColor: "#1e293b", backgroundColor: "#0f172a", flexDirection: "row", paddingBottom: 4 },
  tabButton: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  tabText: { color: "#64748b", fontSize: 11, fontWeight: "800" },
  tabTextActive: { color: "#34d399" }
});
