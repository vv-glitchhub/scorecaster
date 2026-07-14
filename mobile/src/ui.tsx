import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export function money(value: number | null | undefined) {
  return new Intl.NumberFormat("fi-FI", {
    style: "currency",
    currency: "EUR"
  }).format(Number(value || 0));
}

export function percent(value: number | null | undefined) {
  const number = Number(value || 0);
  return `${(Math.abs(number) <= 1 ? number * 100 : number).toFixed(1)} %`;
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function ActionButton({
  label,
  onPress,
  disabled = false,
  tone = "primary",
  compact = false
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: "primary" | "secondary" | "danger";
  compact?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        tone === "secondary" && styles.buttonSecondary,
        tone === "danger" && styles.buttonDanger,
        (pressed || disabled) && styles.buttonMuted
      ]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType = "default",
  autoCapitalize = "none"
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "decimal-pad" | "numeric";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#64748b"
        secureTextEntry={secureTextEntry}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

export const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#020617" },
  content: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  authContainer: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 14 },
  screen: { padding: 16, paddingBottom: 36, gap: 12 },
  header: {
    height: 58,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderColor: "#1e293b",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  headerBrand: { color: "#f8fafc", fontSize: 20, fontWeight: "900" },
  headerMode: { color: "#34d399", fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  logo: {
    alignSelf: "center",
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#34d399",
    color: "#020617",
    textAlign: "center",
    textAlignVertical: "center",
    fontSize: 34,
    fontWeight: "900",
    lineHeight: 64
  },
  title: { color: "#f8fafc", fontSize: 28, fontWeight: "900" },
  subtitle: { color: "#94a3b8", fontSize: 14, lineHeight: 21 },
  privacyNote: { color: "#64748b", textAlign: "center", fontSize: 12, lineHeight: 18 },
  card: {
    borderWidth: 1,
    borderColor: "#1e293b",
    backgroundColor: "#0f172a",
    borderRadius: 18,
    padding: 16,
    gap: 10
  },
  cardFeatured: { borderColor: "#34d399" },
  cardTitle: { color: "#f8fafc", fontSize: 16, fontWeight: "800" },
  metric: { color: "#34d399", fontSize: 32, fontWeight: "900" },
  value: { color: "#e2e8f0", fontSize: 16, fontWeight: "700" },
  muted: { color: "#94a3b8", fontSize: 13, lineHeight: 19 },
  label: { color: "#cbd5e1", fontSize: 13, fontWeight: "700" },
  fieldWrap: { gap: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#f8fafc",
    backgroundColor: "#020617"
  },
  button: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10b981"
  },
  buttonCompact: { minHeight: 38, paddingHorizontal: 12, paddingVertical: 9 },
  buttonSecondary: { backgroundColor: "#334155" },
  buttonDanger: { backgroundColor: "#be123c" },
  buttonMuted: { opacity: 0.55 },
  buttonText: { color: "#f8fafc", fontWeight: "900", fontSize: 13 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#064e3b"
  },
  badgeText: { color: "#a7f3d0", fontSize: 11, fontWeight: "900" },
  warningBadge: { backgroundColor: "#78350f" },
  dangerBadge: { backgroundColor: "#881337" },
  filterRow: { gap: 8, paddingVertical: 4, paddingRight: 16 },
  filterChip: {
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#0f172a"
  },
  filterChipActive: { borderColor: "#34d399", backgroundColor: "#064e3b" },
  filterText: { color: "#cbd5e1", fontWeight: "800", fontSize: 12 },
  filterTextActive: { color: "#d1fae5" },
  divider: { height: 1, backgroundColor: "#1e293b", marginVertical: 2 },
  tabBar: {
    minHeight: 66,
    borderTopWidth: 1,
    borderColor: "#1e293b",
    backgroundColor: "#0f172a",
    flexDirection: "row",
    paddingBottom: 4
  },
  tabButton: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  tabText: { color: "#64748b", fontSize: 11, fontWeight: "800" },
  tabTextActive: { color: "#34d399" }
});
