import { getSupabaseAdminClient } from "../../../lib/supabase";
import {
  cleanText,
  enforceRateLimit,
  getAuthenticatedContext,
  getRequestId,
  jsonResponse,
  mutationOriginAllowed,
  publicError,
  readJsonBody
} from "../../../lib/api-security";

export const dynamic = "force-dynamic";

const CONFIRMATION = "DELETE MY SCORECASTER ACCOUNT";
const USER_TABLES = [
  "notification_deliveries",
  "market_timeline_snapshots",
  "notification_devices",
  "notification_preferences",
  "alert_inbox",
  "watchlist_items",
  "risk_events",
  "agent_feedback",
  "pick_explanations",
  "odds_snapshots",
  "tracked_bets",
  "bet_slip_items",
  "bet_slips",
  "bankroll_settings",
  "bets"
];

function isMissingTable(error) {
  return error?.code === "42P01" || /does not exist/i.test(error?.message || "");
}

export async function GET(request) {
  const requestId = getRequestId(request);
  const auth = await getAuthenticatedContext(request);
  if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status, requestId);
  const limited = await enforceRateLimit(auth, requestId, { bucket: "account_status", limit: 30, windowSeconds: 60 });
  if (limited) return limited;
  return jsonResponse({
    ok: true,
    deletionAvailable: Boolean(getSupabaseAdminClient()),
    confirmationPhrase: CONFIRMATION,
    requiresEmailConfirmation: true,
    deletes: ["account", "profile", "paper bets", "paper bankroll settings", "verified watchlist", "market timeline", "alert inbox", "notification delivery history", "notification preferences", "notification device registrations", "tracking history"],
    neverStored: ["payment card data", "bank credentials", "real-money balance"]
  }, 200, requestId);
}

export async function DELETE(request) {
  const requestId = getRequestId(request);
  if (!mutationOriginAllowed(request)) return jsonResponse({ ok: false, error: "Invalid request origin" }, 403, requestId);
  const auth = await getAuthenticatedContext(request);
  if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status, requestId);
  const limited = await enforceRateLimit(auth, requestId, { bucket: "account_delete", limit: 3, windowSeconds: 3600 });
  if (limited) return limited;
  const admin = getSupabaseAdminClient();
  if (!admin) return jsonResponse({ ok: false, error: "Account deletion is not configured on the server" }, 503, requestId);
  const body = await readJsonBody(request, 8 * 1024);
  if (!body.ok) return jsonResponse({ ok: false, error: body.error }, body.status, requestId);
  const phrase = cleanText(body.data?.confirmation, 80);
  const email = cleanText(body.data?.email, 320).toLowerCase();
  const authenticatedEmail = String(auth.user.email || "").toLowerCase();
  if (phrase !== CONFIRMATION || !authenticatedEmail || email !== authenticatedEmail) return jsonResponse({ ok: false, error: "The confirmation phrase or account email did not match" }, 400, requestId);

  for (const table of USER_TABLES) {
    const { error } = await admin.from(table).delete().eq("user_id", auth.user.id);
    if (error && !isMissingTable(error)) return jsonResponse({ ok: false, error: publicError(error, "Account data deletion failed") }, 500, requestId);
  }
  const { error: profileError } = await admin.from("profiles").delete().eq("id", auth.user.id);
  if (profileError && !isMissingTable(profileError)) return jsonResponse({ ok: false, error: publicError(profileError, "Profile deletion failed") }, 500, requestId);
  const { error: deleteUserError } = await admin.auth.admin.deleteUser(auth.user.id);
  if (deleteUserError) return jsonResponse({ ok: false, error: publicError(deleteUserError, "Account deletion failed") }, 500, requestId);
  return jsonResponse({ ok: true, deleted: true }, 200, requestId);
}
