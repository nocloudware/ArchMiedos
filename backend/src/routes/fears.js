import { json, notFound } from '../utils/http.js';
import { validateContent, parseLetterRange, clamp, RATE_LIMIT_PER_DAY } from '../utils/validation.js';
import { moderateContent } from '../services/ai.js';
import * as db from '../services/db.js';

const VISITOR_COOKIE = 'am_visitor';

export async function handleFears(request, env, path, url) {
  const method = request.method;
  const segments = path.split('/').filter(Boolean);

  if (path === '/api/fears/search' && method === 'GET') return searchFears(env, url);
  if (path === '/api/fears/random' && method === 'GET') return randomFear(env);
  if (path === '/api/fears' && method === 'GET') return listFears(env, url);
  if (path === '/api/fears' && method === 'POST') return createFear(request, env);
  if (
    segments.length === 4 &&
    segments[0] === 'api' &&
    segments[1] === 'fears' &&
    segments[3] === 'like' &&
    method === 'POST'
  ) {
    return likeFear(request, env, segments[2]);
  }
  return notFound();
}

async function listFears(env, url) {
  const letter = url.searchParams.get('letter');
  const { ok, from, to, error } = parseLetterRange(letter);
  if (!ok) return json({ error }, 400);

  const fromLetter = from ?? 'A';
  const toLetter = to ?? 'Z';
  const limit = clamp(url.searchParams.get('limit'), 1, 50, 20);
  const offset = clamp(url.searchParams.get('offset'), 0, 10000, 0);

  const [items, total] = await Promise.all([
    db.listApprovedByLetter(env, fromLetter, toLetter, limit, offset),
    db.countApprovedByLetter(env, fromLetter, toLetter),
  ]);
  return json({ total: total.total, items: items.results });
}

async function searchFears(env, url) {
  const q = (url.searchParams.get('q') || '').trim();
  if (!q) return json({ error: 'Parámetro q requerido' }, 400);
  const limit = clamp(url.searchParams.get('limit'), 1, 50, 20);
  const result = await db.searchApproved(env, q, limit);
  return json({ total: result.results.length, items: result.results });
}

async function randomFear(env) {
  const fear = await db.randomApproved(env);
  return json({ items: fear ? [fear] : [] });
}

async function createFear(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const { ok, value, error } = validateContent(body?.content);
  if (!ok) return json({ error }, 400);

  const ipHash = await hashIp(request.headers.get('CF-Connecting-IP') || 'unknown');
  const rate = await db.countSubmissionsByIp(env, ipHash);
  if (rate.total >= RATE_LIMIT_PER_DAY) {
    return json({ error: 'Has alcanzado el límite de 5 envíos por día. Vuelve mañana.' }, 429);
  }

  const mod = await moderateContent(env, value);
  const approved = mod.isSafe;
  const result = await db.insertFear(env, { content: value, ipHash, approved, comment: mod.comment });

  if (!approved) {
    await db.insertReport(env, result.meta.last_row_id, mod.comment || 'Reportado por moderación automática');
  }

  return json(
    {
      id: result.meta.last_row_id,
      status: approved ? 'approved' : 'pending_approval',
      message: approved
        ? 'Tu miedo ha sido depositado en el archivo'
        : 'Tu miedo está en revisión por un moderador',
    },
    approved ? 201 : 202
  );
}

async function likeFear(request, env, idStr) {
  const fearId = Number.parseInt(idStr, 10);
  if (Number.isNaN(fearId) || fearId <= 0) return notFound();

  const existing = await db.getFearById(env, fearId);
  if (!existing) return notFound();

  let cookieId = getVisitorId(request);
  const isNewCookie = cookieId === null;
  if (isNewCookie) cookieId = crypto.randomUUID();
  let alreadyLiked = false;

  try {
    await db.addLike(env, fearId, cookieId);
    await db.incrementLikes(env, fearId);
  } catch {
    alreadyLiked = true;
  }

  const likes = await db.getLikes(env, fearId);
  const response = json({ likes: likes.likes, alreadyLiked });

  if (isNewCookie) {
    response.headers.append('Set-Cookie', makeVisitorCookie(cookieId));
  }
  return response;
}

function getVisitorId(request) {
  const cookies = parseCookies(request.headers.get('Cookie') || '');
  return cookies[VISITOR_COOKIE] || null;
}

function parseCookies(header) {
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

function makeVisitorCookie(value) {
  return `${VISITOR_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`;
}

async function hashIp(ip) {
  const data = new TextEncoder().encode(ip);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
