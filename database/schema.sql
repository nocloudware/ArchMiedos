PRAGMA foreign_keys = ON;

-- Tabla principal de miedos
CREATE TABLE IF NOT EXISTS fears (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL CHECK (length(content) BETWEEN 10 AND 300),
  first_letter CHAR(1) GENERATED ALWAYS AS (UPPER(SUBSTR(content, 1, 1))) STORED,
  apoyos INTEGER DEFAULT 0,
  fuerzas INTEGER DEFAULT 0,
  topic TEXT,
  topic_letter CHAR(1),
  ip_hash TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_approved BOOLEAN DEFAULT 0,
  is_reported BOOLEAN DEFAULT 0,
  status TEXT DEFAULT 'pending',
  moderation_comment TEXT
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_first_letter ON fears(first_letter);
CREATE INDEX IF NOT EXISTS idx_approved ON fears(is_approved);
CREATE INDEX IF NOT EXISTS idx_created_at ON fears(created_at);
CREATE INDEX IF NOT EXISTS idx_ip_hash ON fears(ip_hash);
CREATE INDEX IF NOT EXISTS idx_topic_letter ON fears(topic_letter);

-- Reacciones (Apoyo/Fuerza) con dedup por cookie y tipo
CREATE TABLE IF NOT EXISTS reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fear_id INTEGER NOT NULL REFERENCES fears(id) ON DELETE CASCADE,
  cookie_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('apoyo', 'fuerza')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(fear_id, cookie_id, type)
);

CREATE INDEX IF NOT EXISTS idx_reactions_fear ON reactions(fear_id);

-- Reportes para el panel de admin
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fear_id INTEGER NOT NULL REFERENCES fears(id) ON DELETE CASCADE,
  reason TEXT,
  reported_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reports_fear ON reports(fear_id);

-- Registros de acceso al panel de administración (detección de ataques)
CREATE TABLE IF NOT EXISTS admin_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ip TEXT,
  asn TEXT,
  country TEXT,
  region TEXT,
  city TEXT,
  timezone TEXT,
  user_agent TEXT,
  cf_ray TEXT,
  username TEXT,
  method TEXT,
  path TEXT,
  success INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_logs_ip ON admin_logs(ip);

-- Publicaciones compartidas en Bluesky (dedup por miedo)
CREATE TABLE IF NOT EXISTS shares (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fear_id INTEGER NOT NULL UNIQUE REFERENCES fears(id) ON DELETE CASCADE,
  ip_hash TEXT,
  rkey TEXT NOT NULL,
  post_uri TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shares_ip ON shares(ip_hash);
