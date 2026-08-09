import { json, notFound } from '../utils/http.js';
import { validateContent, parseLetterRange, clamp, RATE_LIMIT_PER_DAY } from '../utils/validation.js';
import { moderateContent } from '../services/ai.js';
import { classifyFear, groupForLetter } from '../services/classify.js';
import * as db from '../services/db.js';

const VISITOR_COOKIE = 'am_visitor';

export async function handleFears(request, env, path, url) {
  const method = request.method;
  const segments = path.split('/').filter(Boolean);

  if (path === '/api/fears/search' && method === 'GET') return searchFears(env, url);
  if (path === '/api/fears/random' && method === 'GET') return randomFear(env);
  if (path === '/api/stats' && method === 'GET') return publicStats(env);
  if (path === '/api/fears' && method === 'GET') return listFears(env, url);
  if (path === '/api/fears' && method === 'POST') return createFear(request, env);
  if (
    segments.length === 4 &&
    segments[0] === 'api' &&
    segments[1] === 'fears' &&
    segments[3] === 'reaction' &&
    method === 'POST'
  ) {
    return reactToFear(request, env, segments[2]);
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

async function publicStats(env) {
  const s = await db.getPublicStats(env);
  return json({ fears: s.fears, apoyos: s.apoyos, fuerzas: s.fuerzas });
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
  const { topic, letter } = await classifyFear(env, value);
  const result = await db.insertFear(env, {
    content: value,
    ipHash,
    approved,
    comment: mod.comment,
    topic,
    topicLetter: letter,
  });

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
      classification: {
        topic: topic || null,
        letter: letter || null,
        group: groupForLetter(letter),
      },
    },
    approved ? 201 : 202
  );
}

async function reactToFear(request, env, idStr) {
  const fearId = Number.parseInt(idStr, 10);
  if (Number.isNaN(fearId) || fearId <= 0) return notFound();

  const existing = await db.getFearById(env, fearId);
  if (!existing) return notFound();

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }
  const type = body?.type;
  if (type !== 'apoyo' && type !== 'fuerza') {
    return json({ error: 'Tipo inválido. Use "apoyo" o "fuerza".' }, 400);
  }

  let cookieId = getVisitorId(request);
  const isNewCookie = cookieId === null;
  if (isNewCookie) cookieId = crypto.randomUUID();
  let alreadyReacted = false;

  try {
    await db.addReaction(env, fearId, cookieId, type);
    await db.incrementReaction(env, fearId, type);
  } catch {
    alreadyReacted = true;
  }

  const counts = await db.getReactions(env, fearId);
  const response = json({ apoyos: counts.apoyos, fuerzas: counts.fuerzas, alreadyReacted });

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
