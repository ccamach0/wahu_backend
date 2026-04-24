-- ============================================================
-- Migration: Enhanced Card System with Multiple Types & Like System
-- Tipos de tarjetas: simple, doble, triple
-- ============================================================

-- Agregar tipo de tarjeta y campos de valores
ALTER TABLE cards
ADD COLUMN IF NOT EXISTS card_type VARCHAR(20) DEFAULT 'simple' CHECK (card_type IN ('simple', 'doble', 'triple')),
ADD COLUMN IF NOT EXISTS value1_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS value1_value VARCHAR(100),
ADD COLUMN IF NOT EXISTS value2_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS value2_value VARCHAR(100),
ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0;

-- Crear tabla para registro de "likes" en tarjetas (distinto de votos de huellas)
CREATE TABLE IF NOT EXISTS card_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  liked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(card_id, pet_id)
);

-- Crear índice para búsquedas rápidas de likes
CREATE INDEX IF NOT EXISTS idx_card_likes_card ON card_likes(card_id);
CREATE INDEX IF NOT EXISTS idx_card_likes_pet ON card_likes(pet_id);

-- Crear vista para tarjetas con estadísticas completas
CREATE OR REPLACE VIEW card_stats AS
SELECT
  c.id,
  c.name,
  c.category,
  c.card_type,
  c.value1_name,
  c.value1_value,
  c.value2_name,
  c.value2_value,
  c.paw_count,
  c.like_count,
  COUNT(DISTINCT cpv.pet_id) as unique_paw_voters,
  COUNT(DISTINCT cl.pet_id) as unique_likers,
  c.created_by,
  c.created_at
FROM cards c
LEFT JOIN card_paw_votes cpv ON c.id = cpv.card_id
LEFT JOIN card_likes cl ON c.id = cl.card_id
GROUP BY c.id;

-- Agregar comentario descriptivo
COMMENT ON TABLE card_likes IS 'Sistema de likes para posicionamiento de tarjetas - similar a huellas pero registra preferencia del usuario';
COMMENT ON TABLE cards IS 'Tarjetas con soporte para tipos: simple (solo nombre), doble (nombre + 1 valor), triple (nombre + 2 valores)';
