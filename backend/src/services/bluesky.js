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

export async function createPost(env, text, opts = {}) {
  const session = await createSession(env);
  const record = {
    $type: 'app.bsky.feed.post',
    text,
    createdAt: new Date().toISOString(),
  };

  if (opts.imageBytes) {
    const blob = await uploadBlob(session, opts.imageBytes, 'image/png');
    record.embed = {
      $type: 'app.bsky.embed.images',
      images: [
        {
          image: blob,
          alt: 'Tarjeta de un miedo depositado en el Archivo de Miedos',
        },
      ],
    };
  }

  const res = await fetch(`${BSKY_API}/com.atproto.repo.createRecord`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessJwt}` },
    body: JSON.stringify({
      repo: session.did,
      collection: 'app.bsky.feed.post',
      record,
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

async function uploadBlob(session, bytes, contentType) {
  const res = await fetch(`${BSKY_API}/com.atproto.repo.uploadBlob`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.accessJwt}`, 'Content-Type': contentType },
    body: bytes,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`uploadBlob ${res.status}: ${JSON.stringify(json)}`);
  return json.blob;
}

export async function getPost(env, rkey) {
  const did = (await createSession(env)).did;
  const res = await fetch(
    `${BSKY_API}/com.atproto.repo.getRecord?repo=${did}&collection=app.bsky.feed.post&rkey=${encodeURIComponent(rkey)}`
  );
  if (res.status === 400) {
    const j = await res.json();
    if (j.error === 'RecordNotFound') return null;
    throw new Error(`getRecord ${res.status}: ${JSON.stringify(j)}`);
  }
  if (!res.ok) throw new Error(`getRecord ${res.status}`);
  return (await res.json()).value;
}

export function shareText(content) {
  return `📁 Un miedo depositado en el Archivo de Miedos (anonimo):\n\n"${String(content).slice(0, 280)}"`;
}
