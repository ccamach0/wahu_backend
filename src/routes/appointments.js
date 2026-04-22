import express from 'express';
import pool from '../config/db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// GET /api/appointments/:petId — citas del pet (como solicitante o invitado)
router.get('/:petId', authenticate, async (req, res) => {
  const { petId } = req.params;
  const { status } = req.query;
  try {
    let q = `
      SELECT a.*,
        p1.name AS requester_name, p1.avatar_url AS requester_avatar, p1.username AS requester_username,
        p2.name AS invited_name, p2.avatar_url AS invited_avatar, p2.username AS invited_username
      FROM appointments a
      JOIN pets p1 ON p1.id = a.requester_pet_id
      JOIN pets p2 ON p2.id = a.invited_pet_id
      WHERE (a.requester_pet_id = $1 OR a.invited_pet_id = $1)
    `;
    const params = [petId];
    if (status) {
      q += ` AND a.status = $2`;
      params.push(status);
    }
    q += ` ORDER BY a.scheduled_at ASC`;
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/appointments — crear cita
router.post('/', authenticate, async (req, res) => {
  const { requester_pet_id, invited_pet_id, type, scheduled_at, location, notes } = req.body;
  if (!requester_pet_id || !invited_pet_id || !type || !scheduled_at) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO appointments (requester_pet_id, invited_pet_id, type, scheduled_at, location, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [requester_pet_id, invited_pet_id, type, scheduled_at, location || null, notes || null]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/appointments/:id — actualizar status (confirmed / cancelled)
router.put('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!['confirmed', 'cancelled', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE appointments SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Cita no encontrada' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/appointments/:id — eliminar cita
router.delete('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(`DELETE FROM appointments WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
