import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = Router();

// Listar tarjetas con estadísticas de likes
router.get('/', optionalAuth, async (req, res) => {
  const { category, search, sort = 'popular' } = req.query;
  try {
    let where = [];
    let params = [];
    let i = 1;

    if (category) { where.push(`c.category=$${i++}`); params.push(category); }
    if (search) { where.push(`c.name ILIKE $${i++}`); params.push(`%${search}%`); }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const orderClause = sort === 'popular' ? 'c.paw_count + COALESCE(c.like_count, 0) DESC' : 'RANDOM()';

    const result = await pool.query(
      `SELECT c.*,
              p.username as creator_username,
              COUNT(DISTINCT cl.pet_id) as like_count_actual
       FROM cards c
       LEFT JOIN pets p ON c.created_by = p.id
       LEFT JOIN card_likes cl ON c.id = cl.card_id
       ${whereClause}
       GROUP BY c.id, p.id
       ORDER BY ${orderClause}`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener tarjetas' });
  }
});

// Crear tarjeta con soporte para múltiples tipos
router.post('/', authenticate, async (req, res) => {
  const { name, category, pet_id, card_type = 'simple', value1_name = null, value1_value = null, value2_name = null, value2_value = null } = req.body;
  if (!name || !category || !pet_id)
    return res.status(400).json({ error: 'Nombre, categoría y mascota requeridos' });

  try {
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO cards (id, name, category, created_by, card_type, value1_name, value1_value, value2_name, value2_value)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [id, name, category, pet_id, card_type, value1_name, value1_value, value2_name, value2_value]
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

// Dar "like" a una tarjeta
router.post('/:id/like', authenticate, async (req, res) => {
  const { pet_id } = req.body;
  if (!pet_id) return res.status(400).json({ error: 'pet_id requerido' });

  try {
    // Insertar like si no existe
    await pool.query(
      'INSERT INTO card_likes (card_id, pet_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.params.id, pet_id]
    );

    // Actualizar contador de likes en la tarjeta
    await pool.query(
      'UPDATE cards SET like_count = (SELECT COUNT(*) FROM card_likes WHERE card_id=$1) WHERE id=$1',
      [req.params.id]
    );

    const result = await pool.query('SELECT like_count FROM cards WHERE id=$1', [req.params.id]);
    res.json({ like_count: result.rows[0].like_count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al dar like' });
  }
});

// Remover "like" de una tarjeta
router.delete('/:id/like', authenticate, async (req, res) => {
  const { pet_id } = req.body;
  if (!pet_id) return res.status(400).json({ error: 'pet_id requerido' });

  try {
    // Eliminar like
    await pool.query(
      'DELETE FROM card_likes WHERE card_id=$1 AND pet_id=$2',
      [req.params.id, pet_id]
    );

    // Actualizar contador de likes en la tarjeta
    await pool.query(
      'UPDATE cards SET like_count = (SELECT COUNT(*) FROM card_likes WHERE card_id=$1) WHERE id=$1',
      [req.params.id]
    );

    const result = await pool.query('SELECT like_count FROM cards WHERE id=$1', [req.params.id]);
    res.json({ like_count: result.rows[0].like_count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al remover like' });
  }
});

export default router;
