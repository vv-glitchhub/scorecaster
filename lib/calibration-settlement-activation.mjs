const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);

export const CALIBRATION_SETTLEMENT_REPOSITORY_DEFAULT = true;

export function resolveCalibrationSettlementActivation(env = process.env) {
  const raw = String(env?.CALIBRATION_SETTLEMENT_ENABLED ?? "").trim().toLowerCase();

  if (TRUE_VALUES.has(raw)) {
    return {
      enabled: true,
      mode: "explicit-enabled",
      emergencyStopAvailable: true,
      repositoryDefault: CALIBRATION_SETTLEMENT_REPOSITORY_DEFAULT
    };
  }

  if (FALSE_VALUES.has(raw)) {
    return {
      enabled: false,
      mode: "explicit-disabled",
      emergencyStopAvailable: true,
      repositoryDefault: CALIBRATION_SETTLEMENT_REPOSITORY_DEFAULT
    };
  }

  if (raw) {
    return {
      enabled: false,
      mode: "invalid-value-disabled",
      emergencyStopAvailable: true,
      repositoryDefault: CALIBRATION_SETTLEMENT_REPOSITORY_DEFAULT
    };
  }

  const production = String(env?.NODE_ENV || "").toLowerCase() === "production";
  const enabled = production && CALIBRATION_SETTLEMENT_REPOSITORY_DEFAULT;
  return {
    enabled,
    mode: enabled ? "repository-production-enabled" : "nonproduction-default-disabled",
    emergencyStopAvailable: true,
    repositoryDefault: CALIBRATION_SETTLEMENT_REPOSITORY_DEFAULT
  };
}
