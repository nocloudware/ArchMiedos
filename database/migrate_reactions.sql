-- Migración: sustituir likes por reacciones Apoyo/Fuerza (aplicar a DBs existentes)

-- 1. Nueva tabla de reacciones con tipo
CREATE TABLE IF NOT EXISTS reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fear_id INTEGER NOT NULL REFERENCES fears(id) ON DELETE CASCADE,
  cookie_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('apoyo', 'fuerza')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(fear_id, cookie_id, type)
);

CREATE INDEX IF NOT EXISTS idx_reactions_fear ON reactions(fear_id);

-- 2. Migrar likes existentes como 'apoyo'
INSERT OR IGNORE INTO reactions (fear_id, cookie_id, type)
SELECT fear_id, cookie_id, 'apoyo' FROM likes;

-- 3. Columnas de contadores
ALTER TABLE fears ADD COLUMN apoyos INTEGER DEFAULT 0;
ALTER TABLE fears ADD COLUMN fuerzas INTEGER DEFAULT 0;

-- 4. Recalcular contadores
UPDATE fears SET
  apoyos = (SELECT COUNT(*) FROM reactions WHERE reactions.fear_id = fears.id AND reactions.type = 'apoyo'),
  fuerzas = (SELECT COUNT(*) FROM reactions WHERE reactions.fear_id = fears.id AND reactions.type = 'fuerza');

-- 5. Eliminar tabla y columna antiguas
DROP TABLE IF EXISTS likes;
ALTER TABLE fears DROP COLUMN likes;
