import { json, notFound } from '../utils/http.js';
import { validateContent, parseLetterRange, clamp, RATE_LIMIT_PER_DAY } from '../utils/validation.js';
import { moderateContent } from '../services/ai.js';
import { classifyFear, groupForLetter } from '../services/classify.js';
import { createPost, getPost, shareAccount } from '../services/bluesky.js';
import * as db from '../services/db.js';

const VISITOR_COOKIE = 'am_visitor';
const MINE_COOKIE = 'am_mine';
const SHARE_LIMIT_PER_DAY = 10;
const SITE_BASE = 'https://archmiedos.nocloudware.com';

export async function handleFears(request, env, path, url) {
  const method = request.method;
  const segments = path.split('/').filter(Boolean);

  if (path === '/api/fears/search' && method === 'GET') return searchFears(env, url);
  if (path === '/api/fears/random' && method === 'GET') return randomFear(env);
  if (path === '/api/fears/latest' && method === 'GET') return latestFear(env);
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
  if (
    segments.length === 4 &&
    segments[0] === 'api' &&
    segments[1] === 'fears' &&
    segments[3] === 'share' &&
    method === 'POST'
  ) {
    return shareFear(request, env, segments[2]);
  }
  if (segments.length === 3 && segments[0] === 'api' && segments[1] === 'fears' && method === 'GET') {
    return getSingleFear(env, segments[2]);
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

async function latestFear(env) {
  const fear = await db.getLatestApproved(env);
  return json({ items: fear ? [fear] : [] });
}

async function getSingleFear(env, idStr) {
  const id = Number.parseInt(idStr, 10);
  if (Number.isNaN(id) || id <= 0) return notFound();
  const fear = await db.getApprovedFearById(env, id);
  if (!fear) return notFound();
  return json({ item: fear });
}

async function shareFear(request, env, idStr) {
  const fearId = Number.parseInt(idStr, 10);
  if (Number.isNaN(fearId) || fearId <= 0) return notFound();

  const fear = await db.getApprovedFearById(env, fearId);
  if (!fear) return notFound();

  let body = {};
  try {
    body = await request.json();
  } catch {
    /* sin imagen */
  }

  const image = typeof body?.image === 'string' && body.image.startsWith('data:image/png;base64,')
    ? body.image.slice('data:image/png;base64,'.length)
    : null;

  const homeUrl = `${SITE_BASE}/`;
  const imageBytes = image ? Uint8Array.from(atob(image), (c) => c.charCodeAt(0)) : null;

  const text = `📁 Un miedo depositado en el Archivo de Miedos (anonimo)\n\n${homeUrl}`;

  const postOpts = { link: homeUrl };
  if (image) {
    postOpts.imageBytes = imageBytes;
    postOpts.alt = `Miedo anónimo: "${String(fear.content).slice(0, 220)}". Apoyos: ${fear.apoyos ?? 0} · Fuerzas: ${fear.fuerzas ?? 0}`;
  }

  // Dedup con validación: si el post ya no existe o es de solo texto, se recrea con imagen.
  const existing = await db.getShareByFear(env, fearId);
  if (existing) {
    try {
      const post = await getPost(env, existing.rkey);
      const hasImage = !!(post && post.embed && post.embed.$type === 'app.bsky.embed.images');
      if (post && hasImage) {
        return json({
          url: `https://bsky.app/profile/${shareAccount(env).handle}/post/${existing.rkey}`,
          alreadyShared: true,
        });
      }
    } catch {
      /* si falla la verificación, se recrea por seguridad */
    }
  }

  const ipHash = await hashIp(request.headers.get('CF-Connecting-IP') || 'unknown');
  const rate = await db.countSharesByIpToday(env, ipHash);
  if (rate.total >= SHARE_LIMIT_PER_DAY) {
    return json({ error: 'Has alcanzado el límite de compartidos de hoy. Vuelve mañana.' }, 429);
  }

  try {
    const post = await createPost(env, text, postOpts);
    if (existing) {
      await db.updateShare(env, fearId, post.rkey, post.uri);
    } else {
      await db.insertShare(env, { fearId, ipHash, rkey: post.rkey, postUri: post.uri });
    }
    return json({ url: post.url, alreadyShared: false });
  } catch {
    return json({ error: 'No se pudo publicar en Bluesky ahora. Inténtalo más tarde.' }, 502);
  }
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

  const response = json(
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

  if (result.meta.last_row_id) {
    response.headers.append('Set-Cookie', makeMineCookie(result.meta.last_row_id, request));
  }
  return response;
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

function makeMineCookie(fearId, request) {
  const existing = parseCookies(request.headers.get('Cookie') || '')[MINE_COOKIE] || '';
  const ids = existing ? existing.split(',') : [];
  if (!ids.includes(String(fearId))) ids.unshift(String(fearId));
  const list = ids.slice(0, 20).join(',');
  return `${MINE_COOKIE}=${encodeURIComponent(list)}; Path=/; SameSite=Lax; Max-Age=31536000`;
}

async function hashIp(ip) {
  const data = new TextEncoder().encode(ip);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
