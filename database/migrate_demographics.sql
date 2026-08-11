-- Migración: datos opcionales demográficos en el formulario de depósito.
-- sexo (hombre/mujer/otro), rango de edad (0-19 ... 90+) y país (ISO 3166-1 alpha-2).
-- Todos opcionales; NULL significa "prefiero no decirlo".

ALTER TABLE fears ADD COLUMN sex TEXT;
ALTER TABLE fears ADD COLUMN age_group TEXT;
ALTER TABLE fears ADD COLUMN country TEXT;

CREATE INDEX IF NOT EXISTS idx_fears_sex ON fears(sex);
CREATE INDEX IF NOT EXISTS idx_fears_age_group ON fears(age_group);
CREATE INDEX IF NOT EXISTS idx_fears_country ON fears(country);
