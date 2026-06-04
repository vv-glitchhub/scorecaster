const STORAGE_KEY = "scorecaster_agent_reports";

export function getAgentReports() {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveAgentReport(report) {
  if (typeof window === "undefined") return;

  const reports = getAgentReports();

  const nextReport = {
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
    ...report
  };

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([nextReport, ...reports].slice(0, 100))
  );

  return nextReport;
}

export function deleteAgentReport(id) {
  if (typeof window === "undefined") return;

  const reports = getAgentReports();
  const filtered = reports.filter((report) => report.id !== id);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function clearAgentReports() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
