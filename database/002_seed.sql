-- ============================================================
-- WAHU - Script 002: Datos de prueba
-- ============================================================

-- Compañeros (usuarios)
INSERT INTO companions (id, username, name, email, password_hash, avatar_url) VALUES
  ('11111111-0000-0000-0000-000000000001', 'ana_garcia', 'Ana García', 'ana@wahu.com', '$2b$10$placeholder_hash', 'https://i.pravatar.cc/150?img=1'),
  ('11111111-0000-0000-0000-000000000002', 'carlos_lopez', 'Carlos López', 'carlos@wahu.com', '$2b$10$placeholder_hash', 'https://i.pravatar.cc/150?img=2'),
  ('11111111-0000-0000-0000-000000000003', 'maria_santos', 'María Santos', 'maria@wahu.com', '$2b$10$placeholder_hash', 'https://i.pravatar.cc/150?img=3');

-- Mascotas
INSERT INTO pets (id, companion_id, name, username, breed, location, bio, avatar_url, level, xp, popularity) VALUES
  ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Max', 'max_golden', 'Golden Retriever', 'Lima, Perú', 'Soy Max, el golden más amigable del parque!', 'https://images.unsplash.com/photo-1633722715463-d30f4f325e24?w=400', 12, 2400, 85),
  ('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000002', 'Luna', 'luna_husky', 'Husky Siberiano', 'Miraflores', 'Exploradora nata, amante del frío y las aventuras', 'https://images.unsplash.com/photo-1605568427561-40dd23c2acea?w=400', 8, 1600, 92),
  ('22222222-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000003', 'Rocky', 'rocky_lab', 'Labrador', 'Barranco', 'Entrenado y listo para competir!', 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400', 42, 8400, 76);

-- Saldo de croquetas
INSERT INTO companion_croquetas (companion_id, balance) VALUES
  ('11111111-0000-0000-0000-000000000001', 0),
  ('11111111-0000-0000-0000-000000000002', 150),
  ('11111111-0000-0000-0000-000000000003', 75);

-- Tarjetas
INSERT INTO cards (id, name, category, created_by, paw_count) VALUES
  ('33333333-0000-0000-0000-000000000001', 'Juguetón', 'Personalidad', '22222222-0000-0000-0000-000000000002', 521),
  ('33333333-0000-0000-0000-000000000002', 'Todas las vacunas', 'Salud', '22222222-0000-0000-0000-000000000001', 512),
  ('33333333-0000-0000-0000-000000000003', 'Sociable', 'Personalidad', '22222222-0000-0000-0000-000000000001', 445),
  ('33333333-0000-0000-0000-000000000004', 'Vacuna antirrábica', 'Salud', '22222222-0000-0000-0000-000000000002', 423),
  ('33333333-0000-0000-0000-000000000005', 'Entrenado', 'Comportamiento', '22222222-0000-0000-0000-000000000003', 389),
  ('33333333-0000-0000-0000-000000000006', 'Obediente', 'Habilidades', '22222222-0000-0000-0000-000000000003', 378),
  ('33333333-0000-0000-0000-000000000007', 'Alta energía', 'Energía', '22222222-0000-0000-0000-000000000001', 312),
  ('33333333-0000-0000-0000-000000000008', 'Amigable', 'Comportamiento', '22222222-0000-0000-0000-000000000002', 298);

-- Tarjetas en mascotas
INSERT INTO pet_cards (pet_id, card_id) VALUES
  ('22222222-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001'),
  ('22222222-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000002'),
  ('22222222-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000007'),
  ('22222222-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000001'),
  ('22222222-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000004'),
  ('22222222-0000-0000-0000-000000000003', '33333333-0000-0000-0000-000000000005'),
  ('22222222-0000-0000-0000-000000000003', '33333333-0000-0000-0000-000000000006');

-- Amistades
INSERT INTO friendships (pet_id, friend_id, is_manada, manada_order, status) VALUES
  ('22222222-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002', true, 1, 'accepted'),
  ('22222222-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000003', true, 2, 'accepted'),
  ('22222222-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000001', false, null, 'accepted');

-- Clanes
INSERT INTO clans (id, name, description, avatar_url, level, member_count, created_by) VALUES
  ('44444444-0000-0000-0000-000000000001', 'Aventureros del Parque', 'Mascotas que aman explorar parques y espacios verdes', 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400', 18, 156, '22222222-0000-0000-0000-000000000001'),
  ('44444444-0000-0000-0000-000000000002', 'Guardianes Nocturnos', 'Para mascotas que prefieren los paseos de noche', 'https://images.unsplash.com/photo-1605568427561-40dd23c2acea?w=400', 12, 89, '22222222-0000-0000-0000-000000000002');

-- Miembros de clanes
INSERT INTO clan_members (clan_id, pet_id, role) VALUES
  ('44444444-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 'admin'),
  ('44444444-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002', 'member'),
  ('44444444-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000002', 'admin');
