import assert from "node:assert/strict";

const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const publishableKey = String(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "");
const userAToken = String(process.env.AI_COACH_USER_A_TOKEN || "");
const userBToken = String(process.env.AI_COACH_USER_B_TOKEN || "");

if (!url || !publishableKey || !userAToken || !userBToken) {
  console.error("Required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, AI_COACH_USER_A_TOKEN and AI_COACH_USER_B_TOKEN");
  process.exit(2);
}
if (userAToken === userBToken) {
  console.error("Two distinct authenticated user tokens are required");
  process.exit(2);
}

function headers(token, extra = {}) {
  return {
    apikey: publishableKey,
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    ...extra
  };
}

async function request(path, token, options = {}) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: headers(token, options.headers)
  });
  const body = await response.text();
  let payload = null;
  try { payload = body ? JSON.parse(body) : null; } catch { payload = body; }
  return { response, payload };
}

async function ownUserId(token) {
  const response = await fetch(`${url}/auth/v1/user`, { headers: headers(token) });
  assert.equal(response.ok, true, `User token was not accepted: ${response.status}`);
  const user = await response.json();
  assert.match(String(user.id || ""), /^[0-9a-f-]{36}$/i);
  return user.id;
}

async function upsertPreference(token, userId, marker) {
  const result = await request("ai_coach_preferences_v1?on_conflict=user_id", token, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      user_id: userId,
      enabled: true,
      notifications_enabled: false,
      max_notifications_per_week: marker,
      minimum_sample: 20,
      paper_only: true
    })
  });
  assert.equal(result.response.ok, true, `Preference write failed: ${result.response.status} ${JSON.stringify(result.payload)}`);
  assert.equal(Array.isArray(result.payload), true);
  assert.equal(result.payload.length, 1);
  assert.equal(result.payload[0].user_id, userId);
}

async function selectPreferences(token) {
  const result = await request("ai_coach_preferences_v1?select=user_id,max_notifications_per_week&order=user_id.asc", token);
  assert.equal(result.response.ok, true, `Preference read failed: ${result.response.status} ${JSON.stringify(result.payload)}`);
  return Array.isArray(result.payload) ? result.payload : [];
}

async function attemptCrossUpdate(token, targetUserId) {
  const result = await request(`ai_coach_preferences_v1?user_id=eq.${encodeURIComponent(targetUserId)}`, token, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ max_notifications_per_week: 7 })
  });
  assert.equal(result.response.ok, true, `Cross-update request itself failed unexpectedly: ${result.response.status}`);
  assert.deepEqual(result.payload, [], "RLS must return no updated cross-user rows");
}

async function selectReports(token) {
  const result = await request("ai_coach_reports_v1?select=id,user_id&limit=100", token);
  assert.equal(result.response.ok, true, `Report read failed: ${result.response.status} ${JSON.stringify(result.payload)}`);
  return Array.isArray(result.payload) ? result.payload : [];
}

async function attemptReportInsert(token, userId) {
  const result = await request("ai_coach_reports_v1", token, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      user_id: userId,
      report_version: "forbidden-client-write-test",
      window_days: 30,
      evidence_count: 0,
      report: { forbidden: true },
      generated_at: new Date().toISOString(),
      paper_only: true
    })
  });
  assert.equal(result.response.ok, false, "Authenticated clients must not insert generated AI Coach reports");
  assert.ok([401, 403].includes(result.response.status), `Expected permission rejection, received ${result.response.status}`);
}

const userA = await ownUserId(userAToken);
const userB = await ownUserId(userBToken);
assert.notEqual(userA, userB, "Tokens resolved to the same user");

await upsertPreference(userAToken, userA, 1);
await upsertPreference(userBToken, userB, 2);

const rowsA = await selectPreferences(userAToken);
const rowsB = await selectPreferences(userBToken);
assert.deepEqual(rowsA.map((row) => row.user_id), [userA], "User A must only see user A preference row");
assert.deepEqual(rowsB.map((row) => row.user_id), [userB], "User B must only see user B preference row");
assert.equal(rowsA[0].max_notifications_per_week, 1);
assert.equal(rowsB[0].max_notifications_per_week, 2);

await attemptCrossUpdate(userAToken, userB);
await attemptCrossUpdate(userBToken, userA);

const rowsAAfter = await selectPreferences(userAToken);
const rowsBAfter = await selectPreferences(userBToken);
assert.equal(rowsAAfter[0].max_notifications_per_week, 1, "User B must not modify user A row");
assert.equal(rowsBAfter[0].max_notifications_per_week, 2, "User A must not modify user B row");

const reportsA = await selectReports(userAToken);
const reportsB = await selectReports(userBToken);
assert.equal(reportsA.every((row) => row.user_id === userA), true, "User A report query leaked another user");
assert.equal(reportsB.every((row) => row.user_id === userB), true, "User B report query leaked another user");
await attemptReportInsert(userAToken, userA);
await attemptReportInsert(userBToken, userB);

console.log(JSON.stringify({
  ok: true,
  version: "scorecaster-ai-coach-two-user-rls-proof-v1",
  usersDistinct: true,
  preferencesReadIsolated: true,
  crossUpdatesBlocked: true,
  reportsReadIsolated: true,
  reportClientWritesBlocked: true,
  testedAt: new Date().toISOString()
}, null, 2));
