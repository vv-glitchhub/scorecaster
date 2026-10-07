export const UNIFIED_DATA_STORE_TIMEOUT_MS = 5000;

// Check storage availability before spending provider quota. An empty table is
// available; an error, aborted request or incomplete response is not.
export async function unifiedDataStoreReady(admin, { timeoutMs = UNIFIED_DATA_STORE_TIMEOUT_MS } = {}) {
  try {
    const result = await admin
      .from("unified_data_snapshots")
      .select("id")
      .limit(1)
      .abortSignal(AbortSignal.timeout(timeoutMs));
    return result?.error === null && Array.isArray(result.data);
  } catch {
    return false;
  }
}
