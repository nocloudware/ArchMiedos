-- Migración: clasificación por tema real del miedo (topic + topic_letter)
ALTER TABLE fears ADD COLUMN topic TEXT;
ALTER TABLE fears ADD COLUMN topic_letter CHAR(1);
CREATE INDEX IF NOT EXISTS idx_topic_letter ON fears(topic_letter);
