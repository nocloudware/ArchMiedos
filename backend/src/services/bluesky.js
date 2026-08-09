// Publicación anónima en Bluesky desde la cuenta @archmiedos.bsky.social.
// Las credenciales se leen de los secretos BSKY_HANDLE / BSKY_APP_PASSWORD.
// El post NO revela identidad: solo el contenido del miedo.

const BSKY_API = 'https://bsky.social/xrpc';

export function shareAccount(env) {
  return { handle: env.BSKY_HANDLE || 'archmiedos.bsky.social' };
}

export async function createSession(env) {
  const handle = env.BSKY_HANDLE;
  const password = env.BSKY_APP_PASSWORD;
  if (!handle || !password) throw new Error('Faltan BSKY_HANDLE / BSKY_APP_PASSWORD');
  const res = await fetch(`${BSKY_API}/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: handle, password }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`createSession ${res.status}: ${JSON.stringify(json)}`);
  return json; // { accessJwt, did, handle, ... }
}

export async function createPost(env, text) {
  const session = await createSession(env);
  const res = await fetch(`${BSKY_API}/com.atproto.repo.createRecord`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessJwt}` },
    body: JSON.stringify({
      repo: session.did,
      collection: 'app.bsky.feed.post',
      record: {
        $type: 'app.bsky.feed.post',
        text,
        createdAt: new Date().toISOString(),
      },
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`createRecord ${res.status}: ${JSON.stringify(json)}`);
  const rkey = json.uri.split('/').pop();
  return {
    uri: json.uri,
    cid: json.cid,
    rkey,
    url: `https://bsky.app/profile/${session.handle}/post/${rkey}`,
  };
}

export function shareText(content) {
  return `📁 Un miedo depositado en el Archivo de Miedos (anonimo):\n\n"${String(content).slice(0, 280)}"`;
}
