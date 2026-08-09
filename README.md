# 📁 Archivo de Miedos

Una aplicación web que funciona como un *archivo anónimo de miedos* con estética retro de oficina de los años 50, pero con animaciones modernas y fluidas. Los usuarios pueden depositar sus miedos anónimamente, explorar los miedos de otros a través de archivadores metálicos interactivos, y dar *apoyos* (likes) para crear comunidad.

> Deposita tu miedo en el archivo y libérate.

## 🏗️ Arquitectura

| Componente | Tecnología | Propósito |
|------------|------------|-----------|
| Hosting + API | Cloudflare Workers | Servir el frontend y exponer la API |
| Base de Datos | Cloudflare D1 (SQLite) | Almacenar miedos, likes y reportes |
| Moderación IA | Workers AI — Llama Guard 3 8B | Filtrar contenido ofensivo |

El Worker sirve tanto los archivos estáticos (`index.html`, `archive.html`, `admin.html`, CSS y JS) como la API bajo `/api/*` en un único despliegue.

## 🗄️ Funcionalidades

- **Depositar un miedo**: formulario con validación (10–2000 caracteres), moderación automática por IA y rate limit de 5 envíos/día por IP.
- **Explorar el archivo**: grid 3x3 de archivadores metálicos (A–C hasta Y–Z), apertura animada de cajones, tarjetas estilo ficha de biblioteca.
- **Búsqueda**: por palabra clave dentro de cada cajón.
- **Apoyos (likes)**: cada visitante puede apoyar cada miedo una sola vez (dedup por cookie).
- **Panel de administración**: moderación (aprobar/rechazar/eliminar), reportes y estadísticas. Protegido con HTTP Basic Auth.

## 🗄️ Endpoints de la API

### Públicos

```
GET  /api/fears?letter=A&limit=20&offset=0   Miedos aprobados por letra
GET  /api/fears/search?q=araña&limit=20      Búsqueda por palabra clave
POST /api/fears                              Depositar un miedo { content }
POST /api/fears/:id/like                     Añadir un apoyo (cookie)
GET  /api/fears/random                       Miedo aleatorio aprobado
```

### Administración (requiere autenticación)

```
GET    /api/admin/fears?status=pending       Lista miedos para moderar
PUT    /api/admin/fears/:id                  Actualizar estado
DELETE /api/admin/fears/:id                  Eliminar miedo
GET    /api/admin/stats                      Estadísticas del sistema
```

## 🚀 Setup para desarrollo

Requisitos: Node.js 18+, [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/).

```bash
npm install
wrangler d1 execute archivo-de-miedos-db --file=./database/schema.sql
# Configurar secretos
wrangler secret put ADMIN_USERNAME
wrangler secret put ADMIN_PASSWORD
# Desarrollo local
wrangler dev
# Desplegar
wrangler deploy
```

## 📁 Estructura

```
├── frontend/
│   ├── index.html          # Página de ingreso
│   ├── archive.html        # Página del archivo (archivadores)
│   ├── admin.html          # Panel de administración
│   ├── styles/             # main.css, archive.css, admin.css
│   └── scripts/            # submit.js, archive.js, admin.js
├── backend/
│   └── src/
│       ├── index.js        # Worker principal (estáticos + API)
│       ├── routes/         # fears.js, admin.js
│       ├── services/       # db.js, ai.js, auth.js
│       └── utils/          # validation.js
├── database/
│   └── schema.sql          # Esquema D1
├── wrangler.toml
└── package.json
```

## 🚀 Próximas mejoras

Comentarios anidados · Tags/categorías · Modo oscuro · Notificaciones · Certificado de superación (exportar) · Muro de la fama.
