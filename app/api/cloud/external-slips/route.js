import {
  cleanText,
  enforceRateLimit,
  getAuthenticatedContext,
  getRequestId,
  jsonResponse,
  mutationOriginAllowed,
  publicError,
  readJsonBody
} from "../../../../lib/api-security";
import { externalSlipDatabaseRow } from "../../../../lib/external-slip-v1.mjs";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLIP_SELECT = "id,provider,external_reference,title,currency,stake,combined_odds,potential_return,purchased_at,resolves_at,status,legs,source,created_at,updated_at";

async function requireAuth(request, requestId) {
  const auth = await getAuthenticatedContext(request);
  if (!auth.ok) return { error: jsonResponse({ ok: false, error: auth.error }, auth.status, requestId) };
  return auth;
}

function rejectUnsafeMutation(request, requestId) {
  if (mutationOriginAllowed(request)) return null;
  return jsonResponse({ ok: false, error: "Invalid request origin" }, 403, requestId);
}

function databaseError(error, requestId, fallback) {
  if (error?.code === "23505") {
    return jsonResponse({ ok: false, error: "An external slip with this provider reference already exists" }, 409, requestId);
  }
  if (error?.code === "23514") {
    return jsonResponse({ ok: false, error: "External slip data is outside the allowed tracking bounds" }, 400, requestId);
  }
  return jsonResponse({ ok: false, error: publicError(error, fallback) }, 500, requestId);
}

export async function GET(request) {
  const requestId = getRequestId(request);
  const auth = await requireAuth(request, requestId);
  if (auth.error) return auth.error;

  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "external_slips_read",
    limit: 90,
    windowSeconds: 60
  });
  if (limited) return limited;

  const { data, error } = await auth.supabase
    .from("external_slips")
    .select(SLIP_SELECT)
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return databaseError(error, requestId, "External slips could not be loaded");
  return jsonResponse({ ok: true, count: data?.length || 0, data: data || [] }, 200, requestId);
}

export async function POST(request) {
  const requestId = getRequestId(request);
  const unsafe = rejectUnsafeMutation(request, requestId);
  if (unsafe) return unsafe;

  const auth = await requireAuth(request, requestId);
  if (auth.error) return auth.error;

  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "external_slips_create",
    limit: 20,
    windowSeconds: 3600
  });
  if (limited) return limited;

  const body = await readJsonBody(request, 128 * 1024);
  if (!body.ok) return jsonResponse({ ok: false, error: body.error }, body.status, requestId);

  const row = externalSlipDatabaseRow(body.data, auth.user.id);
  if (!row) {
    return jsonResponse({ ok: false, error: "At least one valid slip leg with match, selection and odds is required" }, 400, requestId);
  }

  const { data, error } = await auth.supabase
    .from("external_slips")
    .insert(row)
    .select(SLIP_SELECT)
    .single();

  if (error) return databaseError(error, requestId, "External slip could not be saved");
  return jsonResponse({ ok: true, data }, 201, requestId);
}

export async function PATCH(request) {
  const requestId = getRequestId(request);
  const unsafe = rejectUnsafeMutation(request, requestId);
  if (unsafe) return unsafe;

  const auth = await requireAuth(request, requestId);
  if (auth.error) return auth.error;

  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "external_slips_update",
    limit: 60,
    windowSeconds: 3600
  });
  if (limited) return limited;

  const body = await readJsonBody(request, 128 * 1024);
  if (!body.ok) return jsonResponse({ ok: false, error: body.error }, body.status, requestId);

  const id = cleanText(body.data?.id, 36);
  if (!UUID_PATTERN.test(id)) return jsonResponse({ ok: false, error: "Invalid external slip id" }, 400, requestId);

  const { data: existing, error: loadError } = await auth.supabase
    .from("external_slips")
    .select(SLIP_SELECT)
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (loadError) return databaseError(loadError, requestId, "External slip could not be loaded");
  if (!existing) return jsonResponse({ ok: false, error: "External slip was not found" }, 404, requestId);

  const merged = {
    provider: body.data?.provider ?? existing.provider,
    externalReference: body.data?.externalReference ?? body.data?.external_reference ?? existing.external_reference,
    title: body.data?.title ?? existing.title,
    currency: body.data?.currency ?? existing.currency,
    stake: body.data?.stake ?? existing.stake,
    combinedOdds: body.data?.combinedOdds ?? body.data?.combined_odds ?? existing.combined_odds,
    potentialReturn: body.data?.potentialReturn ?? body.data?.potential_return ?? existing.potential_return,
    purchasedAt: body.data?.purchasedAt ?? body.data?.purchased_at ?? existing.purchased_at,
    resolvesAt: body.data?.resolvesAt ?? body.data?.resolves_at ?? existing.resolves_at,
    status: body.data?.status ?? existing.status,
    legs: body.data?.legs ?? existing.legs,
    source: body.data?.source ?? existing.source
  };
  const row = externalSlipDatabaseRow(merged, auth.user.id);
  if (!row) return jsonResponse({ ok: false, error: "External slip update contains no valid legs" }, 400, requestId);

  delete row.user_id;
  const { data, error } = await auth.supabase
    .from("external_slips")
    .update(row)
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select(SLIP_SELECT)
    .single();

  if (error) return databaseError(error, requestId, "External slip could not be updated");
  return jsonResponse({ ok: true, data }, 200, requestId);
}

export async function DELETE(request) {
  const requestId = getRequestId(request);
  const unsafe = rejectUnsafeMutation(request, requestId);
  if (unsafe) return unsafe;

  const auth = await requireAuth(request, requestId);
  if (auth.error) return auth.error;

  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "external_slips_delete",
    limit: 20,
    windowSeconds: 3600
  });
  if (limited) return limited;

  const body = await readJsonBody(request, 8 * 1024);
  if (!body.ok) return jsonResponse({ ok: false, error: body.error }, body.status, requestId);
  const id = cleanText(body.data?.id, 36);
  if (!UUID_PATTERN.test(id)) return jsonResponse({ ok: false, error: "Invalid external slip id" }, 400, requestId);

  const { data, error } = await auth.supabase
    .from("external_slips")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select("id")
    .maybeSingle();

  if (error) return databaseError(error, requestId, "External slip could not be deleted");
  if (!data) return jsonResponse({ ok: false, error: "External slip was not found" }, 404, requestId);
  return jsonResponse({ ok: true, deleted: true, id }, 200, requestId);
}
