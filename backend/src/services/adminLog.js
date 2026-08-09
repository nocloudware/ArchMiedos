import * as db from './db.js';

export function extractAccessInfo(request) {
  const headers = request.headers;
  const get = (name) => headers.get(name) || null;
  return {
    ip: get('CF-Connecting-IP'),
    asn: get('CF-IPASN'),
    country: get('CF-IPCountry'),
    region: get('CF-IPRegion'),
    city: get('CF-IPCity'),
    timezone: get('CF-IPTimezone'),
    user_agent: (get('User-Agent') || '').slice(0, 500) || null,
    cf_ray: get('CF-Ray'),
    username: extractUsername(request),
  };
}

export async function logAdminAccess(request, env, path, authorized) {
  try {
    await db.logAdminAccess(env, {
      ...extractAccessInfo(request),
      method: request.method,
      path: String(path || '').slice(0, 300),
      success: authorized ? 1 : 0,
    });
  } catch {
    // El registro es best-effort: nunca debe bloquear la petición.
  }
}

function extractUsername(request) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Basic ')) return null;
  try {
    const decoded = atob(auth.slice(6));
    const idx = decoded.indexOf(':');
    if (idx === -1) return null;
    return decoded.slice(0, idx).slice(0, 200) || null;
  } catch {
    return null;
  }
}
