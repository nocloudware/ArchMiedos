-- Migración: tabla de publicaciones compartidas en Bluesky (dedup por miedo)
CREATE TABLE IF NOT EXISTS shares (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fear_id INTEGER NOT NULL UNIQUE REFERENCES fears(id) ON DELETE CASCADE,
  ip_hash TEXT,
  rkey TEXT NOT NULL,
  post_uri TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shares_ip ON shares(ip_hash);
