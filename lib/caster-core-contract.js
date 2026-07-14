export const CASTER_APP_STATUS = {
  LOCAL_READY: "LOCAL_READY",
  CLOUD_READY: "CLOUD_READY",
  NEEDS_SETUP: "NEEDS_SETUP",
  ERROR: "ERROR"
};

export const CASTER_SYNC_STATUS = {
  LOCAL_ONLY: "LOCAL_ONLY",
  SYNC_PENDING: "SYNC_PENDING",
  SYNCED: "SYNCED",
  SYNC_ERROR: "SYNC_ERROR"
};

export function createCasterAppState(input = {}) {
  return {
    app: input.app || "scorecaster",
    name: input.name || "Scorecaster",
    status: input.status || CASTER_APP_STATUS.LOCAL_READY,
    syncStatus: input.syncStatus || CASTER_SYNC_STATUS.LOCAL_ONLY,
    localStorageKeys: input.localStorageKeys || [],
    routes: input.routes || [],
    features: input.features || [],
    nextActions: input.nextActions || [],
    updatedAt: new Date().toISOString()
  };
}

export function createCasterEvent(input = {}) {
  return {
    id: input.id || `event-${Date.now()}`,
    app: input.app || "scorecaster",
    type: input.type || "USER_ACTION",
    title: input.title || "Untitled event",
    detail: input.detail || "",
    severity: input.severity || "info",
    payload: input.payload || {},
    createdAt: input.createdAt || new Date().toISOString()
  };
}

export function createAgentAction(input = {}) {
  return {
    id: input.id || `agent-action-${Date.now()}`,
    app: input.app || "scorecaster",
    title: input.title || "Review next action",
    instruction: input.instruction || "Review the current app state and recommend the next safe step.",
    requiresConfirmation: input.requiresConfirmation ?? true,
    riskLevel: input.riskLevel || "medium",
    createdAt: new Date().toISOString()
  };
}

export function getScorecasterCoreState() {
  return createCasterAppState({
    app: "scorecaster",
    name: "Scorecaster",
    status: CASTER_APP_STATUS.CLOUD_READY,
    syncStatus: CASTER_SYNC_STATUS.SYNC_PENDING,
    localStorageKeys: ["scorecaster.quickUse.bets"],
    routes: [
      "/",
      "/quick-use",
      "/login",
      "/profile",
      "/cloud-sync",
      "/risk",
      "/betting",
      "/analytics",
      "/tracking"
    ],
    features: [
      "manual picks",
      "local bet slip",
      "risk decision",
      "bankroll rules",
      "Supabase account",
      "server-validated session",
      "authenticated cloud API",
      "RLS migration",
      "duplicate-safe local-to-cloud sync"
    ],
    nextActions: [
      "run Supabase auth and RLS migration",
      "test account email confirmation",
      "test two-user data isolation",
      "connect live odds picks to cloud history",
      "report account state to Caster-hub"
    ]
  });
}
