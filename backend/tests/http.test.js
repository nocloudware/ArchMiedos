import { test } from 'node:test';
import assert from 'node:assert/strict';
import { json } from '../src/utils/http.js';

test('SEC-004: json() incluye headers de seguridad', () => {
  const res = json({ ok: true });
  assert.equal(res.headers.get('Content-Type'), 'application/json; charset=utf-8');
  assert.equal(res.headers.get('Cache-Control'), 'no-store');
  assert.equal(res.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(res.headers.get('X-Frame-Options'), 'DENY');
  assert.equal(res.headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
});

test('json() permite headers extra', () => {
  const res = json({}, 201, { 'X-Custom': '1' });
  assert.equal(res.status, 201);
  assert.equal(res.headers.get('X-Custom'), '1');
});
