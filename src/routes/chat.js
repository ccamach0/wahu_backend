import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

const getUserPetIds = async (userId) => {
  const r = await pool.query('SELECT id FROM pets WHERE companion_id=$1', [userId]);
  return r.rows.map(p => p.id);
};

const getActivePetId = async (userId) => {
  const comp = await pool.query('SELECT active_pet_id FROM companions WHERE id=$1', [userId]);
  let petId = comp.rows[0]?.active_pet_id;
  if (!petId) {
    const first = await pool.query(
      'SELECT id FROM pets WHERE companion_id=$1 ORDER BY created_at ASC LIMIT 1',
      [userId]
    );
    petId = first.rows[0]?.id || null;
  }
  return petId;
};

// Listar conversaciones de la mascota activa únicamente
router.get('/conversations', authenticate, async (req, res) => {
  try {
    const myPetId = req.query.petId || await getActivePetId(req.user.id);
    if (!myPetId) return res.json([]);

    // Verificar que el petId pertenece al usuario si fue pasado por query
    if (req.query.petId) {
      const petIds = await getUserPetIds(req.user.id);
      if (!petIds.includes(req.query.petId)) return res.status(403).json({ error: 'Sin acceso' });
    }

    const result = await pool.query(`
      SELECT
        cv.id,
        cv.last_message_at,
        cv.created_at,
        $1::uuid AS my_pet_id,
        CASE WHEN cv.pet1_id = $1::uuid THEN cv.pet2_id ELSE cv.pet1_id END AS other_id,
        op.name AS other_name,
        op.avatar_url AS other_avatar,
        op.username AS other_username,
        lm.content AS last_message,
        (
          SELECT COUNT(*) FROM messages msg
          WHERE msg.conversation_id = cv.id
            AND msg.sender_pet_id != $1::uuid
            AND msg.read = false
        ) AS unread_count
      FROM conversations cv
      JOIN pets op ON op.id = CASE WHEN cv.pet1_id = $1::uuid THEN cv.pet2_id ELSE cv.pet1_id END
      LEFT JOIN messages lm ON lm.id = (
        SELECT id FROM messages WHERE conversation_id = cv.id ORDER BY created_at DESC LIMIT 1
      )
      WHERE cv.pet1_id = $1::uuid OR cv.pet2_id = $1::uuid
      ORDER BY COALESCE(cv.last_message_at, cv.created_at) DESC
    `, [myPetId]);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener conversaciones' });
  }
});

// Iniciar o recuperar conversación entre mascotas
router.post('/conversations', authenticate, async (req, res) => {
  const { pet_id: otherPetId } = req.body;
  if (!otherPetId) return res.status(400).json({ error: 'pet_id requerido' });

  try {
    const myPetId = await getActivePetId(req.user.id);
    if (!myPetId) return res.status(400).json({ error: 'No tienes mascotas para chatear' });
    if (myPetId === otherPetId) return res.status(400).json({ error: 'No puedes chatear contigo mismo' });

    const otherPet = await pool.query('SELECT id FROM pets WHERE id=$1', [otherPetId]);
    if (!otherPet.rows.length) return res.status(404).json({ error: 'Mascota no encontrada' });

    const existing = await pool.query(`
      SELECT id FROM conversations
      WHERE (pet1_id=$1 AND pet2_id=$2) OR (pet1_id=$2 AND pet2_id=$1)
    `, [myPetId, otherPetId]);

    if (existing.rows.length > 0) return res.json({ id: existing.rows[0].id });

    const id = uuidv4();
    await pool.query(
      `INSERT INTO conversations (id, pet1_id, pet2_id) VALUES ($1,$2,$3)`,
      [id, myPetId, otherPetId]
    );
    res.json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear conversación' });
  }
});

// Obtener mensajes de una conversación
router.get('/conversations/:id/messages', authenticate, async (req, res) => {
  const { since } = req.query;
  try {
    const petIds = await getUserPetIds(req.user.id);
    const cv = await pool.query(
      `SELECT id FROM conversations WHERE id=$1 AND (pet1_id=ANY($2::uuid[]) OR pet2_id=ANY($2::uuid[]))`,
      [req.params.id, petIds]
    );
    if (!cv.rows.length) return res.status(403).json({ error: 'Sin acceso' });

    const params = [req.params.id];
    let sinceClause = '';
    if (since) { params.push(since); sinceClause = `AND m.created_at > $${params.length}`; }

    const result = await pool.query(`
      SELECT
        m.id, m.content, m.sender_pet_id AS sender_id, m.read, m.created_at, m.sent_as_owner,
        CASE WHEN m.sent_as_owner THEN c.name    ELSE p.name        END AS sender_name,
        CASE WHEN m.sent_as_owner THEN c.avatar_url ELSE p.avatar_url END AS sender_avatar,
        CASE WHEN m.sent_as_owner THEN c.username ELSE p.username   END AS sender_username,
        CASE WHEN m.sent_as_owner THEN NULL       ELSE c.name        END AS sender_owner_name,
        CASE WHEN m.sent_as_owner THEN NULL       ELSE c.username    END AS sender_owner_username
      FROM messages m
      JOIN pets p ON p.id = m.sender_pet_id
      JOIN companions c ON c.id = p.companion_id
      WHERE m.conversation_id=$1 ${sinceClause}
      ORDER BY m.created_at ASC
      LIMIT 100
    `, params);

    // Marcar como leídos los mensajes de la otra mascota
    await pool.query(
      `UPDATE messages SET read=true WHERE conversation_id=$1 AND sender_pet_id != ALL($2::uuid[]) AND read=false`,
      [req.params.id, petIds]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener mensajes' });
  }
});

// Enviar mensaje
router.post('/conversations/:id/messages', authenticate, async (req, res) => {
  const { content, sent_as_owner = false } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Mensaje vacío' });

  try {
    const petIds = await getUserPetIds(req.user.id);
    const cv = await pool.query(
      `SELECT id, pet1_id, pet2_id FROM conversations WHERE id=$1 AND (pet1_id=ANY($2::uuid[]) OR pet2_id=ANY($2::uuid[]))`,
      [req.params.id, petIds]
    );
    if (!cv.rows.length) return res.status(403).json({ error: 'Sin acceso' });

    // El sender es el pet de esta conversación que pertenece al usuario (no simplemente el activo)
    const { pet1_id, pet2_id } = cv.rows[0];
    const senderPetId = petIds.includes(pet1_id) ? pet1_id : pet2_id;
    if (!senderPetId) return res.status(400).json({ error: 'Sin mascota en esta conversación' });

    const id = uuidv4();
    await pool.query(
      `INSERT INTO messages (id, conversation_id, sender_pet_id, content, sent_as_owner) VALUES ($1,$2,$3,$4,$5)`,
      [id, req.params.id, senderPetId, content.trim(), sent_as_owner]
    );
    await pool.query(`UPDATE conversations SET last_message_at=NOW() WHERE id=$1`, [req.params.id]);

    const msg = await pool.query(`
      SELECT
        m.id, m.content, m.sender_pet_id AS sender_id, m.read, m.created_at, m.sent_as_owner,
        CASE WHEN m.sent_as_owner THEN c.name    ELSE p.name        END AS sender_name,
        CASE WHEN m.sent_as_owner THEN c.avatar_url ELSE p.avatar_url END AS sender_avatar,
        CASE WHEN m.sent_as_owner THEN c.username ELSE p.username   END AS sender_username,
        CASE WHEN m.sent_as_owner THEN NULL       ELSE c.name        END AS sender_owner_name,
        CASE WHEN m.sent_as_owner THEN NULL       ELSE c.username    END AS sender_owner_username
      FROM messages m
      JOIN pets p ON p.id = m.sender_pet_id
      JOIN companions c ON c.id = p.companion_id
      WHERE m.id=$1
    `, [id]);

    res.json(msg.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al enviar mensaje' });
  }
});

// Eliminar conversación
router.delete('/conversations/:id', authenticate, async (req, res) => {
  try {
    const petIds = await getUserPetIds(req.user.id);
    const cv = await pool.query(
      `SELECT id FROM conversations WHERE id=$1 AND (pet1_id=ANY($2::uuid[]) OR pet2_id=ANY($2::uuid[]))`,
      [req.params.id, petIds]
    );
    if (!cv.rows.length) return res.status(403).json({ error: 'Sin acceso' });
    await pool.query(`DELETE FROM conversations WHERE id=$1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar conversación' });
  }
});

// Contar mensajes no leídos
router.get('/unread', authenticate, async (req, res) => {
  try {
    const petIds = await getUserPetIds(req.user.id);
    if (petIds.length === 0) return res.json({ count: 0 });
    const result = await pool.query(`
      SELECT COUNT(*) FROM messages m
      JOIN conversations cv ON cv.id = m.conversation_id
      WHERE (cv.pet1_id = ANY($1::uuid[]) OR cv.pet2_id = ANY($1::uuid[]))
        AND m.sender_pet_id != ALL($1::uuid[])
        AND m.read = false
    `, [petIds]);
    res.json({ count: parseInt(result.rows[0].count) });
  } catch {
    res.json({ count: 0 });
  }
});

export default router;
