# IMPLEMENTACION — Archivo de Miedos

Descripción funcional y técnica de la implementación. Para una lectura enfocada en el usuario, ver [README.md](README.md).

## Stack

| Componente | Tecnología | Propósito |
|---|---|---|
| Hosting + API + estáticos | Cloudflare Workers (single Worker) | Servir frontend y API en un único despliegue |
| Base de datos | Cloudflare D1 (SQLite) | Persistencia: miedos, reacciones, reportes y registros de acceso |
| Moderación IA | Workers AI — Llama Guard 3 8B (`@cf/meta/llama-guard-3-8b`) | Filtro automático de contenido |
| Frontend | HTML/CSS/JS vanilla | Sin frameworks; estética retro 50s con animaciones modernas |

## Arquitectura

El Worker `archivo-de-miedos` es la única pieza desplegada. Atiende:

- **Estáticos**: los 3 HTML (portada, archivo, admin) se importan como texto y se sirven desde el Worker (así se evita el redirect `.html` → extensión vacía del runtime de dev). CSS/JS/imágenes se sirven vía el binding `ASSETS` (carpeta `frontend/`) con `run_worker_first: true`.
- **API pública** bajo `/api/*`.
- **API de administración** bajo `/api/admin/*`, protegida con HTTP Basic Auth.

### Enrutamiento (`backend/src/index.js`)

```
/                       → index.html
/archive(.html)         → archive.html
/admin(.html)           → admin.html (requiere auth; loguea el intento)
/terminos(.html)        → terminos.html
/api/*                  → handleFears
/api/admin/*            → handleAdmin (loguea el intento)
todo lo demás           → env.ASSETS.fetch
```

### Configuración (`wrangler.jsonc`)

- `workers_dev: true` + `routes: [{ pattern: "archmiedos.nocloudware.com", custom_domain: true }]` — el custom domain se gestiona con la API de Custom Domains (no requiere permiso de zone routes en el token).
- `assets` con binding `ASSETS` y `run_worker_first`.
- `d1_databases` → binding `DB` (database `archivo-de-miedos-db`).
- `ai` → binding `AI`.
- `rules: [{ type: "Text", globs: ["**/*.html"] }]` — los imports de `.html` como texto.
- `observability.enabled: true`.

## Base de datos

### `fears` — miedos
| Columna | Tipo | Notas |
|---|---|---|
| id | INTEGER PK | autoincrement |
| content | TEXT | CHECK 10–2000 caracteres |
| first_letter | CHAR(1) | GENERATED ALWAYS, UPPER(SUBSTR(content,1,1)) |
| apoyos | INTEGER | contador de reacciones "apoyo" |
| fuerzas | INTEGER | contador de reacciones "fuerza" |
| ip_hash | TEXT | SHA-256 de la IP del autor (para rate limit) |
| created_at | DATETIME | default CURRENT_TIMESTAMP |
| is_approved | BOOLEAN | |
| is_reported | BOOLEAN | |
| status | TEXT | pending / approved / rejected |
| moderation_comment | TEXT | motivo de la moderación |

### `reactions` — reacciones (dedup por cookie + tipo)
`UNIQUE(fear_id, cookie_id, type)`. `type ∈ {apoyo, fuerza}`. Sustituye a la antigua tabla `likes` (migración: `database/migrate_reactions.sql`).

### `reports` — reportes de moderación
Referencia `fear_id` con `ON DELETE CASCADE`.

### `admin_logs` — registros de acceso al panel
Cada intento de acceso a `/admin` o `/api/admin/*` (válido o inválido) se registra para detectar ataques de fuerza bruta:

| Columna | Fuente |
|---|---|
| created_at | timestamp de Cloudflare |
| ip | header `CF-Connecting-IP` |
| asn | header `CF-IPASN` |
| country | header `CF-IPCountry` |
| region | header `CF-IPRegion` |
| city | header `CF-IPCity` |
| timezone | header `CF-IPTimezone` |
| user_agent | header `User-Agent` |
| cf_ray | header `CF-Ray` |
| method / path | del request |
| username | usuario intentado, decodificado del header Basic (NUNCA se guarda la contraseña) |
| success | 0/1 según `isAuthorized` |

El logging es *best-effort*: si la inserción falla, no bloquea la petición.

## API

### Públicos
```
GET  /api/fears?letter=A-C&limit=20&offset=0   Lista aprobados por rango de letra
GET  /api/fears/search?q=araña&limit=20        Búsqueda por palabra clave
GET  /api/fears/random                         Miedo aleatorio aprobado
POST /api/fears                                { content } → modera + guarda
POST /api/fears/:id/reaction                   { type: "apoyo"|"fuerza" } → reacciona (cookie)
```

`POST /api/fears` devuelve `201` (aprobado) o `202` (en revisión). El rate limit es de 5 envíos/día por IP (hash).

`POST /api/fears/:id/reaction`: dedup por cookie (`am_visitor`, HttpOnly, 1 año) y tipo. Si la cookie no existe se genera un UUID y se devuelve `Set-Cookie`. Devuelve `{ apoyos, fuerzas, alreadyReacted }`.

### Administración (HTTP Basic Auth)
```
GET    /api/admin/fears?status=pending|approved|rejected|reported|all
PUT    /api/admin/fears/:id        { status, comment? }
DELETE /api/admin/fears/:id
GET    /api/admin/stats            + topLiked (orden por apoyos+fuerzas) + activity 7 días
GET    /api/admin/logs?limit=100   últimos accesos al panel (admin_logs)
```

Las credenciales de admin se leen de los secretos `ADMIN_USERNAME` / `ADMIN_PASSWORD` (en `.dev.vars` para local). Comparación con `timingSafeEqual`.

## Flujo de moderación

1. `POST /api/fears` valida contenido (10–2000 chars) y rate limit.
2. `moderateContent` llama a Llama Guard 3 8B con `input` = `{ messages: [{ role: "user", content }] }`. **Nota:** el modelo no acepta rol `system`; usar siempre `user`/`assistant` (bug resuelto en `services/ai.js`).
3. Si `unsafe`, se guarda con `status=pending` y se inserta un `reports`; queda oculto del público hasta decisión manual del admin.
4. Si `safe`, se publica directamente (`is_approved=1`).

## Seguridad

- **Basic Auth** para el panel, con `WWW-Authenticate` en 401.
- **Registro de accesos** (tabla `admin_logs`) con la máxima información disponible del request para detección de ataques.
- **Sin datos personales**: los visitantes no registran IP ni telemetría. La única excepción es el rate limit de envíos, que usa un hash SHA-256 de la IP (no reversible).
- **Sanitización**: el contenido se escapa en el frontend (`escapeHtml`) antes de insertarse en el DOM.
- Los secrets (`ADMIN_USERNAME`, `ADMIN_PASSWORD`, credenciales de cuenta) están gitignoreados.

## Despliegue y entorno

Este proyecto usa credenciales de Cloudflare **exclusivas** (cuenta `nocloudware`). Todos los comandos pasan por `scripts/cf.mjs`, que inyecta `CLOUDFLARE_EMAIL`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` desde `.env.cloudflare` (gitignored) sin tocar el OAuth global de otras cuentas.

```
npm run dev             # wrangler dev local (usa .dev.vars)
npm run deploy          # despliegue a producción
npm run db:init         # esquema en D1 local
npm run db:init:remote  # esquema en D1 de producción
npm run whoami          # verifica la cuenta activa
```

Migraciones: los cambios de esquema sobre bases existentes se aplican con los scripts de `database/migrate_*.sql` (ej. `migrate_reactions.sql`, `migrate_admin_logs.sql`) mediante `wrangler d1 execute ... --file=...`.

## Estructura de archivos

```
├── frontend/
│   ├── index.html / archive.html / admin.html / terminos.html
│   ├── styles/            # main.css, archive.css, admin.css
│   └── scripts/           # submit.js, archive.js, admin.js
├── backend/src/
│   ├── index.js           # Worker principal (enrutado + estáticos)
│   ├── routes/            # fears.js, admin.js
│   ├── services/          # db.js, ai.js, auth.js, adminLog.js
│   └── utils/             # http.js, validation.js
├── database/
│   ├── schema.sql         # esquema completo (instalaciones nuevas)
│   └── migrate_*.sql      # migraciones incrementales
├── scripts/cf.mjs         # wrapper de wrangler con credenciales del proyecto
├── wrangler.jsonc
└── package.json
```

## Notas operativas

- El custom domain (`archmiedos.nocloudware.com`) pertenece a la misma cuenta Cloudflare (zona `nocloudware.com`). Se gestiona por la API de Custom Domains, que sí tiene permiso el token. La API de *zone routes* (`/zones/{zone}/workers/routes`) NO está disponible con el token actual; `workers_dev: true` evita que wrangler la consulte. Si se quieren más dominios o rutas por zona, ampliar el token con "Workers Routes".
- El dominio `archivo-de-miedos.nocloudware.workers.dev` sigue activo como respaldo.
