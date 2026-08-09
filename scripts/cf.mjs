// Wrapper de wrangler con credenciales exclusivas de este proyecto.
// Lee .env.cloudflare (gitignored) y ejecuta wrangler con esas variables,
// de modo que SIEMPRE use la cuenta de nocloudware sin tocar el OAuth global.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(root, '.env.cloudflare');
const wranglerBin = path.join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');

function loadEnv(file) {
  const vars = {};
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return vars;
  }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

const creds = loadEnv(envFile);
const args = process.argv.slice(2);

// En cada deploy se renueva la versión del caché del service worker (PWA),
// para que los navegadores reinstalen el SW, purguen cachés viejas y bajen el
// shell actualizado.
if (args[0] === 'deploy') {
  bumpSwCacheVersion();
}

const child = spawn(process.execPath, [wranglerBin, ...args], {
  cwd: root,
  env: { ...process.env, ...creds },
  stdio: 'inherit',
});

function bumpSwCacheVersion() {
  const swPath = path.join(root, 'frontend', 'sw.js');
  const version = `archmiedos-${Date.now()}`;
  try {
    const sw = readFileSync(swPath, 'utf8');
    const updated = sw.replace(/const CACHE = 'archmiedos-[^']*';/, `const CACHE = '${version}';`);
    if (updated !== sw) {
      writeFileSync(swPath, updated);
      console.log(`♻️  PWA: cache del service worker renovado (${version})`);
    }
  } catch (err) {
    console.warn('⚠️  No se pudo renovar el cache del SW:', err.message);
  }
}

child.on('error', (err) => {
  console.error('No se pudo ejecutar wrangler:', err.message);
  process.exit(1);
});

child.on('exit', (code) => process.exit(code ?? 1));
