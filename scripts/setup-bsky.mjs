// Configura los records AT (site.standard.*) para la tarjeta extendida de Bluesky.
// Crea/actualiza (idempotente, via putRecord) el record de publicación y un
// record de documento por página, y emite los <link rel="site.standard.*">.
// Uso: node scripts/setup-bsky.mjs
// Credenciales en .env.bsky (gitignored): BSKY_HANDLE, BSKY_APP_PASSWORD
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BSKY_API = 'https://bsky.social/xrpc';

const SITE_BASE = 'https://archmiedos.nocloudware.com';
const SITE_NAME = 'Archivo de Miedos';
const SITE_DESCRIPTION =
  'Deposita tu miedo en el archivo y libérate. Un espacio anónimo para dejar escrito aquello que te da miedo, y para apoyar a los demás.';
const PAGES = [
  {
    rkey: 'inicio',
    title: 'Archivo de Miedos',
    path: '/',
    description: 'Deposita tu miedo en el archivo y libérate. Anónimo, sin juicios.',
    textContent:
      'Archivo de Miedos. Deposita tu miedo en el archivo y libérate. Escríbelo, deposítalo en el archivador correcto y olvídate de él. Anónimo, sencillo y sin juicios. Explora el archivo y deja apoyos o fuerza a los demás.',
  },
  {
    rkey: 'el-archivo',
    title: 'El Archivo — Archivo de Miedos',
    path: '/archive.html',
    description: 'Explora los miedos que otros han depositado, ordenados por su primera letra.',
    textContent:
      'El Archivo. Nueve cajones. Todos tus miedos. Cada cajón guarda los miedos por su primera letra. Lee lo que otros han dejado y acompaña con apoyo o fuerza.',
  },
  {
    rkey: 'terminos',
    title: 'Términos de servicio — Archivo de Miedos',
    path: '/terminos.html',
    description: 'Términos de servicio del Archivo de Miedos: anonimato, moderación y contacto.',
    textContent:
      'Términos de servicio del Archivo de Miedos. Anonimato y datos personales, moderación automática con IA y revisión manual, contenido prohibido, reclamos en nocloudware@outlook.com.',
  },
];

function loadEnv(file) {
  const vars = {};
  if (!existsSync(file)) return vars;
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    vars[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return vars;
}

async function bsky(method, pathname, token, body) {
  const res = await fetch(`${BSKY_API}/${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${pathname} ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

async function login(handle, appPassword) {
  const json = await bsky('POST', 'com.atproto.server.createSession', null, {
    identifier: handle,
    password: appPassword,
  });
  return json; // { accessJwt, did, handle, ... }
}

async function uploadBlob(token, filePath) {
  const bytes = readFileSync(filePath);
  const res = await fetch(`${BSKY_API}/com.atproto.repo.uploadBlob`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'image/png' },
    body: bytes,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`uploadBlob ${res.status}: ${JSON.stringify(json)}`);
  return json.blob;
}

async function putRecord(token, did, collection, rkey, record) {
  return bsky('POST', 'com.atproto.repo.putRecord', token, {
    repo: did,
    collection,
    rkey,
    record,
  });
}

async function main() {
  const env = loadEnv(path.join(root, '.env.bsky'));
  const handle = env.BSKY_HANDLE;
  const appPassword = env.BSKY_APP_PASSWORD;
  if (!handle || !appPassword) {
    console.error('Faltan BSKY_HANDLE / BSKY_APP_PASSWORD en .env.bsky');
    process.exit(1);
  }

  const session = await login(handle, appPassword);
  const token = session.accessJwt;
  const did = session.did;
  console.log(`✔ Sesión iniciada como ${session.handle} (${did})`);

  const icon = await uploadBlob(token, path.join(root, 'frontend', 'card.png'));
  console.log('✔ Ícono (card.png) subido');

  const pub = await putRecord(token, did, 'site.standard.publication', 'archmiedos', {
    $type: 'site.standard.publication',
    url: SITE_BASE,
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    icon,
  });
  console.log(`✔ Publicación: ${pub.uri}`);

  const refs = [];
  for (const page of PAGES) {
    const doc = await putRecord(token, did, 'site.standard.document', `archmiedos-${page.rkey}`, {
      $type: 'site.standard.document',
      site: pub.uri,
      title: page.title,
      path: page.path,
      publishedAt: new Date().toISOString(),
      description: page.description,
      textContent: page.textContent,
      tags: ['miedos', 'anonimato', 'salud emocional'],
      contributors: [{ did, displayName: SITE_NAME, role: 'author' }],
    });
    console.log(`✔ Documento ${page.rkey}: ${doc.uri}`);
    refs.push({ path: page.path, uri: doc.uri });
  }

  console.log('\n=== link tags (insertar en <head>) ===');
  console.log(`<link rel="site.standard.publication" href="${pub.uri}">`);
  for (const r of refs) {
    console.log(`${r.path} -> <link rel="site.standard.document" href="${r.uri}">`);
  }
}

main().catch((e) => {
  console.error('✘', e.message);
  process.exit(1);
});
