import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = Router();

// Listar clanes
router.get('/', optionalAuth, async (req, res) => {
  const { sort = 'popular' } = req.query;
  const order = sort === 'popular' ? 'c.member_count DESC' : 'c.created_at DESC';
  try {
    const result = await pool.query(
      `SELECT c.*, p.username as creator_username FROM clans c
       LEFT JOIN pets p ON c.created_by = p.id
       ORDER BY ${order}`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener clanes' });
  }
});

// Ver clan por ID
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const clan = await pool.query(
      `SELECT c.*, p.username as creator_username FROM clans c
       LEFT JOIN pets p ON c.created_by = p.id WHERE c.id=$1`,
      [req.params.id]
    );
    if (!clan.rows.length) return res.status(404).json({ error: 'Clan no encontrado' });

    const members = await pool.query(
      `SELECT p.id, p.name, p.username, p.avatar_url, p.level, cm.role
       FROM clan_members cm JOIN pets p ON cm.pet_id = p.id
       WHERE cm.clan_id=$1 ORDER BY cm.joined_at`,
      [req.params.id]
    );
    res.json({ ...clan.rows[0], members: members.rows });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener clan' });
  }
});

// Crear clan
router.post('/', authenticate, async (req, res) => {
  const { name, description, avatar_url, pet_id } = req.body;
  if (!name || !pet_id) return res.status(400).json({ error: 'Nombre y mascota requeridos' });

  try {
    const id = uuidv4();
    await pool.query(
      'INSERT INTO clans (id, name, description, avatar_url, created_by) VALUES ($1,$2,$3,$4,$5)',
      [id, name, description, avatar_url, pet_id]
    );
    await pool.query(
      'INSERT INTO clan_members (clan_id, pet_id, role) VALUES ($1,$2,$3)',
      [id, pet_id, 'admin']
    );
    const result = await pool.query('SELECT * FROM clans WHERE id=$1', [id]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear clan' });
  }
});

// Unirse a clan
router.post('/:id/join', authenticate, async (req, res) => {
  const { pet_id } = req.body;
  try {
    await pool.query(
      'INSERT INTO clan_members (clan_id, pet_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [req.params.id, pet_id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al unirse al clan' });
  }
});

// Mis clanes
router.get('/my/:pet_id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.* FROM clans c JOIN clan_members cm ON c.id = cm.clan_id
       WHERE cm.pet_id=$1 ORDER BY c.name`,
      [req.params.pet_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener mis clanes' });
  }
});

export default router;
