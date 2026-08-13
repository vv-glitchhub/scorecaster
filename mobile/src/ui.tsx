import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

const palette = {
  bg: "#06080e",
  surface: "#10151f",
  surfaceStrong: "#151c28",
  border: "#273241",
  text: "#f8fafc",
  textSecondary: "#d7dee8",
  muted: "#8d9aac",
  faint: "#5f6d80",
  brand: "#bef264",
  brandInk: "#17210d",
  brandSoft: "#263b17",
  sky: "#38bdf8",
  purple: "#c084fc",
  amber: "#fbbf24",
  rose: "#fb7185"
};

export function money(value: number | null | undefined) {
  return new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

export function percent(value: number | null | undefined) {
  if (value === null || value === undefined) return "–";
  const number = Number(value);
  if (!Number.isFinite(number)) return "–";
  return `${(Math.abs(number) <= 1 ? number * 100 : number).toFixed(1)} %`;
}

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no" style={[styles.brandMark, compact && styles.brandMarkCompact]}>
      <Text style={[styles.brandMarkLetter, compact && styles.brandMarkLetterCompact]}>S</Text>
      <View style={styles.brandPulse}>
        <View style={[styles.brandPulseLine, { height: 4 }]} />
        <View style={[styles.brandPulseLine, { height: 11 }]} />
        <View style={[styles.brandPulseLine, { height: 6 }]} />
      </View>
    </View>
  );
}

export function Card({ children }: { children: ReactNode }) { return <View style={styles.card}>{children}</View>; }

export function ActionButton({ label, onPress, disabled = false, tone = "primary", compact = false }: { label: string; onPress: () => void; disabled?: boolean; tone?: "primary" | "secondary" | "danger"; compact?: boolean }) {
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} hitSlop={compact ? 6 : 3} onPress={onPress} style={({ pressed }) => [styles.button, compact && styles.buttonCompact, tone === "secondary" && styles.buttonSecondary, tone === "danger" && styles.buttonDanger, (pressed || disabled) && styles.buttonMuted]}>
      <Text style={[styles.buttonText, tone === "primary" && styles.buttonTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, value, onChangeText, placeholder, secureTextEntry = false, keyboardType = "default", autoCapitalize = "none" }: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; secureTextEntry?: boolean; keyboardType?: "default" | "email-address" | "decimal-pad" | "numeric"; autoCapitalize?: "none" | "sentences" | "words" | "characters" }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput accessibilityLabel={label} autoCapitalize={autoCapitalize} keyboardType={keyboardType} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={palette.faint} secureTextEntry={secureTextEntry} selectionColor={palette.brand} style={styles.input} value={value} />
    </View>
  );
}

export const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.bg },
  content: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  authContainer: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 14 },
  screen: { padding: 16, paddingBottom: 38, gap: 14 },
  header: { minHeight: 70, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderColor: palette.border, backgroundColor: "#090d14", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerBrandRow: { flexDirection: "row", alignItems: "center", gap: 11, flex: 1 },
  headerBrand: { color: palette.text, fontSize: 20, fontWeight: "900", letterSpacing: -0.7 },
  headerSubline: { color: palette.muted, fontSize: 10, fontWeight: "800", marginTop: 1, letterSpacing: 0.25 },
  headerMode: { color: palette.brand, fontSize: 9, fontWeight: "900", letterSpacing: 1, borderWidth: 1, borderColor: "#405b25", backgroundColor: palette.brandSoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6, overflow: "hidden" },
  brandMark: { width: 43, height: 43, borderRadius: 15, backgroundColor: palette.brand, alignItems: "center", justifyContent: "center", shadowColor: palette.brand, shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  brandMarkCompact: { width: 36, height: 36, borderRadius: 12 },
  brandMarkLetter: { color: palette.brandInk, fontSize: 22, fontWeight: "900", lineHeight: 24 },
  brandMarkLetterCompact: { fontSize: 18, lineHeight: 20 },
  brandPulse: { position: "absolute", right: 5, bottom: 6, flexDirection: "row", alignItems: "center", gap: 1.5 },
  brandPulseLine: { width: 1.5, borderRadius: 2, backgroundColor: palette.brandInk, opacity: 0.75 },
  mobileHero: { borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, borderRadius: 24, padding: 20, gap: 9, shadowColor: "#000000", shadowOpacity: 0.24, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 4 },
  kicker: { color: palette.brand, fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
  logo: { alignSelf: "center", width: 68, height: 68, borderRadius: 22, backgroundColor: palette.brand, color: palette.brandInk, textAlign: "center", textAlignVertical: "center", fontSize: 35, fontWeight: "900", lineHeight: 68, shadowColor: palette.brand, shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  title: { color: palette.text, fontSize: 29, lineHeight: 33, fontWeight: "900", letterSpacing: -1.05 },
  subtitle: { color: palette.muted, fontSize: 14, lineHeight: 21 },
  privacyNote: { color: palette.faint, textAlign: "center", fontSize: 12, lineHeight: 18 },
  card: { borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, borderRadius: 21, padding: 17, gap: 10, shadowColor: "#000000", shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 7 }, elevation: 3 },
  cardPressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  cardFeatured: { borderColor: "#4f6d2b", backgroundColor: "#121a16" },
  cardTitle: { color: palette.text, fontSize: 17, lineHeight: 22, fontWeight: "900", letterSpacing: -0.3 },
  metric: { color: palette.brand, fontSize: 34, fontWeight: "900", letterSpacing: -1.1 },
  value: { color: palette.textSecondary, fontSize: 16, fontWeight: "800" },
  muted: { color: palette.muted, fontSize: 13, lineHeight: 19 },
  label: { color: palette.textSecondary, fontSize: 13, fontWeight: "800" },
  openLabel: { color: palette.brand, fontSize: 13, fontWeight: "900", marginTop: 2 },
  fieldWrap: { gap: 6 },
  input: { minHeight: 48, borderWidth: 1, borderColor: palette.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: palette.text, backgroundColor: palette.bg },
  button: { minHeight: 48, borderRadius: 14, paddingHorizontal: 15, paddingVertical: 12, alignItems: "center", justifyContent: "center", backgroundColor: palette.brand, shadowColor: palette.brand, shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  buttonCompact: { minHeight: 42, paddingHorizontal: 13, paddingVertical: 9 },
  buttonSecondary: { backgroundColor: palette.surfaceStrong, borderWidth: 1, borderColor: palette.border, shadowOpacity: 0 },
  buttonDanger: { backgroundColor: "#7f1d35", borderWidth: 1, borderColor: "#9f2947", shadowOpacity: 0 },
  buttonMuted: { opacity: 0.55 },
  buttonText: { color: palette.text, fontWeight: "900", fontSize: 13 },
  buttonTextPrimary: { color: palette.brandInk },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badge: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: palette.brandSoft, borderWidth: 1, borderColor: "#405b25" },
  badgeText: { color: palette.brand, fontSize: 10, fontWeight: "900", letterSpacing: 0.4 },
  warningBadge: { backgroundColor: "#3d2b0b", borderColor: "#6f5014" },
  dangerBadge: { backgroundColor: "#451421", borderColor: "#76243a" },
  filterRow: { gap: 8, paddingVertical: 4, paddingRight: 16 },
  filterChip: { minHeight: 42, borderWidth: 1, borderColor: palette.border, borderRadius: 999, paddingHorizontal: 15, paddingVertical: 10, backgroundColor: palette.surface },
  filterChipActive: { borderColor: palette.brand, backgroundColor: palette.brandSoft },
  filterText: { color: palette.textSecondary, fontWeight: "800", fontSize: 12 },
  filterTextActive: { color: palette.brand },
  divider: { height: 1, backgroundColor: palette.border, marginVertical: 2 },
  tabBar: { minHeight: 74, borderTopWidth: 1, borderColor: palette.border, backgroundColor: "#0a0f17", flexDirection: "row", paddingHorizontal: 5, paddingTop: 5, paddingBottom: 5 },
  tabButton: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, paddingHorizontal: 2, borderRadius: 13 },
  tabButtonPressed: { backgroundColor: palette.surfaceStrong },
  tabIcon: { color: palette.faint, fontSize: 17, lineHeight: 19, fontWeight: "900" },
  tabIconActive: { color: palette.brand },
  tabText: { color: palette.faint, fontSize: 10, fontWeight: "800", textAlign: "center" },
  tabTextActive: { color: palette.brand },
  tabIndicator: { position: "absolute", top: 0, width: 24, height: 3, borderRadius: 99, backgroundColor: palette.brand }
});
