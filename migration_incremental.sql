-- Migración incremental: Agregar soporte para tarjetas mejoradas y etiquetas

-- 1. Verificar y agregar columnas faltantes a cards si no existen
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cards' AND column_name = 'card_type'
    ) THEN
        ALTER TABLE cards ADD COLUMN card_type character varying(20) DEFAULT 'simple';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cards' AND column_name = 'value1_name'
    ) THEN
        ALTER TABLE cards ADD COLUMN value1_name character varying(100);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cards' AND column_name = 'value1_value'
    ) THEN
        ALTER TABLE cards ADD COLUMN value1_value character varying(100);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cards' AND column_name = 'value2_name'
    ) THEN
        ALTER TABLE cards ADD COLUMN value2_name character varying(100);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cards' AND column_name = 'value2_value'
    ) THEN
        ALTER TABLE cards ADD COLUMN value2_value character varying(100);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cards' AND column_name = 'like_count'
    ) THEN
        ALTER TABLE cards ADD COLUMN like_count integer DEFAULT 0;
    END IF;
END $$;

-- 2. Crear tabla card_likes si no existe
CREATE TABLE IF NOT EXISTS public.card_likes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
    card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
    pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
    liked_at timestamp with time zone DEFAULT now(),
    UNIQUE(card_id, pet_id)
);

-- 3. Crear índices para card_likes si no existen
CREATE INDEX IF NOT EXISTS idx_card_likes_card ON public.card_likes USING btree (card_id);
CREATE INDEX IF NOT EXISTS idx_card_likes_pet ON public.card_likes USING btree (pet_id);

-- 4. Crear tabla pet_tags si no existe
CREATE TABLE IF NOT EXISTS public.pet_tags (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
    pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
    tag_name character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(pet_id, tag_name)
);

-- 5. Crear índice para pet_tags si no existe
CREATE INDEX IF NOT EXISTS idx_pet_tags_pet ON public.pet_tags USING btree (pet_id);

-- Fin de la migración
