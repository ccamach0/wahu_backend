import { Router } from 'express';
import pool from '../config/db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Ver mascotas disponibles en hidrante (excluye las del propio usuario)
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.id, p.name, p.username, p.avatar_url, p.level, p.breed, p.location,
              co.name as companion_name, co.username as companion_username,
              array_agg(c.name) FILTER (WHERE c.name IS NOT NULL) as tags
       FROM pets p
       JOIN companions co ON co.id = p.companion_id
       LEFT JOIN pet_cards pc ON p.id = pc.pet_id
       LEFT JOIN cards c ON pc.card_id = c.id
       WHERE p.hydrant_enabled = true AND p.companion_id != $1
       GROUP BY p.id, co.name, co.username
       ORDER BY p.popularity DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener hidrante' });
  }
});

// Habilitar/deshabilitar hidrante para una mascota
router.put('/:pet_id/toggle', authenticate, async (req, res) => {
  const { enabled } = req.body;
  try {
    await pool.query(
      'UPDATE pets SET hydrant_enabled=$1 WHERE id=$2',
      [enabled, req.params.pet_id]
    );
    res.json({ hydrant_enabled: enabled });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar hidrante' });
  }
});

export default router;
