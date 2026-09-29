// Server-side SDK. Never import into browser code or expose service credentials.
export function serviceURL(value, allowLocalHttp = false) {
  const url = new URL(value);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash ||
      (url.protocol !== 'https:' && !(allowLocalHttp && local && url.protocol === 'http:'))) {
    throw new Error('Invalid Caster AI service URL');
  }
  return url.toString().replace(/\/$/, '');
}

export async function readBoundedJSON(response, maxBytes = 65536) {
  if (!response.body) throw new Error('Empty response');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error('Response too large');
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function requestCasterAI(request, options = {}) {
  const env = options.env ?? process.env;
  const baseURL = options.baseURL ?? env.CASTER_AI_URL;
  const apiKey = options.apiKey ?? env.CASTER_AI_API_KEY;
  if (!baseURL || !apiKey) return { ok: false, reason: 'caster_ai_not_configured' };
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeoutMs = Math.min(18000, Math.max(10, options.timeoutMs ?? 15000));
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = serviceURL(baseURL, options.allowLocalHttp === true);
    const body = JSON.stringify({ capability: request.capability, input: request.input, language: request.language ?? 'fi' });
    if (new TextEncoder().encode(body).byteLength > 49152) return { ok: false, reason: 'caster_ai_input_too_large' };
    const response = await fetchImpl(`${url}/v1/infer`, {
      method: 'POST', redirect: 'error', cache: 'no-store', signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body,
    });
    if (!response.ok) return { ok: false, reason: 'caster_ai_unavailable' };
    const result = await readBoundedJSON(response);
    if (result?.ok !== true || result.capability !== request.capability ||
        typeof result.model !== 'string' || !result.model || result.model.length > 160 ||
        typeof result.modelVersion !== 'string' || !/^[a-f0-9]{64}$/.test(result.modelVersion) ||
        !result.output || typeof result.output !== 'object' || Array.isArray(result.output)) {
      return { ok: false, reason: 'caster_ai_invalid_response' };
    }
    return { ok: true, model: result.model, modelVersion: result.modelVersion,
      responseId: typeof result.requestId === 'string' ? result.requestId.slice(0, 120) : null,
      output: result.output };
  } catch {
    return { ok: false, reason: controller.signal.aborted ? 'caster_ai_timeout' : 'caster_ai_unavailable' };
  } finally { clearTimeout(timer); }
}
