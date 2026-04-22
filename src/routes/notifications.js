import { Router } from 'express';
import pool from '../config/db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Obtener notificaciones del usuario autenticado
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM notifications WHERE companion_id=$1 ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
});

// Cantidad de no leídas
router.get('/unread-count', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) FROM notifications WHERE companion_id=$1 AND read=false`,
      [req.user.id]
    );
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

// Marcar una como leída
router.put('/:id/read', authenticate, async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications SET read=true WHERE id=$1 AND companion_id=$2`,
      [req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

// Marcar todas como leídas
router.put('/read-all', authenticate, async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications SET read=true WHERE companion_id=$1`,
      [req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

export default router;
