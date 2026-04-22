import { Router } from 'express';
import pool from '../config/db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

const createNotification = async (companion_id, type, message, data = {}) => {
  await pool.query(
    `INSERT INTO notifications (companion_id, type, message, data) VALUES ($1,$2,$3,$4)`,
    [companion_id, type, message, JSON.stringify(data)]
  );
};

// Solicitudes enviadas por una mascota (pendientes)
router.get('/sent/:pet_id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT f.id as friendship_id, p.id, p.name, p.username, p.avatar_url, p.level,
              c.name as owner_name, c.username as owner_username, f.created_at
       FROM friendships f
       JOIN pets p ON f.friend_id = p.id
       JOIN companions c ON c.id = p.companion_id
       WHERE f.pet_id=$1 AND f.status='pending'
       ORDER BY f.created_at DESC`,
      [req.params.pet_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener solicitudes enviadas' });
  }
});

// Cancelar / rechazar solicitud (DELETE)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await pool.query(`DELETE FROM friendships WHERE id=$1 AND status='pending'`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al cancelar solicitud' });
  }
});

// Solicitudes pendientes para una mascota
router.get('/pending/:pet_id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT f.id as friendship_id, p.id, p.name, p.username, p.avatar_url, p.level, f.created_at
       FROM friendships f JOIN pets p ON f.pet_id = p.id
       WHERE f.friend_id=$1 AND f.status='pending'
       ORDER BY f.created_at DESC`,
      [req.params.pet_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener solicitudes' });
  }
});

// Manada y Jauría de una mascota
router.get('/:pet_id', authenticate, async (req, res) => {
  try {
    const manada = await pool.query(
      `SELECT p.id, p.name, p.username, p.avatar_url, p.level, f.manada_order
       FROM friendships f JOIN pets p ON f.friend_id = p.id
       WHERE f.pet_id=$1 AND f.is_manada=true AND f.status='accepted'
       ORDER BY f.manada_order`,
      [req.params.pet_id]
    );
    const jauria = await pool.query(
      `SELECT p.id, p.name, p.username, p.avatar_url, p.level
       FROM friendships f JOIN pets p ON f.friend_id = p.id
       WHERE f.pet_id=$1 AND f.status='accepted'
       ORDER BY p.name`,
      [req.params.pet_id]
    );
    res.json({ manada: manada.rows, jauria: jauria.rows });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener amigos' });
  }
});

// Enviar solicitud de amistad
router.post('/request', authenticate, async (req, res) => {
  const { pet_id, friend_id } = req.body;
  try {
    // Verificar que no exista ya
    const existing = await pool.query(
      `SELECT id, status FROM friendships WHERE (pet_id=$1 AND friend_id=$2) OR (pet_id=$2 AND friend_id=$1)`,
      [pet_id, friend_id]
    );
    if (existing.rows.length > 0) {
      const s = existing.rows[0].status;
      if (s === 'accepted') return res.status(409).json({ error: 'Ya son amigos' });
      if (s === 'pending') return res.status(409).json({ error: 'Solicitud ya enviada' });
    }

    const result = await pool.query(
      `INSERT INTO friendships (pet_id, friend_id, status) VALUES ($1,$2,'pending') RETURNING id`,
      [pet_id, friend_id]
    );

    // Notificar al dueño de la mascota receptora
    const pets = await pool.query(
      `SELECT p.name, p.username, p2.name as friend_name, p2.companion_id as friend_companion
       FROM pets p, pets p2 WHERE p.id=$1 AND p2.id=$2`,
      [pet_id, friend_id]
    );
    if (pets.rows.length > 0) {
      const { name, username, friend_name, friend_companion } = pets.rows[0];
      await createNotification(
        friend_companion,
        'friend_request',
        `${name} quiere ser amigo de ${friend_name}`,
        { friendship_id: result.rows[0].id, from_pet_id: pet_id, from_pet_name: name, from_pet_username: username, to_pet_id: friend_id }
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al enviar solicitud' });
  }
});

// Aceptar solicitud
router.put('/:id/accept', authenticate, async (req, res) => {
  try {
    const f = await pool.query(
      `UPDATE friendships SET status='accepted' WHERE id=$1 RETURNING *`,
      [req.params.id]
    );
    if (!f.rows.length) return res.status(404).json({ error: 'Solicitud no encontrada' });

    const { pet_id, friend_id } = f.rows[0];

    // Amistad recíproca
    await pool.query(
      `INSERT INTO friendships (pet_id, friend_id, status) VALUES ($1,$2,'accepted') ON CONFLICT DO NOTHING`,
      [friend_id, pet_id]
    );

    // Notificar al que envió la solicitud
    const pets = await pool.query(
      `SELECT p.name, p2.name as friend_name, p.companion_id as requester_companion
       FROM pets p, pets p2 WHERE p.id=$1 AND p2.id=$2`,
      [pet_id, friend_id]
    );
    if (pets.rows.length > 0) {
      const { name, friend_name, requester_companion } = pets.rows[0];
      await createNotification(
        requester_companion,
        'friend_accepted',
        `${friend_name} aceptó la solicitud de amistad de ${name}`,
        { pet_id, friend_id }
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al aceptar solicitud' });
  }
});

// Rechazar solicitud
router.put('/:id/reject', authenticate, async (req, res) => {
  try {
    await pool.query(
      `UPDATE friendships SET status='rejected' WHERE id=$1`,
      [req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al rechazar solicitud' });
  }
});

// Eliminar amistad (de jauría, ambas direcciones)
router.delete('/:pet_id/jauria/:friend_id', authenticate, async (req, res) => {
  const { pet_id, friend_id } = req.params;
  try {
    await pool.query(
      `DELETE FROM friendships WHERE (pet_id=$1 AND friend_id=$2) OR (pet_id=$2 AND friend_id=$1)`,
      [pet_id, friend_id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar amistad' });
  }
});

// Agregar a manada
router.post('/:pet_id/manada/:friend_id', authenticate, async (req, res) => {
  const { pet_id, friend_id } = req.params;
  try {
    const count = await pool.query(
      `SELECT COUNT(*) FROM friendships WHERE pet_id=$1 AND is_manada=true AND status='accepted'`,
      [pet_id]
    );
    if (parseInt(count.rows[0].count) >= 20)
      return res.status(400).json({ error: 'La manada ya tiene 20 miembros' });

    const maxOrder = await pool.query(
      `SELECT COALESCE(MAX(manada_order), 0) as max FROM friendships WHERE pet_id=$1 AND is_manada=true`,
      [pet_id]
    );
    const newOrder = parseInt(maxOrder.rows[0].max) + 1;

    await pool.query(
      `UPDATE friendships SET is_manada=true, manada_order=$1 WHERE pet_id=$2 AND friend_id=$3 AND status='accepted'`,
      [newOrder, pet_id, friend_id]
    );
    res.json({ success: true, order: newOrder });
  } catch (err) {
    res.status(500).json({ error: 'Error al agregar a manada' });
  }
});

// Quitar de manada
router.delete('/:pet_id/manada/:friend_id', authenticate, async (req, res) => {
  const { pet_id, friend_id } = req.params;
  try {
    await pool.query(
      `UPDATE friendships SET is_manada=false, manada_order=NULL WHERE pet_id=$1 AND friend_id=$2`,
      [pet_id, friend_id]
    );
    // Reordenar los restantes
    await pool.query(
      `WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY manada_order) as new_order
        FROM friendships WHERE pet_id=$1 AND is_manada=true AND status='accepted'
      )
      UPDATE friendships SET manada_order=ranked.new_order FROM ranked WHERE friendships.id=ranked.id`,
      [pet_id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al quitar de manada' });
  }
});

// Reordenar manada (recibe array de IDs en el nuevo orden)
router.put('/:pet_id/manada/reorder', authenticate, async (req, res) => {
  const { pet_id } = req.params;
  const { ids } = req.body; // array de friend_ids en orden
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids requerido' });
  try {
    await Promise.all(
      ids.map((friend_id, idx) =>
        pool.query(
          `UPDATE friendships SET manada_order=$1 WHERE pet_id=$2 AND friend_id=$3`,
          [idx + 1, pet_id, friend_id]
        )
      )
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al reordenar manada' });
  }
});

export default router;
