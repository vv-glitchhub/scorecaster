import test from 'node:test';
import assert from 'node:assert/strict';
import { generateCasterExplanation } from '../lib/caster-ai-explanation.mjs';
import { requestCasterAI } from '../lib/caster-ai-client.mjs';
import { sanitizeAgentExplanationInput } from '../lib/agent-v10-explanation.mjs';

const contract = sanitizeAgentExplanationInput({ decision: 'WATCH', match: 'Test match', selection: 'Test pick', evidence: ['Market price evidence'], counterArguments: ['Uncertainty remains'], missingEvidence: ['Updated source data'] });
const output = { summary: 'Evidenssi vaatii tarkistamista.', strongestEvidenceIndex: 0, counterArgumentIndex: 0, nextCheckIndexes: [0], limitation: 'Tämä on paperiseurannan päätöstuki.' };
const env = { CASTER_AI_URL: 'https://ai.example', CASTER_AI_API_KEY: 'test-server-key' };
const response = (value = output, overrides = {}) => Response.json({ ok: true, capability: 'scorecaster.explain', model: 'caster-test-model', modelVersion: 'a'.repeat(64), requestId: 'test-id', output: value, ...overrides });

test('approved Caster output is rendered from the original evidence arrays', async () => {
  let body;
  const result = await generateCasterExplanation(contract, 'fi', { env, fetchImpl: async (url, init) => { body = JSON.parse(init.body); assert.equal(url, 'https://ai.example/v1/infer'); return response(); } });
  assert.equal(result.ok, true);
  assert.equal(result.explanation.strongestReason, contract.evidence[0]);
  assert.equal(result.explanation.counterpoint, contract.counterArguments[0]);
  assert.deepEqual(body.input, contract);
  assert.equal(result.modelVersion, 'a'.repeat(64));
});

test('application independently rejects hallucinated metrics, unsupported facts and invalid indexes', async () => {
  for (const value of [
    { ...output, summary: 'Voiton todennäköisyys on 99 prosenttia.' },
    { ...output, summary: 'Joukkueen loukkaantumistilanne ratkaisee.' },
    { ...output, strongestEvidenceIndex: 99 },
    { ...output, limitation: 'Taattu voitto.' },
  ]) {
    const result = await generateCasterExplanation(contract, 'fi', { env, fetchImpl: async () => response(value) });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'caster_ai_grounding_rejected');
  }
});

test('missing or partial service configuration performs no outbound call', async () => {
  for (const partial of [{}, { CASTER_AI_URL: env.CASTER_AI_URL }, { CASTER_AI_API_KEY: env.CASTER_AI_API_KEY }]) {
    const result = await generateCasterExplanation(contract, 'fi', { env: partial, fetchImpl: () => { throw new Error('Must not be called'); } });
    assert.equal(result.reason, 'caster_ai_not_configured');
  }
});

test('provider outage, wrong capability, missing provenance and oversized output return safe failures', async () => {
  for (const create of [() => new Response('private provider detail', { status: 500 }),
    () => response(output, { capability: 'developer.code' }),
    () => response(output, { modelVersion: null }),
    () => new Response('x'.repeat(70000)),
  ]) {
    const result = await generateCasterExplanation(contract, 'fi', { env, fetchImpl: async () => create() });
    assert.equal(result.ok, false);
    assert.ok(!JSON.stringify(result).includes('private provider detail'));
  }
});

test('service URLs cannot put credentials in plaintext or a redirect target', async () => {
  for (const url of ['http://ai.example', 'https://user:password@ai.example', 'https://ai.example?key=secret']) {
    let called = false;
    const result = await requestCasterAI({ capability: 'scorecaster.explain', input: contract }, { env: { ...env, CASTER_AI_URL: url }, fetchImpl: async () => { called = true; return response(); } });
    assert.equal(result.ok, false);
    assert.equal(called, false);
  }
});

test('service timeout is bounded and returns an explicit failure for the deterministic fallback', async () => {
  const result = await generateCasterExplanation(contract, 'fi', { env, timeoutMs: 10, fetchImpl: async (_, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')))) });
  assert.equal(result.reason, 'caster_ai_timeout');
});
