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

- **Estáticos**: los HTML (portada, archivo, admin, términos, misión y la plantilla de ficha `/miedo`) se importan como texto y se sirven desde el Worker (así se evita el redirect `.html` → extensión vacía del runtime de dev). CSS/JS/imágenes se sirven vía el binding `ASSETS` (carpeta `frontend/`) con `run_worker_first: true`.
- **API pública** bajo `/api/*`.
- **API de administración** bajo `/api/admin/*`, protegida con HTTP Basic Auth.

### Enrutamiento (`backend/src/index.js`)

```
/                       → index.html
/archive(.html)         → archive.html
/admin(.html)           → admin.html (requiere auth; loguea el intento)
/terminos(.html)        → terminos.html
/mision(.html)          → mision.html (README en vivo desde GitHub)
/miedo/:id              → plantilla con OG dinámico del miedo (redirige a / si no existe)
/api/*                  → handleFears
/api/admin/*            → handleAdmin (loguea el intento)
todo lo demás           → env.ASSETS.fetch
```

### Navegación vertical

Todas las páginas llevan un menú vertical izquierdo (`<nav class="side-nav">`) con estética de archivador: `Inicio`, `Archivo` y los **9 cajones** (A-C…Y-Z) que abren el cajón en `/archive.html?cajon=X`, más `Términos` y `Misión`. Los cajones del menú son los mismos archivadores de la página de archivos y llenan el alto disponible. En la página de archivo, `archive.js` marca como activo el cajón según `?cajon=` y lo abre. En móvil (< 900px) el menú se oculta y se despliega desde un botón hamburguesa (izquierda → derecha, con backdrop), colapsando al elegir una opción o al pulsar Esc.

`mision.html` muestra el contenido de `README.md` cargándolo en vivo desde `raw.githubusercontent.com` (CORS `*`) y renderizándolo con `marked` (CDN jsdelivr, pinned v12). El renderer escapa HTML crudo del markdown (no se inyecta HTML arbitrario) y abre enlaces externos en otra pestaña. Así la página refleja cualquier actualización del README sin redeploy.

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
| content | TEXT | CHECK 10–300 caracteres |
| first_letter | CHAR(1) | GENERATED ALWAYS, UPPER(SUBSTR(content,1,1)) |
| apoyos | INTEGER | contador de reacciones "apoyo" |
| fuerzas | INTEGER | contador de reacciones "fuerza" |
| topic | TEXT | tema del miedo extraído por IA (ej. "arañas") |
| topic_letter | CHAR(1) | letra del tema (base de la agrupación por letra) |
| ip_hash | TEXT | SHA-256 de la IP del autor (para rate limit) |
| created_at | DATETIME | default CURRENT_TIMESTAMP |
| is_approved | BOOLEAN | |
| is_reported | BOOLEAN | |
| status | TEXT | pending / approved / rejected |
| moderation_comment | TEXT | motivo de la moderación |

**Agrupación por letra.** Los archivadores agrupan por el **tema real del miedo**, no por la primera letra de la frase: "Tengo miedo a las arañas" queda en la letra **A**. En `POST /api/fears`, `services/classify.js` llama a Workers AI (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`, `temperature: 0`) para identificar el **miedo de fondo** (concepto emocional) entre una taxonomía de referencia (fracaso, rechazo, abandono, soledad, maltrato, muerte, enfermedad, oscuridad, etc.): "Tengo miedo a mi papá" → `maltrato` (M); "Tengo miedo a que nadie ocupe esta app" → `abandono` (A). De ahí se deriva `topic` y `topic_letter` (normalizada a A–Z, sin acentos). Si la IA falla, cae a una heurística en español (patrones "miedo a las X", "me da miedo la X", "me asusta la X", etc.); como último recurso usa la primera letra del contenido. Las consultas públicas filtran por `topic_letter`. La columna generada `first_letter` queda como legado sin uso.

### `reactions` — reacciones (dedup por cookie + tipo)
`UNIQUE(fear_id, cookie_id, type)`. `type ∈ {apoyo, fuerza}`. Sustituye a la antigua tabla `likes` (migración: `database/migrate_reactions.sql`).

### `shares` — publicaciones en Bluesky
Dedup por miedo (`fear_id UNIQUE`), con `ip_hash` (para rate limit de compartidos), `rkey` y `post_uri` del post creado en `@archmiedos.bsky.social`. El post publica la tarjeta del miedo como imagen (anónimo). Límite: 10 compartidos/día por IP.

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
GET  /api/fears/latest                         Último miedo aprobado
GET  /api/fears/:id                            Un miedo aprobado por id
POST /api/fears                                { content } → modera + clasifica + guarda
POST /api/fears/:id/reaction                   { type: "apoyo"|"fuerza" } → reacciona (cookie)
POST /api/fears/:id/share                      Publica el miedo de forma anónima en @archmiedos.bsky.social → { url }
GET  /api/stats                                Contadores públicos: miedos/apoyos/fuerzas aprobados
```

`POST /api/fears` devuelve `201` (aprobado) o `202` (en revisión) e incluye `classification: { topic, letter, group }` con el tema extraído por IA, la letra y el rango de cajón (A-C…Y-Z). El frontend muestra al usuario dónde quedó archivado su miedo y el tema detectado. El rate limit es de 5 envíos/día por IP (hash).

`POST /api/fears/:id/reaction`: dedup por cookie (`am_visitor`, HttpOnly, 1 año) y tipo. Si la cookie no existe se genera un UUID y se devuelve `Set-Cookie`. Devuelve `{ apoyos, fuerzas, alreadyReacted }`.

### Administración (HTTP Basic Auth)
```
GET    /api/admin/fears?status=pending|approved|rejected|reported|all
PUT    /api/admin/fears/:id        { status, comment? }
DELETE /api/admin/fears/:id
GET    /api/admin/stats            + topLiked (orden por apoyos+fuerzas) + activity 7 días
GET    /api/admin/logs?limit=100   últimos accesos al panel (admin_logs)
POST   /api/admin/reclassify       reclasifica todos los miedos por tema (IA); backfill
```

Las credenciales de admin se leen de los secretos `ADMIN_USERNAME` / `ADMIN_PASSWORD` (en `.dev.vars` para local). Comparación con `timingSafeEqual`.

## Flujo de moderación

1. `POST /api/fears` valida contenido (10–300 chars) y rate limit.
2. `moderateContent` llama a Llama Guard 3 8B con `input` = `{ messages: [{ role: "user", content }] }`. **Nota:** el modelo no acepta rol `system`; usar siempre `user`/`assistant` (bug resuelto en `services/ai.js`).
3. Si `unsafe`, se guarda con `status=pending` y se inserta un `reports`; queda oculto del público hasta decisión manual del admin.
4. Si `safe`, se publica directamente (`is_approved=1`).

## Seguridad

- **Basic Auth** para el panel, con `WWW-Authenticate` en 401.
- **Registro de accesos** (tabla `admin_logs`) con la máxima información disponible del request para detección de ataques.
- **Sin datos personales**: los visitantes no registran IP ni telemetría. La única excepción es el rate limit de envíos, que usa un hash SHA-256 de la IP (no reversible).
- **Sanitización**: el contenido se escapa en el frontend (`escapeHtml`) antes de insertarse en el DOM.
- Los secrets (`ADMIN_USERNAME`, `ADMIN_PASSWORD`, credenciales de cuenta) están gitignoreados.

## Integración con Bluesky (AT Protocol)

### 1. Tarjeta al compartir enlaces (cuenta `nocloudware.bsky.social`)

Al compartir un enlace del sitio en Bluesky se muestra una tarjeta. Se usan dos mecanismos (implementados según el patrón del proyecto Bluesk-AI):

1. **Tags Open Graph** (método 1). Todas las páginas (`index`, `archive`, `admin`, `terminos`, `mision`, `miedo`) llevan `og:title`, `og:description`, `og:type`, `og:url`, `og:image` (usando `card.png`, 892×448, servido por ASSETS en `/card.png`) y `twitter:card = summary_large_image`. El fetcher de Bluesky los lee automáticamente al compartir el link. No requiere cuenta.

2. **Tarjeta extendida `site.standard.*`** (método 2). Se crean records AT en el repositorio de `nocloudware.bsky.social`:
   - `site.standard.publication` (el sitio, una vez, rkey `archmiedos`), con el ícono `card.png` subido como blob.
   - `site.standard.document` por página pública (rkeys `archmiedos-inicio`, `archmiedos-el-archivo`, `archmiedos-terminos`), con `site` apuntando a la publicación, `title`, `publishedAt`, `description`, `textContent` (para el tiempo de lectura) y `contributors`.
   - Cada página emite `<link rel="site.standard.publication">` y `<link rel="site.standard.document">` con sus `at://` URIs para que el fetcher resuelva los records.

Configuración: las credenciales están en `.env.bsky` (gitignored): `BSKY_HANDLE`, `BSKY_APP_PASSWORD`. El script `scripts/setup-bsky.mjs` hace login, sube el ícono y crea/actualiza los records con `com.atproto.repo.putRecord` (idempotente). Para regenerar los tags:

```
node scripts/setup-bsky.mjs
```

Si cambian los records, actualizar los `<link rel>` embebidos en los HTML con las nuevas `at://` URIs. El documento de admin no se crea (página protegida).

### 2. Compartir miedos de forma anónima (`@archmiedos.bsky.social`)

Cada ficha del archivo y de la portada tiene un botón "Compartir en Bluesky". `POST /api/fears/:id/share` (`services/bluesky.js`):
- El frontend renderiza la **tarjeta del miedo como imagen** (`scripts/card.js` → `renderFearCard`, canvas con tipografía de la página: **Special Elite** en títulos y **Kalam** manuscrita en el cuerpo; incluye texto del miedo, fecha, apoyos 🫂, fuerzas 💪 y `Tema:` centrado) y la envía en el body como `image` (data URL PNG).
- El backend sube la imagen (`uploadBlob`) y crea un post `app.bsky.feed.post` con `app.bsky.embed.images` (imagen simple, sin crop). El texto del post es el encabezado anónimo + **link a la página de inicio** con **facet** (`app.bsky.richtext.facet` → link clickeable). El **alt-text** de la imagen incluye el texto del miedo y los contadores. Si no hay imagen, cae al post de solo texto con link.
- Dedup con validación: `getRecord` verifica que el post exista y tenga imagen; si fue borrado o es de solo texto, se recrea con la tarjeta y se actualiza la fila de `shares`. Rate limit: 10/día por IP.
- Credenciales en secretos `BSKY_HANDLE` / `BSKY_APP_PASSWORD` (y `.dev.vars` local).

## Otros

- **Ficha compartida** (`frontend/scripts/card.js`): `fearCardHTML()` genera la misma ficha en el archivo y en la portada (azar) — contenido, tema, fecha, reacciones y compartir — y `bindCardActions()` conecta reacciones y compartir por delegación.
- **Carrusel infinito** (cajón del archivo, `archive.js` + `archive.css`): las fichas de un cajón se muestran en un carrusel horizontal con loop sin costuras (clones del primer y último miedo). Navegación con flechas (desktop), teclado (←/→) y swipe con el dedo (pointer + `touch-action: pan-y` para que el móvil no intercepte el gesto horizontal). En móvil (< 900px) las flechas se ocultan y solo queda el swipe.
- **Portada tipo dashboard**: menú + columna principal (título, hero, depósito, "Tu miedo") + sidebar derecho de 25% con contadores (miedos/apoyos/fuerzas) arriba y "Del archivo" (último + aleatorio) abajo; sin scroll en desktop (≥900px), apilado en móvil.
- **Mi miedo**: cookie `am_mine` (ids de depósitos del visitante) → panel "Tu miedo" con enlace al cajón y **certificado de superación** (PNG generado en canvas).
- **Página `/miedo/:id`**: URL pública por miedo con OG dinámico (`og:title/description` = contenido del miedo). Sirve como destino de los posts compartidos. Si el miedo no existe o no está aprobado, redirige a `/`.
- **PWA**: `manifest.json`, iconos 192/512, `theme-color` y `sw.js` **network-first** (siempre sirve la versión nueva; el caché solo como respaldo offline). `scripts/cf.mjs` **renueva la versión del caché del SW en cada deploy** (auto-bump), de modo que la PWA siempre refleja el último despliegue.
- **SEO**: `robots.txt` y `sitemap.xml` estáticos en ASSETS.

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
│   ├── index.html / archive.html / admin.html / terminos.html / mision.html / miedo.html
│   ├── manifest.json / sw.js / robots.txt / sitemap.xml   # PWA y SEO
│   ├── icons/             # iconos 192/512 + favicon
│   ├── card.png           # imagen OG / ícono de la publicación AT
│   ├── styles/            # main.css, archive.css, admin.css
│   └── scripts/           # card.js (ficha compartida), submit.js, archive.js, admin.js, mision.js, home.js, nav.js
├── backend/src/
│   ├── index.js           # Worker principal (enrutado + estáticos)
│   ├── routes/            # fears.js, admin.js
│   ├── services/          # db.js, ai.js, classify.js, bluesky.js, auth.js, adminLog.js
│   └── utils/             # http.js, validation.js
├── database/
│   ├── schema.sql         # esquema completo (instalaciones nuevas)
│   └── migrate_*.sql      # migraciones incrementales
├── scripts/
│   ├── cf.mjs             # wrapper de wrangler (renueva el caché SW en cada deploy)
│   └── setup-bsky.mjs     # crea/actualiza records site.standard.* en Bluesky
├── wrangler.jsonc
└── package.json
```

## Notas operativas

- El custom domain (`archmiedos.nocloudware.com`) pertenece a la misma cuenta Cloudflare (zona `nocloudware.com`). Se gestiona por la API de Custom Domains, que sí tiene permiso el token. La API de *zone routes* (`/zones/{zone}/workers/routes`) NO está disponible con el token actual; `workers_dev: true` evita que wrangler la consulte. Si se quieren más dominios o rutas por zona, ampliar el token con "Workers Routes".
- El dominio `archivo-de-miedos.nocloudware.workers.dev` sigue activo como respaldo.
