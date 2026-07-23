function optionalFinite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function applyAutonomousV12SystemCircuit({ circuit = {}, system = {} } = {}) {
  const reasons = new Set(Array.isArray(circuit.reasons) ? circuit.reasons : []);
  const warnings = new Set(Array.isArray(circuit.warnings) ? circuit.warnings : []);
  const providerScore = optionalFinite(system.providerScore);
  const staleRate = optionalFinite(system.staleRate);
  const captureAgeMinutes = optionalFinite(system.captureAgeMinutes);

  if (system.diagnosticsAvailable !== true) reasons.add("decision_diagnostics_unavailable");
  if (system.dataLayerAvailable !== true) reasons.add("unified_data_health_unavailable");
  if (system.unifiedDataMigrationActive !== true) reasons.add("unified_data_not_active");
  if (system.unifiedDataMigrationActive === true && system.unifiedDataCaptureFresh !== true) reasons.add("unified_data_capture_stale");
  if (providerScore === null) reasons.add("provider_health_unverified");
  if (staleRate === null) reasons.add("market_freshness_unverified");
  if (system.unifiedDataMigrationActive === true && captureAgeMinutes === null) reasons.add("unified_data_freshness_unverified");
  if (system.calibrationAvailable !== true) warnings.add("calibration_history_unavailable");

  const nextReasons = [...reasons];
  const nextWarnings = [...warnings];
  return {
    ...circuit,
    paused: nextReasons.length > 0,
    state: nextReasons.length ? "PAUSED" : nextWarnings.length ? "CAUTION" : "RUNNING",
    reasons: nextReasons,
    warnings: nextWarnings,
    metrics: {
      ...(circuit.metrics || {}),
      verifiedSystemInputs: {
        diagnostics: system.diagnosticsAvailable === true,
        unifiedDataHealth: system.dataLayerAvailable === true,
        unifiedDataMigration: system.unifiedDataMigrationActive === true,
        unifiedDataCapture: system.unifiedDataCaptureFresh === true,
        providerHealth: providerScore !== null,
        marketFreshness: staleRate !== null,
        calibrationHistory: system.calibrationAvailable === true
      }
    }
  };
}
