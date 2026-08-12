import { handleFears } from './routes/fears.js';
import { handleAdmin } from './routes/admin.js';
import { isAuthorized } from './services/auth.js';
import { logAdminAccess } from './services/adminLog.js';
import { groupForLetter } from './services/classify.js';
import * as db from './services/db.js';
import { unauthorized } from './utils/http.js';
import { buildSitemapXml, snippet, isWorkersDevHost } from './utils/sitemap.js';
import indexHtml from '../../frontend/index.html';
import archiveHtml from '../../frontend/archive.html';
import adminHtml from '../../frontend/admin.html';
import terminosHtml from '../../frontend/terminos.html';
import misionHtml from '../../frontend/mision.html';
import miedoHtml from '../../frontend/miedo.html';

const HTML_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://raw.githubusercontent.com; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};
const STATIC_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};
const BASE_URL = 'https://archmiedos.nocloudware.com';

const SITEMAP_CORE = [
  { loc: '/', priority: '1.0', changefreq: 'daily' },
  { loc: '/archive.html', priority: '0.9', changefreq: 'weekly' },
  { loc: '/mision.html', priority: '0.6' },
  { loc: '/terminos.html', priority: '0.4' },
];

// El subdominio workers.dev no debe indexarse (evita contenido duplicado con el dominio propio).
function withNoindex(response, url) {
  if (!isWorkersDevHost(url.hostname)) return response;
  const headers = new Headers(response.headers);
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path.startsWith('/api/admin/')) {
      return withNoindex(handleAdmin(request, env, path, url), url);
    }
    if (path.startsWith('/api/')) {
      return withNoindex(handleFears(request, env, path, url), url);
    }

    if (path === '/admin' || path === '/admin.html') {
      const authorized = isAuthorized(request, env);
      await logAdminAccess(request, env, path, authorized);
      if (!authorized) return withNoindex(unauthorized(), url);
      return withNoindex(new Response(adminHtml, { headers: HTML_HEADERS }), url);
    }

    if (path === '/' || path === '/index.html' || path === '/index') {
      return withNoindex(new Response(indexHtml, { headers: HTML_HEADERS }), url);
    }

    if (path === '/archive.html' || path === '/archive') {
      return withNoindex(new Response(archiveHtml, { headers: HTML_HEADERS }), url);
    }

    if (path === '/terminos.html' || path === '/terminos') {
      return withNoindex(new Response(terminosHtml, { headers: HTML_HEADERS }), url);
    }

    if (path === '/mision.html' || path === '/mision') {
      return withNoindex(new Response(misionHtml, { headers: HTML_HEADERS }), url);
    }

    if (path.startsWith('/miedo/')) {
      return renderMiedo(env, path, url);
    }

    if (path === '/sitemap.xml') {
      return renderSitemap(env, url);
    }

    const assetResponse = await env.ASSETS.fetch(request);
    if (!assetResponse || assetResponse.status === 404) return assetResponse;
    return withNoindex(
      new Response(assetResponse.body, {
        status: assetResponse.status,
        headers: new Headers({ ...Object.fromEntries(assetResponse.headers), ...STATIC_HEADERS }),
      }),
      url
    );
  },
};

async function renderMiedo(env, path, requestUrl) {
  const id = Number.parseInt(path.slice('/miedo/'.length), 10);
  if (Number.isNaN(id) || id <= 0) {
    return new Response(null, { status: 302, headers: { Location: '/' } });
  }
  const fear = await db.getApprovedFearById(env, id);
  if (!fear) {
    return new Response(null, { status: 302, headers: { Location: '/' } });
  }

  const group = groupForLetter(fear.topic_letter) || 'A-C';
  const fearUrl = `${BASE_URL}/miedo/${id}`;
  const desc = snippet(fear.content, 200);
  const headline = snippet(fear.content, 70);
  const title = headline ? `${headline} — Archivo de Miedos` : 'Un miedo depositado en el Archivo de Miedos';

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: desc,
    mainEntityOfPage: fearUrl,
    datePublished: String(fear.created_at || '').slice(0, 10),
    author: { '@type': 'Organization', name: 'Archivo de Miedos' },
    publisher: { '@type': 'Organization', name: 'Archivo de Miedos' },
  }).replace(/</g, '\\u003c');

  const html = miedoHtml
    .replaceAll('{{OG_TITLE}}', escapeHtml(title))
    .replaceAll('{{OG_DESC}}', escapeHtml(desc))
    .replaceAll('{{OG_URL}}', fearUrl)
    .replaceAll('{{JSON_LD}}', jsonLd)
    .replaceAll('{{CONTENT}}', escapeHtml(fear.content))
    .replaceAll('{{TOPIC}}', escapeHtml(fear.topic || ''))
    .replaceAll('{{NUM}}', String(fear.id))
    .replaceAll('{{DATE}}', formatShortDate(fear.created_at))
    .replaceAll('{{GROUP}}', group)
    .replaceAll('{{CABINET_LINK}}', `/archive.html?cajon=${encodeURIComponent(group)}`);

  return withNoindex(new Response(html, { headers: HTML_HEADERS }), requestUrl);
}

async function renderSitemap(env, requestUrl) {
  const fears = await db.listApprovedForSitemap(env);
  const xml = buildSitemapXml({ baseUrl: BASE_URL, corePages: SITEMAP_CORE, fears });
  return withNoindex(
    new Response(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'public, max-age=3600',
      },
    }),
    requestUrl
  );
}

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatShortDate(raw) {
  const parts = String(raw || '').split(' ')[0].split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : '';
}
