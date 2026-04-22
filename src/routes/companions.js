import { Router } from 'express';
import pool from '../config/db.js';

const router = Router();

// Buscar compañeros (usuarios)
router.get('/', async (req, res) => {
  const { search = '', limit = 12, page = 1 } = req.query;
  const offset = (page - 1) * limit;
  try {
    const params = search ? [`%${search}%`, limit, offset] : [limit, offset];
    const where = search ? `WHERE c.name ILIKE $1 OR c.username ILIKE $1` : '';
    const result = await pool.query(
      `SELECT c.id, c.username, c.name, c.avatar_url,
              COUNT(p.id) as pet_count
       FROM companions c
       LEFT JOIN pets p ON p.companion_id = c.id
       ${where}
       GROUP BY c.id
       ORDER BY c.name ASC
       LIMIT $${search ? 2 : 1} OFFSET $${search ? 3 : 2}`,
      params
    );
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM companions c ${where}`,
      search ? [`%${search}%`] : []
    );
    res.json({
      companions: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      pages: Math.ceil(countResult.rows[0].count / limit),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener compañeros' });
  }
});

// Perfil de un compañero con sus mascotas
router.get('/:username', async (req, res) => {
  try {
    const comp = await pool.query(
      `SELECT c.id, c.username, c.name, c.avatar_url FROM companions c WHERE c.username=$1`,
      [req.params.username]
    );
    if (!comp.rows.length) return res.status(404).json({ error: 'Compañero no encontrado' });

    const pets = await pool.query(
      `SELECT id, name, username, avatar_url, level, species, breed FROM pets WHERE companion_id=$1 ORDER BY level DESC`,
      [comp.rows[0].id]
    );
    res.json({ ...comp.rows[0], pets: pets.rows });
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

export default router;
