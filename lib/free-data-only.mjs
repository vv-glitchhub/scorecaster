// Explicit, server-side opt-in for Scorecaster's free-data-first transition.
// This is a defense-in-depth guard, not a billing/subscription cancellation.
export function freeDataOnlyMode(env = process.env) {
  return ["true", "1", "yes", "on"].includes(String(env.SCORECASTER_FREE_DATA_ONLY || "").trim().toLowerCase());
}
