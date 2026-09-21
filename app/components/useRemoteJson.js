"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchJson } from "../../lib/client-request.mjs";

const inFlightRequests = new Map();

function sharedFetchJson(url, timeoutMs) {
  const key = `${url}:${timeoutMs}`;
  const current = inFlightRequests.get(key);
  if (current) return current;

  const request = fetchJson(url, { timeoutMs })
    .finally(() => inFlightRequests.delete(key));
  inFlightRequests.set(key, request);
  return request;
}

export default function useRemoteJson(url, { timeoutMs = 55000, refreshMs = 0 } = {}) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ key: null, data: null, error: null, loading: true });
  const key = `${url}:${revision}`;
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    let active = true;
    setState({ key, data: null, error: null, loading: true });
    sharedFetchJson(url, timeoutMs).then(
      data => { if (active) setState({ key, data, error: null, loading: false }); },
      error => { if (active) setState({ key, data: null, error, loading: false }); }
    );
    return () => { active = false; };
  }, [url, key, timeoutMs]);
  useEffect(() => {
    if (!refreshMs) return;
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") refresh(); }, refreshMs);
    return () => window.clearInterval(timer);
  }, [refreshMs, refresh]);
  // A query change hides the old result before effects run.
  return { ...(state.key === key ? state : { data: null, error: null, loading: true }), refresh };
}
