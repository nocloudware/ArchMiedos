-- Migración: tabla de registros de acceso al panel de administración
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
