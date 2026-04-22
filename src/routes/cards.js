import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = Router();

// Listar tarjetas
router.get('/', optionalAuth, async (req, res) => {
  const { category, search, sort = 'popular' } = req.query;
  try {
    let where = [];
    let params = [];
    let i = 1;

    if (category) { where.push(`c.category=$${i++}`); params.push(category); }
    if (search) { where.push(`c.name ILIKE $${i++}`); params.push(`%${search}%`); }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const orderClause = sort === 'popular' ? 'c.paw_count DESC' : 'RANDOM()';

    const result = await pool.query(
      `SELECT c.*, p.username as creator_username
       FROM cards c
       LEFT JOIN pets p ON c.created_by = p.id
       ${whereClause}
       ORDER BY ${orderClause}`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener tarjetas' });
  }
});

// Crear tarjeta
router.post('/', authenticate, async (req, res) => {
  const { name, category, pet_id } = req.body;
  if (!name || !category || !pet_id)
    return res.status(400).json({ error: 'Nombre, categoría y mascota requeridos' });

  try {
    const id = uuidv4();
    const result = await pool.query(
      'INSERT INTO cards (id, name, category, created_by) VALUES ($1,$2,$3,$4) RETURNING *',
      [id, name, category, pet_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear tarjeta' });
  }
});

// Votar con huella
router.post('/:id/paw', authenticate, async (req, res) => {
  const { pet_id } = req.body;
  try {
    await pool.query(
      'INSERT INTO card_paw_votes (card_id, pet_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [req.params.id, pet_id]
    );
    await pool.query(
      'UPDATE cards SET paw_count = (SELECT COUNT(*) FROM card_paw_votes WHERE card_id=$1) WHERE id=$1',
      [req.params.id]
    );
    const result = await pool.query('SELECT paw_count FROM cards WHERE id=$1', [req.params.id]);
    res.json({ paw_count: result.rows[0].paw_count });
  } catch (err) {
    res.status(500).json({ error: 'Error al votar' });
  }
});

// Agregar tarjeta a mascota
router.post('/:id/add-to-pet', authenticate, async (req, res) => {
  const { pet_id } = req.body;
  try {
    await pool.query(
      'INSERT INTO pet_cards (pet_id, card_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [pet_id, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al agregar tarjeta' });
  }
});

export default router;
