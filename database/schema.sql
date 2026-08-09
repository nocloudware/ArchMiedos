PRAGMA foreign_keys = ON;

-- Tabla principal de miedos
CREATE TABLE IF NOT EXISTS fears (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL CHECK (length(content) BETWEEN 10 AND 2000),
  first_letter CHAR(1) GENERATED ALWAYS AS (UPPER(SUBSTR(content, 1, 1))) STORED,
  likes INTEGER DEFAULT 0,
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

-- Apoyos (likes) con dedup por cookie
CREATE TABLE IF NOT EXISTS likes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fear_id INTEGER NOT NULL REFERENCES fears(id) ON DELETE CASCADE,
  cookie_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(fear_id, cookie_id)
);

CREATE INDEX IF NOT EXISTS idx_likes_fear ON likes(fear_id);

-- Reportes para el panel de admin
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fear_id INTEGER NOT NULL REFERENCES fears(id) ON DELETE CASCADE,
  reason TEXT,
  reported_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reports_fear ON reports(fear_id);
