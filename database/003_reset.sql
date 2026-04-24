-- ============================================================
-- WAHU - Script 003: Reset completo (desarrollo)
-- ADVERTENCIA: Elimina todos los datos y tablas
-- ============================================================

DROP TABLE IF EXISTS croqueta_transactions CASCADE;
DROP TABLE IF EXISTS companion_croquetas CASCADE;
DROP TABLE IF EXISTS contest_entries CASCADE;
DROP TABLE IF EXISTS contests CASCADE;
DROP TABLE IF EXISTS clan_members CASCADE;
DROP TABLE IF EXISTS clans CASCADE;
DROP TABLE IF EXISTS friendships CASCADE;
DROP TABLE IF EXISTS card_paw_votes CASCADE;
DROP TABLE IF EXISTS pet_cards CASCADE;
DROP TABLE IF EXISTS cards CASCADE;
DROP TABLE IF EXISTS pets CASCADE;
DROP TABLE IF EXISTS companions CASCADE;

DROP TYPE IF EXISTS card_category CASCADE;
DROP TYPE IF EXISTS contest_type CASCADE;
DROP TYPE IF EXISTS contest_status CASCADE;

DROP FUNCTION IF EXISTS update_updated_at CASCADE;
DROP FUNCTION IF EXISTS sync_clan_member_count CASCADE;
