export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

export function unauthorized(env = {}) {
  return json({ error: 'No autorizado' }, 401, {
    'WWW-Authenticate': 'Basic realm="Archivo de Miedos"',
  });
}

export function methodNotAllowed() {
  return json({ error: 'Método no permitido' }, 405);
}

export function notFound() {
  return json({ error: 'No encontrado' }, 404);
}
