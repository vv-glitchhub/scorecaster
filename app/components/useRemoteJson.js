"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchJson } from "../../lib/client-request.mjs";

export default function useRemoteJson(url, { timeoutMs = 55000, refreshMs = 0 } = {}) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ key: null, data: null, error: null, loading: true });
  const key = `${url}:${revision}`;
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setState({ key, data: null, error: null, loading: true });
    fetchJson(url, { timeoutMs, signal: controller.signal }).then(
      data => { if (active) setState({ key, data, error: null, loading: false }); },
      error => { if (active) setState({ key, data: null, error, loading: false }); }
    );
    return () => { active = false; controller.abort(); };
  }, [url, key, timeoutMs]);
  useEffect(() => {
    if (!refreshMs) return;
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") refresh(); }, refreshMs);
    return () => window.clearInterval(timer);
  }, [refreshMs, refresh]);
  // A query change hides the old result before effects run.
  return { ...(state.key === key ? state : { data: null, error: null, loading: true }), refresh };
}
