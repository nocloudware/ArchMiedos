import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeVisitorCookie, makeMineCookie } from '../src/routes/fears.js';

test('SEC-005: makeVisitorCookie incluye Secure, HttpOnly y SameSite', () => {
  const cookie = makeVisitorCookie('abc');
  assert.ok(cookie.startsWith('am_visitor='));
  assert.ok(cookie.includes('HttpOnly'));
  assert.ok(cookie.includes('SameSite=Lax'));
  assert.ok(cookie.includes('Secure'));
  assert.ok(cookie.includes('Path=/'));
  assert.ok(cookie.includes('Max-Age=31536000'));
});

test('SEC-005: makeMineCookie no es HttpOnly (la lee JS) pero sí Secure', () => {
  const cookie = makeMineCookie('7', new Request('https://archmiedos.nocloudware.com/'));
  assert.ok(cookie.startsWith('am_mine='));
  assert.ok(!cookie.includes('HttpOnly'));
  assert.ok(cookie.includes('SameSite=Lax'));
  assert.ok(cookie.includes('Secure'));
});

test('makeMineCookie acumula ids y no duplica', () => {
  const base = new Request('https://archmiedos.nocloudware.com/', {
    headers: { Cookie: 'am_mine=1%2C2' },
  });
  const cookie = makeMineCookie('3', base);
  assert.ok(cookie.includes('1%2C2%2C3') || cookie.includes('3%2C1%2C2'), 'el nuevo id se agrega sin duplicar');
});
