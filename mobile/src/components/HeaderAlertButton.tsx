import { useEffect, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { useLanguage } from "../i18n";
import { apiRequest } from "../lib/api";

const REFRESH_MS = 120_000;

type AlertSummaryPayload = {
  ok: boolean;
  summary?: {
    unread?: number;
    active?: number;
  };
};

export default function HeaderAlertButton({ onPress }: { onPress: () => void }) {
  const { tr } = useLanguage();
  const [unread, setUnread] = useState(0);

  async function load() {
    try {
      const payload = await apiRequest<AlertSummaryPayload>("/api/cloud/alerts?limit=1");
      setUnread(Math.max(0, Number(payload.summary?.unread || 0)));
    } catch {
      // Header alert state is non-blocking; preserve the last known count.
    }
  }

  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (AppState.currentState === "active") void load();
    }, REFRESH_MS);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void load();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);

  const badge = unread > 99 ? "99+" : String(unread);
  const label = unread > 0
    ? tr({ fi: `${badge} lukematonta hälytystä`, en: `${badge} unread alerts`, es: `${badge} alertas sin leer` })
    : tr({ fi: "Ei lukemattomia hälytyksiä", en: "No unread alerts", es: "No hay alertas sin leer" });

  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} hitSlop={6} style={({ pressed }) => [local.button, pressed && local.pressed]}>
      <Text style={local.bell}>♢</Text>
      <View style={local.clapper} />
      {unread > 0 ? <View style={local.badge}><Text style={local.badgeText}>{badge}</Text></View> : null}
    </Pressable>
  );
}

const local = StyleSheet.create({
  button: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#273241",
    backgroundColor: "#10151f",
    alignItems: "center",
    justifyContent: "center",
    position: "relative"
  },
  pressed: { opacity: 0.68 },
  bell: { color: "#f8fafc", fontSize: 25, lineHeight: 26, transform: [{ rotate: "45deg" }] },
  clapper: { position: "absolute", bottom: 8, width: 4, height: 4, borderRadius: 2, backgroundColor: "#f8fafc" },
  badge: { position: "absolute", right: -5, top: -5, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: "#fb7185", borderWidth: 2, borderColor: "#06080e", alignItems: "center", justifyContent: "center" },
  badgeText: { color: "#ffffff", fontSize: 9, fontWeight: "900" }
});
