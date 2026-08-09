export function isAuthorized(request, env) {
  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Basic ')) return false;

  let decoded;
  try {
    decoded = atob(header.slice(6));
  } catch {
    return false;
  }

  const separator = decoded.indexOf(':');
  if (separator === -1) return false;
  const user = decoded.slice(0, separator);
  const pass = decoded.slice(separator + 1);

  const expectedUser = env.ADMIN_USERNAME || '';
  const expectedPass = env.ADMIN_PASSWORD || '';
  return timingSafeEqual(user, expectedUser) && timingSafeEqual(pass, expectedPass);
}

function timingSafeEqual(a, b) {
  const maxLen = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < maxLen; i++) {
    const ac = i < a.length ? a.charCodeAt(i) : 0;
    const bc = i < b.length ? b.charCodeAt(i) : 0;
    diff |= ac ^ bc;
  }
  return diff === 0;
}
