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
};

app.listen(PORT, async () => {
  await runMigrations().catch(console.error);
  console.log(`🐾 Wahu API corriendo en http://localhost:${PORT}`);
});
