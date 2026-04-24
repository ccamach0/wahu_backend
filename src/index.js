import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import pool from './config/db.js';
import authRoutes from './routes/auth.js';
import petsRoutes from './routes/pets.js';
import cardsRoutes from './routes/cards.js';
import clansRoutes from './routes/clans.js';
import friendshipsRoutes from './routes/friendships.js';
import contestsRoutes from './routes/contests.js';
import hydrantRoutes from './routes/hydrant.js';
import notificationsRoutes from './routes/notifications.js';
import companionsRoutes from './routes/companions.js';
import chatRoutes from './routes/chat.js';
import appointmentsRoutes from './routes/appointments.js';
import postsRoutes from './routes/posts.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL, 'http://localhost:5173']
  : ['http://localhost:5173'];
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/pets', petsRoutes);
app.use('/api/cards', cardsRoutes);
app.use('/api/clans', clansRoutes);
app.use('/api/friendships', friendshipsRoutes);
app.use('/api/contests', contestsRoutes);
app.use('/api/hydrant', hydrantRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/companions', companionsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/posts', postsRoutes);

app.get('/api/health', (_, res) => res.json({ status: 'ok', app: 'Wahu API' }));

app.get('/api/stats', async (req, res) => {
  try {
    const [pets, clans, companions] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM pets'),
      pool.query('SELECT COUNT(*) FROM clans'),
      pool.query('SELECT COUNT(*) FROM companions'),
    ]);
    res.json({
      pets: parseInt(pets.rows[0].count),
      clans: parseInt(clans.rows[0].count),
      companions: parseInt(companions.rows[0].count),
    });
  } catch {
    res.json({ pets: 0, clans: 0, companions: 0 });
  }
});

const runMigrations = async () => {
  await pool.query(`
    ALTER TABLE companions
      ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS verification_token VARCHAR(128),
      ADD COLUMN IF NOT EXISTS verification_token_expires_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS active_pet_id UUID;
  `);
  await pool.query(`UPDATE companions SET email_verified=true WHERE email_verified=false AND verification_token IS NULL`);
  // Migrar chat a esquema basado en mascotas (idempotente)
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='conversations' AND column_name='pet1_id'
      ) THEN
        DROP TABLE IF EXISTS messages;
        DROP TABLE IF EXISTS conversations;
        CREATE TABLE conversations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          pet1_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
          pet2_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
          last_message_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
          sender_pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          read BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      END IF;
    END$$;
  `);
  // Agregar sent_as_owner a messages si no existe
  await pool.query(`
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS sent_as_owner BOOLEAN NOT NULL DEFAULT false;
  `).catch(() => {});
  await pool.query(`
    CREATE TABLE IF NOT EXISTS appointments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      requester_pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
      invited_pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL DEFAULT 'paseo',
      scheduled_at TIMESTAMPTZ NOT NULL,
      location VARCHAR(200),
      notes TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      companion_id UUID NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      message TEXT NOT NULL,
      data JSONB DEFAULT '{}',
      read BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pet_gallery (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
      image_url VARCHAR NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "order" INT DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_pet_gallery_pet_id ON pet_gallery(pet_id);
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS companion_gallery (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      companion_id UUID NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
      image_url VARCHAR NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "order" INT DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_companion_gallery_companion_id ON companion_gallery(companion_id);
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pet_posts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      sent_as_owner BOOLEAN DEFAULT FALSE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_pet_posts_pet_id ON pet_posts(pet_id);
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pet_post_comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id UUID NOT NULL REFERENCES pet_posts(id) ON DELETE CASCADE,
      author_pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      sent_as_owner BOOLEAN DEFAULT FALSE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_pet_post_comments_post_id ON pet_post_comments(post_id);
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pet_gallery_comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      gallery_image_id UUID NOT NULL REFERENCES pet_gallery(id) ON DELETE CASCADE,
      author_pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      sent_as_owner BOOLEAN DEFAULT FALSE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_pet_gallery_comments_gallery_id ON pet_gallery_comments(gallery_image_id);
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS companion_posts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      companion_id UUID NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
      pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      sent_as_owner BOOLEAN DEFAULT FALSE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_companion_posts_companion_id ON companion_posts(companion_id);
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS companion_post_comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id UUID NOT NULL REFERENCES companion_posts(id) ON DELETE CASCADE,
      author_pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      sent_as_owner BOOLEAN DEFAULT FALSE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_companion_post_comments_post_id ON companion_post_comments(post_id);
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS companion_gallery_comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      gallery_image_id UUID NOT NULL REFERENCES companion_gallery(id) ON DELETE CASCADE,
      author_pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      sent_as_owner BOOLEAN DEFAULT FALSE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_companion_gallery_comments_gallery_id ON companion_gallery_comments(gallery_image_id);
  `);
  // Clan posts and comments
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clan_posts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      clan_id UUID NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
      author_pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      sent_as_owner BOOLEAN DEFAULT FALSE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_clan_posts_clan_id ON clan_posts(clan_id);
    CREATE INDEX IF NOT EXISTS idx_clan_posts_author_pet_id ON clan_posts(author_pet_id);
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clan_post_comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id UUID NOT NULL REFERENCES clan_posts(id) ON DELETE CASCADE,
      author_pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      sent_as_owner BOOLEAN DEFAULT FALSE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_clan_post_comments_post_id ON clan_post_comments(post_id);
  `);
  // Clan gallery and gallery comments
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clan_gallery (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      clan_id UUID NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
      image_url VARCHAR NOT NULL,
      uploaded_by UUID NOT NULL REFERENCES pets(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_clan_gallery_clan_id ON clan_gallery(clan_id);
    CREATE INDEX IF NOT EXISTS idx_clan_gallery_uploaded_by ON clan_gallery(uploaded_by);
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clan_gallery_comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      gallery_image_id UUID NOT NULL REFERENCES clan_gallery(id) ON DELETE CASCADE,
      author_pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      sent_as_owner BOOLEAN DEFAULT FALSE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_clan_gallery_comments_gallery_id ON clan_gallery_comments(gallery_image_id);
  `);
  // Clan chat messages
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clan_chat_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      clan_id UUID NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
      author_pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      sent_as_owner BOOLEAN DEFAULT FALSE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_clan_chat_messages_clan_id ON clan_chat_messages(clan_id);
    CREATE INDEX IF NOT EXISTS idx_clan_chat_messages_created_at ON clan_chat_messages(created_at);
  `);
  // Clan join requests
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clan_join_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      clan_id UUID NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
      pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
      requested_at TIMESTAMPTZ DEFAULT NOW(),
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      UNIQUE (clan_id, pet_id),
      CHECK (status IN ('pending', 'approved', 'rejected'))
    );
    CREATE INDEX IF NOT EXISTS idx_clan_join_requests_clan_id ON clan_join_requests(clan_id);
    CREATE INDEX IF NOT EXISTS idx_clan_join_requests_status ON clan_join_requests(status);
  `);
};

app.listen(PORT, async () => {
  await runMigrations().catch(console.error);
  console.log(`🐾 Wahu API corriendo en http://localhost:${PORT}`);
});
