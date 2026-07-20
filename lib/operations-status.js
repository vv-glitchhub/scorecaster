function timestamp(value) {
  const milliseconds = Date.parse(String(value || ""));
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

function ageMinutes(value, now) {
  const parsed = timestamp(value);
  if (parsed === null) return null;
  return Math.max(0, Math.round((now.getTime() - parsed) / 60000));
}

export function classifyScheduledWorker({
  available = true,
  active = false,
  state = null,
  intervalMinutes = 15,
  now = new Date()
} = {}) {
  if (!available) {
    return { status: "migration_required", tone: "warning", ageMinutes: null };
  }
  if (!active) {
    return { status: "disabled", tone: "neutral", ageMinutes: ageMinutes(state?.last_completed_at, now) };
  }

  const leaseExpiresAt = timestamp(state?.lease_expires_at);
  if (state?.last_status === "running" && leaseExpiresAt && leaseExpiresAt > now.getTime()) {
    return { status: "running", tone: "info", ageMinutes: ageMinutes(state?.last_started_at, now) };
  }
  if (state?.last_status === "error") {
    return { status: "error", tone: "danger", ageMinutes: ageMinutes(state?.last_completed_at, now) };
  }
  if (!state?.last_completed_at) {
    return { status: "waiting", tone: "warning", ageMinutes: null };
  }

  const minutes = ageMinutes(state.last_completed_at, now);
  const staleAfter = Math.max(15, Number(intervalMinutes || 15) * 4);
  if (minutes !== null && minutes > staleAfter) {
    return { status: "stale", tone: "warning", ageMinutes: minutes };
  }
  return { status: "healthy", tone: "success", ageMinutes: minutes };
}

export function summarizeNotificationDeliveries(rows = [], configuration = {}, now = new Date()) {
  const counts = {
    queued: 0,
    processing: 0,
    retry: 0,
    ticketed: 0,
    providerAccepted: 0,
    failed: 0,
    other: 0,
    total: rows.length
  };
  let latestUpdate = null;

  for (const row of rows) {
    const status = String(row?.status || "");
    if (status === "queued") counts.queued += 1;
    else if (status === "processing") counts.processing += 1;
    else if (status === "retry") counts.retry += 1;
    else if (status === "ticketed") counts.ticketed += 1;
    else if (status === "provider_accepted") counts.providerAccepted += 1;
    else if (status === "failed") counts.failed += 1;
    else counts.other += 1;

    const candidate = timestamp(row?.updated_at || row?.created_at);
    if (candidate !== null && (latestUpdate === null || candidate > latestUpdate)) latestUpdate = candidate;
  }

  let status = "healthy";
  let tone = "success";
  if (!configuration.available) {
    status = "migration_required";
    tone = "warning";
  } else if (!configuration.active) {
    status = "disabled";
    tone = "neutral";
  } else if (counts.failed > 0 || counts.retry > 20) {
    status = "attention";
    tone = "danger";
  } else if (counts.processing > 0 || counts.queued > 0 || counts.retry > 0 || counts.ticketed > 0) {
    status = "working";
    tone = "info";
  } else if (!rows.length) {
    status = "waiting";
    tone = "neutral";
  }

  return {
    status,
    tone,
    ageMinutes: latestUpdate === null ? null : Math.max(0, Math.round((now.getTime() - latestUpdate) / 60000)),
    counts
  };
}
