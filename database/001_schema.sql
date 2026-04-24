-- ============================================================
-- WAHU - Red Social para Mascotas
-- Script 001: Esquema de base de datos
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de compañeros (usuarios humanos)
CREATE TABLE companions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de mascotas
CREATE TABLE pets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  companion_id UUID NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  breed VARCHAR(100),
  species VARCHAR(50) DEFAULT 'Perro',
  location VARCHAR(150),
  bio TEXT,
  avatar_url TEXT,
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  popularity NUMERIC(5,2) DEFAULT 0,
  hydrant_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categorías de tarjetas
CREATE TYPE card_category AS ENUM ('Personalidad', 'Salud', 'Comportamiento', 'Habilidades', 'Energía');

-- Tarjetas (atributos comunitarios)
CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  category card_category NOT NULL,
  created_by UUID REFERENCES pets(id) ON DELETE SET NULL,
  paw_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tarjetas asignadas a mascotas
CREATE TABLE pet_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pet_id, card_id)
);

-- Votos de huellas en tarjetas
CREATE TABLE card_paw_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  voted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(card_id, pet_id)
);

-- Amistades (Jauría = todos, Manada = top 20 favoritos)
CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  is_manada BOOLEAN DEFAULT FALSE,
  manada_order INTEGER,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pet_id, friend_id)
);

-- Clanes
CREATE TABLE clans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  avatar_url TEXT,
  cover_url TEXT,
  level INTEGER DEFAULT 1,
  member_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES pets(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Miembros de clanes
CREATE TABLE clan_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clan_id UUID NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(clan_id, pet_id)
);

-- Certámenes (concursos)
CREATE TYPE contest_type AS ENUM ('Disfraces', 'Habilidades', 'Belleza');
CREATE TYPE contest_status AS ENUM ('upcoming', 'active', 'finished');

CREATE TABLE contests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  type contest_type NOT NULL,
  status contest_status DEFAULT 'upcoming',
  prize_description TEXT,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Participantes en certámenes
CREATE TABLE contest_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  media_url TEXT,
  votes INTEGER DEFAULT 0,
  entered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contest_id, pet_id)
);

-- Croquetas (moneda virtual)
CREATE TABLE croqueta_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  companion_id UUID NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saldo de croquetas por compañero
CREATE TABLE companion_croquetas (
  companion_id UUID PRIMARY KEY REFERENCES companions(id) ON DELETE CASCADE,
  balance INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_pets_companion ON pets(companion_id);
CREATE INDEX idx_pet_cards_pet ON pet_cards(pet_id);
CREATE INDEX idx_friendships_pet ON friendships(pet_id);
CREATE INDEX idx_friendships_friend ON friendships(friend_id);
CREATE INDEX idx_clan_members_clan ON clan_members(clan_id);
CREATE INDEX idx_clan_members_pet ON clan_members(pet_id);
CREATE INDEX idx_cards_category ON cards(category);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_companions_updated BEFORE UPDATE ON companions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_pets_updated BEFORE UPDATE ON pets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Trigger para actualizar member_count en clanes
CREATE OR REPLACE FUNCTION sync_clan_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE clans SET member_count = member_count + 1 WHERE id = NEW.clan_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE clans SET member_count = member_count - 1 WHERE id = OLD.clan_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_clan_member_count
AFTER INSERT OR DELETE ON clan_members
FOR EACH ROW EXECUTE FUNCTION sync_clan_member_count();
