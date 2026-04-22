import { Router } from 'express';
import pool from '../config/db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM contests ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener certámenes' });
  }
});

router.get('/active', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, array_agg(
        jsonb_build_object('pet_id', ce.pet_id, 'votes', ce.votes, 'media_url', ce.media_url,
                           'pet_name', p.name, 'pet_username', p.username, 'pet_avatar', p.avatar_url)
      ) FILTER (WHERE ce.id IS NOT NULL) as entries
       FROM contests c
       LEFT JOIN contest_entries ce ON c.id = ce.contest_id
       LEFT JOIN pets p ON ce.pet_id = p.id
       WHERE c.status='active'
       GROUP BY c.id ORDER BY c.start_date DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

router.post('/:id/enter', authenticate, async (req, res) => {
  const { pet_id, media_url } = req.body;
  try {
    await pool.query(
      'INSERT INTO contest_entries (contest_id, pet_id, media_url) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
      [req.params.id, pet_id, media_url]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al participar' });
  }
});

export default router;
