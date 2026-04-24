-- ============================================================
-- Migration: Add tags system and pet attributes (age, gender)
-- ============================================================

-- Add age and gender fields to pets table
ALTER TABLE pets
ADD COLUMN IF NOT EXISTS age NUMERIC(4,2),
ADD COLUMN IF NOT EXISTS gender VARCHAR(50);

-- Create pet_tags table for editable pet-specific tags
CREATE TABLE IF NOT EXISTS pet_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  tag_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pet_id, tag_name)
);

-- Create index for pet_tags
CREATE INDEX IF NOT EXISTS idx_pet_tags_pet ON pet_tags(pet_id);

-- Add comment on purpose of tables
COMMENT ON TABLE pet_tags IS 'User-created, editable tags for individual pets (e.g., #amigable, #activo) - distinct from community cards';
