import { json, notFound } from '../utils/http.js';
import { isAuthorized } from '../services/auth.js';
import * as db from '../services/db.js';
import { clamp } from '../utils/validation.js';

export async function handleAdmin(request, env, path, url) {
  if (!isAuthorized(request, env)) {
    return json({ error: 'No autorizado' }, 401, {
      'WWW-Authenticate': 'Basic realm="Archivo de Miedos"',
    });
  }

  const method = request.method;

  if (path === '/api/admin/stats' && method === 'GET') return getStats(env);
  if (path === '/api/admin/fears' && method === 'GET') return listFears(env, url);

  const updateMatch = path.match(/^\/api\/admin\/fears\/(\d+)$/);
  if (updateMatch && method === 'PUT') return updateFear(request, env, updateMatch[1]);
  if (updateMatch && method === 'DELETE') return deleteFear(env, updateMatch[1]);

  return notFound();
}

async function listFears(env, url) {
  const status = url.searchParams.get('status') || 'pending';
  const limit = clamp(url.searchParams.get('limit'), 1, 100, 20);
  const offset = clamp(url.searchParams.get('offset'), 0, 10000, 0);
  const result = await db.listAdminFears(env, status, limit, offset);
  return json({ items: result.results });
}

async function updateFear(request, env, idStr) {
  const id = Number.parseInt(idStr, 10);
  if (Number.isNaN(id) || id <= 0) return notFound();

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const status = body?.status;
  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return json({ error: 'Status inválido. Use approved, rejected o pending.' }, 400);
  }

  const comment = typeof body?.comment === 'string' ? body.comment.slice(0, 500) : null;
  const result = await db.updateFearStatus(env, id, status, comment);
  if (result.meta.changes === 0) return notFound();

  return json({ ok: true, id });
}

async function deleteFear(env, idStr) {
  const id = Number.parseInt(idStr, 10);
  if (Number.isNaN(id) || id <= 0) return notFound();

  const result = await db.deleteFear(env, id);
  if (result.meta.changes === 0) return notFound();

  return json({ ok: true, id });
}

async function getStats(env) {
  const [stats, top, activity] = await Promise.all([
    db.getStats(env),
    db.getTopLiked(env, 5),
    db.getRecentActivity(env, 7),
  ]);
  return json({ ...stats, topLiked: top.results, activity: activity.results });
}
