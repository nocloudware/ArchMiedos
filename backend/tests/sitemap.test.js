import { test } from 'node:test';
import assert from 'node:assert/strict';
import { snippet, buildSitemapXml, isWorkersDevHost } from '../src/utils/sitemap.js';

const CORE = [
  { loc: '/', priority: '1.0', changefreq: 'daily' },
  { loc: '/archive.html', priority: '0.9', changefreq: 'weekly' },
  { loc: '/mision.html', priority: '0.6' },
  { loc: '/terminos.html', priority: '0.4' },
];

test('SEO: buildSitemapXml incluye las páginas core y cada miedo aprobado', () => {
  const xml = buildSitemapXml({
    baseUrl: 'https://archmiedos.nocloudware.com',
    corePages: CORE,
    fears: [{ id: 7, created_at: '2026-08-01 12:00:00' }, { id: 12, created_at: null }],
  });
  assert.match(xml, /<loc>https:\/\/archmiedos\.nocloudware\.com\/<\/loc>/);
  assert.match(xml, /<loc>https:\/\/archmiedos\.nocloudware\.com\/archive\.html<\/loc>/);
  assert.match(xml, /<loc>https:\/\/archmiedos\.nocloudware\.com\/miedo\/7<\/loc>/);
  assert.match(xml, /<loc>https:\/\/archmiedos\.nocloudware\.com\/miedo\/12<\/loc>/);
  assert.match(xml, /<lastmod>2026-08-01<\/lastmod>/);
  assert.match(xml, /<priority>0\.7<\/priority>/);
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
});

test('SEO: buildSitemapXml escapa correctamente el urlset', () => {
  const xml = buildSitemapXml({ baseUrl: 'https://x.example', corePages: [], fears: [] });
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.ok(!xml.includes('</url>'));
  assert.ok(!/miedo/.test(xml));
});

test('SEO: snippet recorta en límite de palabra y normaliza espacios', () => {
  assert.equal(snippet('  Hola   mundo  ', 100), 'Hola mundo');
  assert.equal(snippet('palabra palabra palabra', 14), 'palabra…');
  assert.equal(snippet('', 10), '');
  assert.equal(snippet('corto', 200), 'corto');
});

test('SEO: isWorkersDevHost detecta el subdominio de desarrollo', () => {
  assert.ok(isWorkersDevHost('archivo-de-miedos.nocloudware.workers.dev'));
  assert.ok(isWorkersDevHost('anything.workers.dev'));
  assert.ok(!isWorkersDevHost('archmiedos.nocloudware.com'));
  assert.ok(!isWorkersDevHost('workers.dev'));
});
