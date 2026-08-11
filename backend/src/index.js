import { handleFears } from './routes/fears.js';
import { handleAdmin } from './routes/admin.js';
import { isAuthorized } from './services/auth.js';
import { logAdminAccess } from './services/adminLog.js';
import { groupForLetter } from './services/classify.js';
import * as db from './services/db.js';
import { unauthorized } from './utils/http.js';
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path.startsWith('/api/admin/')) {
      return handleAdmin(request, env, path, url);
    }
    if (path.startsWith('/api/')) {
      return handleFears(request, env, path, url);
    }

    if (path === '/admin' || path === '/admin.html') {
      const authorized = isAuthorized(request, env);
      await logAdminAccess(request, env, path, authorized);
      if (!authorized) return unauthorized();
      return new Response(adminHtml, { headers: HTML_HEADERS });
    }

    if (path === '/' || path === '/index.html' || path === '/index') {
      return new Response(indexHtml, { headers: HTML_HEADERS });
    }

    if (path === '/archive.html' || path === '/archive') {
      return new Response(archiveHtml, { headers: HTML_HEADERS });
    }

    if (path === '/terminos.html' || path === '/terminos') {
      return new Response(terminosHtml, { headers: HTML_HEADERS });
    }

    if (path === '/mision.html' || path === '/mision') {
      return new Response(misionHtml, { headers: HTML_HEADERS });
    }

    if (path.startsWith('/miedo/')) {
      return renderMiedo(env, path);
    }

    const assetResponse = await env.ASSETS.fetch(request);
    if (!assetResponse || assetResponse.status === 404) return assetResponse;
    return new Response(assetResponse.body, {
      status: assetResponse.status,
      headers: new Headers({ ...Object.fromEntries(assetResponse.headers), ...STATIC_HEADERS }),
    });
  },
};

async function renderMiedo(env, path) {
  const id = Number.parseInt(path.slice('/miedo/'.length), 10);
  if (Number.isNaN(id) || id <= 0) {
    return new Response(null, { status: 302, headers: { Location: '/' } });
  }
  const fear = await db.getApprovedFearById(env, id);
  if (!fear) {
    return new Response(null, { status: 302, headers: { Location: '/' } });
  }

  const group = groupForLetter(fear.topic_letter) || 'A-C';
  const url = `${BASE_URL}/miedo/${id}`;
  const title = 'Un miedo depositado en el Archivo de Miedos';
  const desc = String(fear.content).slice(0, 200);

  const html = miedoHtml
    .replaceAll('{{OG_TITLE}}', escapeHtml(title))
    .replaceAll('{{OG_DESC}}', escapeHtml(desc))
    .replaceAll('{{OG_URL}}', url)
    .replaceAll('{{CONTENT}}', escapeHtml(fear.content))
    .replaceAll('{{TOPIC}}', escapeHtml(fear.topic || ''))
    .replaceAll('{{NUM}}', String(fear.id))
    .replaceAll('{{DATE}}', formatShortDate(fear.created_at))
    .replaceAll('{{GROUP}}', group)
    .replaceAll('{{CABINET_LINK}}', `/archive.html?cajon=${encodeURIComponent(group)}`);

  return new Response(html, { headers: HTML_HEADERS });
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
