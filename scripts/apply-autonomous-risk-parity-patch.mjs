import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function patch(path, transforms) {
  const url = new URL(path, root);
  let source = await readFile(url, "utf8");
  for (const [before, after, label] of transforms) {
    if (!source.includes(before)) throw new Error(`Missing patch anchor ${label} in ${path}`);
    source = source.replace(before, after);
  }
  await writeFile(url, source, "utf8");
}

await patch("app/api/cloud/autonomous-agent/route.js", [
  [
    "  max_odds: 5,\n  min_data_coverage: 0.6,",
    "  max_odds: 5,\n  risk_profile: \"balanced\",\n  min_data_coverage: 0.6,",
    "default risk profile"
  ],
  [
    ".select(\"enabled,sports,daily_pick_limit,min_priority_score,min_odds,max_odds,min_data_coverage,min_provider_count,max_provider_disagreement,max_drawdown_percent,max_daily_loss_percent,pause_after_losses,cooldown_hours,max_open_picks,minimum_minutes_before_start,maximum_hours_before_start,auto_pause_on_incident,require_unified_data,adaptive_cadence,shadow_learning_enabled,created_at,updated_at\")",
    ".select(\"enabled,sports,daily_pick_limit,min_priority_score,min_odds,max_odds,risk_profile,min_data_coverage,min_provider_count,max_provider_disagreement,max_drawdown_percent,max_daily_loss_percent,pause_after_losses,cooldown_hours,max_open_picks,minimum_minutes_before_start,maximum_hours_before_start,auto_pause_on_incident,require_unified_data,adaptive_cadence,shadow_learning_enabled,created_at,updated_at\")",
    "settings reads"
  ],
  [
    ".select(\"id,run_id,event_id,match,selection,sport,league,allowed,reasons,warnings,quality_score,priority_score,odds,edge,confidence,data_coverage,provider_count,provider_disagreement,context_impact,minutes_before_start,proposed_stake,saved_bet_id,created_at\")",
    ".select(\"id,run_id,event_id,match,selection,sport,league,allowed,reasons,warnings,quality_score,priority_score,odds,edge,confidence,data_coverage,provider_count,provider_disagreement,context_impact,minutes_before_start,risk_profile,risk_policy,proposed_stake,saved_bet_id,created_at\")",
    "audit reads"
  ]
]);

await patch("app/api/account/export/route.js", [
  [
    'auth.supabase.from("autonomous_agent_settings").select("enabled,sports,daily_pick_limit,min_priority_score,min_odds,max_odds,min_data_coverage,min_provider_count,max_provider_disagreement,max_drawdown_percent,max_daily_loss_percent,pause_after_losses,cooldown_hours,max_open_picks,minimum_minutes_before_start,maximum_hours_before_start,auto_pause_on_incident,require_unified_data,adaptive_cadence,shadow_learning_enabled,created_at,updated_at")',
    'auth.supabase.from("autonomous_agent_settings").select("enabled,sports,daily_pick_limit,min_priority_score,min_odds,max_odds,risk_profile,min_data_coverage,min_provider_count,max_provider_disagreement,max_drawdown_percent,max_daily_loss_percent,pause_after_losses,cooldown_hours,max_open_picks,minimum_minutes_before_start,maximum_hours_before_start,auto_pause_on_incident,require_unified_data,adaptive_cadence,shadow_learning_enabled,created_at,updated_at")',
    "account export settings"
  ],
  [
    'auth.supabase.from("autonomous_agent_decision_audit").select("id,run_id,event_id,match,selection,sport,league,allowed,reasons,warnings,quality_score,priority_score,odds,edge,confidence,data_coverage,provider_count,provider_disagreement,context_impact,minutes_before_start,proposed_stake,saved_bet_id,created_at")',
    'auth.supabase.from("autonomous_agent_decision_audit").select("id,run_id,event_id,match,selection,sport,league,allowed,reasons,warnings,quality_score,priority_score,odds,edge,confidence,data_coverage,provider_count,provider_disagreement,context_impact,minutes_before_start,risk_profile,risk_policy,proposed_stake,saved_bet_id,created_at")',
    "account export audit"
  ],
  [
    'autonomousAgentBoundary: "virtual paper decisions and shadow-only learning; no deposits, money movement, bookmaker access, automatic model promotion or real-money betting",',
    'autonomousAgentBoundary: "virtual paper decisions, user-selected recommendation risk and shadow-only learning; risk never changes probability/edge/EV, and there are no deposits, money movement, bookmaker access, automatic model promotion or real-money betting",',
    "account export boundary"
  ]
]);

await patch("mobile/src/screens/AutonomousAgentScreen.tsx", [
  [
    'import { ActionButton, Card, styles } from "../ui";\n\ntype Settings = {',
    'import { ActionButton, Card, styles } from "../ui";\n\ntype RiskProfile = "conservative" | "balanced" | "aggressive";\ntype RiskPolicy = { minConfidence?: number; minEdge?: number; minEv?: number; kellyFraction?: number };\ntype RiskPayload = { riskProfile: RiskProfile; riskPolicy?: RiskPolicy; paperOnly: boolean; realMoneyBetting: boolean };\n\ntype Settings = {',
    "risk types"
  ],
  [
    '  max_odds: number;\n  min_data_coverage: number;',
    '  max_odds: number;\n  risk_profile?: RiskProfile;\n  min_data_coverage: number;',
    "settings risk type"
  ],
  [
    '  odds: number | null;\n  created_at: string;',
    '  odds: number | null;\n  risk_profile?: RiskProfile;\n  risk_policy?: RiskPolicy;\n  created_at: string;',
    "audit risk type"
  ],
  [
    '  const [saving, setSaving] = useState(false);\n  const [requesting, setRequesting] = useState(false);',
    '  const [saving, setSaving] = useState(false);\n  const [requesting, setRequesting] = useState(false);\n  const [riskProfile, setRiskProfile] = useState<RiskProfile>("balanced");\n  const [riskPolicy, setRiskPolicy] = useState<RiskPolicy | null>(null);\n  const [riskSaving, setRiskSaving] = useState(false);',
    "risk state"
  ],
  [
    '      const next = await apiRequest<Payload>("/api/cloud/autonomous-agent");\n      setPayload(next);\n      setSettingsState(next.settings);',
    '      const [next, risk] = await Promise.all([\n        apiRequest<Payload>("/api/cloud/autonomous-agent"),\n        apiRequest<RiskPayload>("/api/cloud/autonomous-agent/risk-profile")\n      ]);\n      setPayload(next);\n      setSettingsState(next.settings);\n      setRiskProfile(risk.riskProfile || next.settings.risk_profile || "balanced");\n      setRiskPolicy(risk.riskPolicy || null);',
    "risk load"
  ],
  [
    '  async function requestRun() {',
    '  async function saveRiskProfile(nextProfile: RiskProfile) {\n    if (riskSaving || nextProfile === riskProfile) return;\n    setRiskSaving(true);\n    try {\n      const next = await apiRequest<RiskPayload>("/api/cloud/autonomous-agent/risk-profile", {\n        method: "PUT",\n        body: { riskProfile: nextProfile }\n      });\n      setRiskProfile(next.riskProfile);\n      setRiskPolicy(next.riskPolicy || null);\n    } catch (error) {\n      Alert.alert(tr({ fi: "Riskitasoa ei voitu tallentaa", en: "Risk level could not be saved", es: "No se pudo guardar el riesgo" }), error instanceof Error ? error.message : "Unknown error");\n    } finally {\n      setRiskSaving(false);\n    }\n  }\n\n  async function requestRun() {',
    "risk save"
  ],
  [
    '  const audit = payload?.audit || [];\n  const allowed = useMemo(() => audit.filter((item) => item.allowed).length, [audit]);',
    '  const audit = payload?.audit || [];\n  const allowed = useMemo(() => audit.filter((item) => item.allowed).length, [audit]);\n  const riskLabels: Record<RiskProfile, string> = {\n    conservative: tr({ fi: "Varovainen", en: "Conservative", es: "Conservador" }),\n    balanced: tr({ fi: "Tasapainoinen", en: "Balanced", es: "Equilibrado" }),\n    aggressive: tr({ fi: "Rohkea", en: "Aggressive", es: "Agresivo" })\n  };',
    "risk labels"
  ],
  [
    '      {readiness?.blockers?.length ? <Card>',
    '      <Card>\n        <Text style={styles.kicker}>AUTONOMOUS RISK CONTROL V1</Text>\n        <Text style={styles.cardTitle}>{tr({ fi: "Kuinka rohkeasti autonomia saa suositella?", en: "How aggressively may autonomy recommend?", es: "¿Con cuánto riesgo puede recomendar la autonomía?" })}</Text>\n        <Text style={styles.muted}>{tr({ fi: "Riskitaso muuttaa vain recommendation-portteja ja virtuaalista panostusta. Probability, edge ja EV eivät muutu, ja omat min edge / min confidence -rajasi pysyvät lisäturvana.", en: "Risk changes recommendation gates and virtual sizing only. Probability, edge and EV stay unchanged, and your min edge / min confidence remain extra safety floors.", es: "El riesgo solo cambia los filtros y el importe virtual. Probabilidad, edge y EV no cambian y tus mínimos siguen activos." })}</Text>\n        <View style={local.actions}>\n          {(["conservative", "balanced", "aggressive"] as RiskProfile[]).map((item) => <RiskChoice key={item} label={riskLabels[item]} active={riskProfile === item} disabled={riskSaving} onPress={() => void saveRiskProfile(item)} />)}\n        </View>\n        <View style={local.settingsList}>\n          <Row label={tr({ fi: "Valittu", en: "Selected", es: "Seleccionado" })} value={riskLabels[riskProfile]} />\n          <Row label="Min confidence" value={pct(riskPolicy?.minConfidence, 0)} />\n          <Row label="Min edge" value={pct(riskPolicy?.minEdge, 1)} />\n          <Row label="Min EV" value={pct(riskPolicy?.minEv, 1)} />\n          <Row label="Kelly" value={pct(riskPolicy?.kellyFraction, 1)} />\n        </View>\n        <Text style={[styles.muted, local.riskNote]}>{tr({ fi: "Hard capit pysyvät aina enintään 1 % / 5 % / 2,5 %. Ei oikean rahan vetoja.", en: "Hard caps always remain at most 1% / 5% / 2.5%. No real-money bets.", es: "Los límites siguen en 1% / 5% / 2,5%. Sin apuestas con dinero real." })}</Text>\n      </Card>\n\n      {readiness?.blockers?.length ? <Card>',
    "risk control card"
  ],
  [
    '<Text style={styles.muted}>Quality {Number(item.quality_score || 0).toFixed(0)} · coverage {pct(item.data_coverage, 0)} · providers {item.provider_count ?? "–"} · gap {pct(item.provider_disagreement, 1)}</Text>',
    '<Text style={styles.muted}>Quality {Number(item.quality_score || 0).toFixed(0)} · coverage {pct(item.data_coverage, 0)} · providers {item.provider_count ?? "–"} · gap {pct(item.provider_disagreement, 1)}{item.risk_profile ? ` · ${riskLabels[item.risk_profile]}` : ""}</Text>',
    "audit risk label"
  ],
  [
    'function Preset({ label, onPress }: { label: string; onPress: () => void }) {\n  return <Pressable onPress={onPress} style={({ pressed }) => [local.preset, pressed && styles.cardPressed]}><Text style={local.presetText}>{label}</Text></Pressable>;\n}\n',
    'function Preset({ label, onPress }: { label: string; onPress: () => void }) {\n  return <Pressable onPress={onPress} style={({ pressed }) => [local.preset, pressed && styles.cardPressed]}><Text style={local.presetText}>{label}</Text></Pressable>;\n}\n\nfunction RiskChoice({ label, active, disabled, onPress }: { label: string; active: boolean; disabled: boolean; onPress: () => void }) {\n  return <Pressable disabled={disabled} accessibilityRole="button" accessibilityState={{ selected: active, disabled }} onPress={onPress} style={({ pressed }) => [local.riskChoice, active && local.riskChoiceActive, disabled && local.riskChoiceDisabled, pressed && !disabled && styles.cardPressed]}><Text style={[local.riskChoiceText, active && local.riskChoiceTextActive]}>{label}</Text></Pressable>;\n}\n',
    "risk choice component"
  ],
  [
    '  presetText: { color: "#ede9fe", fontWeight: "900", fontSize: 12 },\n  settingsList:',
    '  presetText: { color: "#ede9fe", fontWeight: "900", fontSize: 12 },\n  riskChoice: { borderWidth: 1, borderColor: "#334155", backgroundColor: "#101b2d", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11 },\n  riskChoiceActive: { borderColor: "#a78bfa", backgroundColor: "#2e1f59" },\n  riskChoiceDisabled: { opacity: 0.55 },\n  riskChoiceText: { color: "#cbd5e1", fontWeight: "900", fontSize: 12 },\n  riskChoiceTextActive: { color: "#f5f3ff" },\n  riskNote: { marginTop: 14 },\n  settingsList:',
    "risk styles"
  ]
]);

await patch("scripts/autonomous-risk-profile-v1.test.mjs", [
  [
    'test("autonomous UI exposes the three risk levels and preserves personal floors", async () => {\n  const [page, card] = await Promise.all([\n    read("app/autonomous-agent/page.jsx"),\n    read("app/autonomous-agent/AutonomousRiskProfileCard.jsx")\n  ]);',
    'test("autonomous UI exposes the three risk levels and preserves personal floors", async () => {\n  const [page, card, mobile, cloudRoute, accountExport] = await Promise.all([\n    read("app/autonomous-agent/page.jsx"),\n    read("app/autonomous-agent/AutonomousRiskProfileCard.jsx"),\n    read("mobile/src/screens/AutonomousAgentScreen.tsx"),\n    read("app/api/cloud/autonomous-agent/route.js"),\n    read("app/api/account/export/route.js")\n  ]);',
    "parity test inputs"
  ],
  [
    '  assert.match(card, /cannot place real-money bets/);\n});',
    '  assert.match(card, /cannot place real-money bets/);\n  assert.match(mobile, /AUTONOMOUS RISK CONTROL V1/);\n  assert.match(mobile, /saveRiskProfile/);\n  assert.match(mobile, /1% \\/ 5% \\/ 2\\.5%/);\n  assert.match(cloudRoute, /risk_profile/);\n  assert.match(cloudRoute, /risk_policy/);\n  assert.match(accountExport, /risk_profile/);\n  assert.match(accountExport, /risk_policy/);\n  assert.match(accountExport, /risk never changes probability\\/edge\\/EV/);\n});',
    "parity assertions"
  ]
]);
