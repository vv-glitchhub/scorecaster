"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchJson } from "../../lib/client-request.mjs";

export default function useRemoteJson(url, { timeoutMs = 55000, refreshMs = 0 } = {}) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ key: null, sourceUrl: null, data: null, error: null, loading: true, refreshing: false });
  const key = `${url}:${revision}`;
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setState(previous => ({
      key,
      sourceUrl: url,
      data: previous.sourceUrl === url ? previous.data : null,
      error: null,
      loading: previous.sourceUrl !== url || previous.data === null,
      refreshing: previous.sourceUrl === url && previous.data !== null
    }));
    fetchJson(url, { timeoutMs, signal: controller.signal }).then(
      data => { if (active) setState({ key, sourceUrl: url, data, error: null, loading: false, refreshing: false }); },
      error => { if (active) setState(previous => ({ key, sourceUrl: url, data: previous.sourceUrl === url ? previous.data : null, error, loading: false, refreshing: false })); }
    );
    return () => { active = false; controller.abort(); };
  }, [url, key, timeoutMs]);
  useEffect(() => {
    if (!refreshMs) return;
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") refresh(); }, refreshMs);
    return () => window.clearInterval(timer);
  }, [refreshMs, refresh]);
  // Keep a verified result visible while a background request is in flight.
  // A query change with no prior result still presents the initial loading state.
  const sameUrl = state.sourceUrl === url;
  return { ...state, data: sameUrl ? state.data : null, error: sameUrl ? state.error : null, loading: sameUrl ? (state.key === key ? state.loading : state.data === null) : true, refreshing: sameUrl && (state.key !== key || state.refreshing), refresh };
}
