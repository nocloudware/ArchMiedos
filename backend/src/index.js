import { handleFears } from './routes/fears.js';
import { handleAdmin } from './routes/admin.js';
import { isAuthorized } from './services/auth.js';
import { logAdminAccess } from './services/adminLog.js';
import { unauthorized } from './utils/http.js';
import indexHtml from '../../frontend/index.html';
import archiveHtml from '../../frontend/archive.html';
import adminHtml from '../../frontend/admin.html';
import terminosHtml from '../../frontend/terminos.html';

const HTML_HEADERS = { 'Content-Type': 'text/html; charset=utf-8' };

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

    return env.ASSETS.fetch(request);
  },
};
