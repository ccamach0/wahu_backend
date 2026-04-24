import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { uploadSingle, processImage } from '../middleware/imageUpload.js';
import { uploadToCloudinary } from '../services/cloudinary.js';
import { checkClanMemberRole, isClanAtMaxMembers, getActivePet, canDeleteClanContent, getAuthorInfo } from '../services/clanService.js';

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

    let userPendingRequest = null;
    // Check if authenticated user has pending request
    if (req.user) {
      const activePet = await getActivePet(pool, req.user.id);
      if (activePet) {
        const requestCheck = await pool.query(
          `SELECT id, status FROM clan_join_requests
           WHERE clan_id=$1 AND pet_id=$2 AND status='pending'`,
          [req.params.id, activePet]
        );
        if (requestCheck.rows.length > 0) {
          userPendingRequest = requestCheck.rows[0].id;
        }
      }
    }

    res.json({
      ...clan.rows[0],
      members: members.rows,
      userPendingRequest
    });
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
// Solicitar acceso al clan (en lugar de unirse directamente)
router.post('/:id/join', authenticate, async (req, res) => {
  const { pet_id } = req.body;
  try {
    // Check if clan exists
    const clanResult = await pool.query(
      'SELECT id, member_count FROM clans WHERE id = $1',
      [req.params.id]
    );
    if (!clanResult.rows.length) {
      return res.status(404).json({ error: 'Clan no encontrado' });
    }

    // Check if at max members
    if (clanResult.rows[0].member_count >= 100) {
      return res.status(400).json({ error: 'El clan ha alcanzado el máximo de 100 miembros' });
    }

    // Check if already a member
    const memberResult = await pool.query(
      'SELECT id FROM clan_members WHERE clan_id = $1 AND pet_id = $2',
      [req.params.id, pet_id]
    );
    if (memberResult.rows.length > 0) {
      return res.status(400).json({ error: 'Ya eres miembro del clan' });
    }

    // Check if request already exists
    const requestResult = await pool.query(
      'SELECT id, status FROM clan_join_requests WHERE clan_id = $1 AND pet_id = $2',
      [req.params.id, pet_id]
    );
    if (requestResult.rows.length > 0) {
      if (requestResult.rows[0].status === 'pending') {
        return res.status(400).json({ error: 'Ya tienes una solicitud pendiente' });
      }
    }

    // Create join request
    await pool.query(
      'INSERT INTO clan_join_requests (clan_id, pet_id, status) VALUES ($1, $2, $3)',
      [req.params.id, pet_id, 'pending']
    );
    res.json({ success: true, message: 'Solicitud de acceso enviada' });
  } catch (err) {
    console.error('Error al solicitar acceso al clan:', err);
    res.status(500).json({ error: 'Error al solicitar acceso' });
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

// Cambiar rol de miembro (admin only)
router.put('/:clan_id/members/:pet_id/role', authenticate, async (req, res) => {
  const { role } = req.body;
  const { clan_id, pet_id } = req.params;

  // Validate role
  if (!['admin', 'moderator', 'member'].includes(role)) {
    return res.status(400).json({ error: 'Rol inválido' });
  }

  try {
    // Get active pet of current user
    const activePet = await getActivePet(pool, req.user.id);
    if (!activePet) {
      return res.status(400).json({ error: 'No tienes mascotas' });
    }

    // Check if current user is admin of the clan
    const { isMember, role: userRole } = await checkClanMemberRole(pool, clan_id, activePet);
    if (!isMember || userRole !== 'admin') {
      return res.status(403).json({ error: 'No tienes permisos para cambiar roles' });
    }

    // Can't demote the only admin
    if (role !== 'admin') {
      const adminCount = await pool.query(
        'SELECT COUNT(*) as count FROM clan_members WHERE clan_id = $1 AND role = $2',
        [clan_id, 'admin']
      );
      if (adminCount.rows[0].count === 1) {
        const targetMember = await pool.query(
          'SELECT role FROM clan_members WHERE clan_id = $1 AND pet_id = $2',
          [clan_id, pet_id]
        );
        if (targetMember.rows[0]?.role === 'admin') {
          return res.status(400).json({ error: 'No puedes dejar el clan sin administrador' });
        }
      }
    }

    // Update role
    await pool.query(
      'UPDATE clan_members SET role = $1 WHERE clan_id = $2 AND pet_id = $3',
      [role, clan_id, pet_id]
    );

    res.json({ success: true, message: `Rol actualizado a ${role}` });
  } catch (err) {
    console.error('Error al cambiar rol:', err);
    res.status(500).json({ error: 'Error al cambiar rol' });
  }
});

// Eliminar miembro del clan (admin only)
router.delete('/:clan_id/members/:pet_id', authenticate, async (req, res) => {
  const { clan_id, pet_id } = req.params;

  try {
    // Get active pet of current user
    const activePet = await getActivePet(pool, req.user.id);
    if (!activePet) {
      return res.status(400).json({ error: 'No tienes mascotas' });
    }

    // Check if current user is admin of the clan
    const { isMember, role: userRole } = await checkClanMemberRole(pool, clan_id, activePet);
    if (!isMember || userRole !== 'admin') {
      return res.status(403).json({ error: 'No tienes permisos para eliminar miembros' });
    }

    // Can't remove the last admin
    if (pet_id === activePet) {
      const adminCount = await pool.query(
        'SELECT COUNT(*) as count FROM clan_members WHERE clan_id = $1 AND role = $2',
        [clan_id, 'admin']
      );
      if (adminCount.rows[0].count === 1) {
        return res.status(400).json({ error: 'El clan debe tener al menos un administrador' });
      }
    }

    // Remove member
    await pool.query(
      'DELETE FROM clan_members WHERE clan_id = $1 AND pet_id = $2',
      [clan_id, pet_id]
    );

    res.json({ success: true, message: 'Miembro eliminado del clan' });
  } catch (err) {
    console.error('Error al eliminar miembro:', err);
    res.status(500).json({ error: 'Error al eliminar miembro' });
  }
});

// Salir del clan
router.post('/:clan_id/leave', authenticate, async (req, res) => {
  const { clan_id } = req.params;

  try {
    // Get active pet of current user
    const activePet = await getActivePet(pool, req.user.id);
    if (!activePet) {
      return res.status(400).json({ error: 'No tienes mascotas' });
    }

    // Check if member
    const { isMember } = await checkClanMemberRole(pool, clan_id, activePet);
    if (!isMember) {
      return res.status(400).json({ error: 'No eres miembro del clan' });
    }

    // Check if admin (fundador) - can't leave, must delete clan instead
    const { role: userRole } = await checkClanMemberRole(pool, clan_id, activePet);
    if (userRole === 'admin') {
      return res.status(400).json({ error: 'Como fundador, no puedes salir del clan. Puedes eliminarlo en su lugar.' });
    }

    // Leave clan
    await pool.query(
      'DELETE FROM clan_members WHERE clan_id = $1 AND pet_id = $2',
      [clan_id, activePet]
    );

    res.json({ success: true, message: 'Has salido del clan' });
  } catch (err) {
    console.error('Error al salir del clan:', err);
    res.status(500).json({ error: 'Error al salir del clan' });
  }
});

// ========== CLAN POSTS ==========

// Crear publicación en clan
router.post('/:clan_id/posts', authenticate, async (req, res) => {
  const { content, sent_as_owner = false } = req.body;
  const { clan_id } = req.params;

  if (!content?.trim()) {
    return res.status(400).json({ error: 'El contenido es requerido' });
  }

  try {
    // Get active pet
    const activePet = await getActivePet(pool, req.user.id);
    if (!activePet) {
      return res.status(400).json({ error: 'No tienes mascotas' });
    }

    // Check if member of clan
    const { isMember } = await checkClanMemberRole(pool, clan_id, activePet);
    if (!isMember) {
      return res.status(403).json({ error: 'No eres miembro del clan' });
    }

    // Create post
    const postId = uuidv4();
    await pool.query(
      `INSERT INTO clan_posts (id, clan_id, author_pet_id, content, sent_as_owner)
       VALUES ($1, $2, $3, $4, $5)`,
      [postId, clan_id, activePet, content, sent_as_owner === true]
    );

    // Get post with author info
    const authorInfo = await getAuthorInfo(pool, activePet, sent_as_owner);
    const postData = await pool.query(
      'SELECT * FROM clan_posts WHERE id = $1',
      [postId]
    );

    res.status(201).json({
      ...postData.rows[0],
      author_name: authorInfo?.author_name,
      author_avatar: authorInfo?.author_avatar,
      author_username: authorInfo?.author_username,
      author_owner_name: authorInfo?.author_owner_name,
      author_owner_username: authorInfo?.author_owner_username,
    });
  } catch (err) {
    console.error('Error al crear publicación:', err);
    res.status(500).json({ error: 'Error al crear publicación' });
  }
});

// Listar publicaciones del clan
router.get('/:clan_id/posts', authenticate, async (req, res) => {
  const { clan_id } = req.params;
  const { limit = 20, offset = 0 } = req.query;

  try {
    // Get active pet
    const activePet = await getActivePet(pool, req.user.id);
    if (!activePet) {
      return res.status(400).json({ error: 'No tienes mascotas' });
    }

    // Check if member
    const { isMember } = await checkClanMemberRole(pool, clan_id, activePet);
    if (!isMember) {
      return res.status(403).json({ error: 'No eres miembro del clan' });
    }

    const posts = await pool.query(
      `SELECT cp.*,
        CASE WHEN cp.sent_as_owner THEN c.name ELSE p.name END AS author_name,
        CASE WHEN cp.sent_as_owner THEN c.avatar_url ELSE p.avatar_url END AS author_avatar,
        CASE WHEN cp.sent_as_owner THEN c.username ELSE p.username END AS author_username,
        CASE WHEN cp.sent_as_owner THEN NULL ELSE c.name END AS author_owner_name,
        CASE WHEN cp.sent_as_owner THEN NULL ELSE c.username END AS author_owner_username
       FROM clan_posts cp
       JOIN pets p ON cp.author_pet_id = p.id
       JOIN companions c ON c.id = p.companion_id
       WHERE cp.clan_id = $1
       ORDER BY cp.created_at DESC
       LIMIT $2 OFFSET $3`,
      [clan_id, parseInt(limit), parseInt(offset)]
    );

    res.json(posts.rows);
  } catch (err) {
    console.error('Error al obtener publicaciones:', err);
    res.status(500).json({ error: 'Error al obtener publicaciones' });
  }
});

// Eliminar publicación del clan
router.delete('/:clan_id/posts/:post_id', authenticate, async (req, res) => {
  const { clan_id, post_id } = req.params;

  try {
    // Get active pet
    const activePet = await getActivePet(pool, req.user.id);
    if (!activePet) {
      return res.status(400).json({ error: 'No tienes mascotas' });
    }

    // Get post
    const postResult = await pool.query(
      'SELECT author_pet_id FROM clan_posts WHERE id = $1 AND clan_id = $2',
      [post_id, clan_id]
    );

    if (!postResult.rows.length) {
      return res.status(404).json({ error: 'Publicación no encontrada' });
    }

    // Check permissions
    const canDelete = await canDeleteClanContent(pool, clan_id, postResult.rows[0].author_pet_id, activePet);
    if (!canDelete) {
      return res.status(403).json({ error: 'No tienes permisos para eliminar esta publicación' });
    }

    await pool.query(
      'DELETE FROM clan_posts WHERE id = $1',
      [post_id]
    );

    res.json({ success: true, message: 'Publicación eliminada' });
  } catch (err) {
    console.error('Error al eliminar publicación:', err);
    res.status(500).json({ error: 'Error al eliminar publicación' });
  }
});

// ========== CLAN COMMENTS ==========

// Crear comentario en publicación del clan
router.post('/:clan_id/posts/:post_id/comments', authenticate, async (req, res) => {
  const { content, sent_as_owner = false } = req.body;
  const { clan_id, post_id } = req.params;

  if (!content?.trim()) {
    return res.status(400).json({ error: 'El comentario es requerido' });
  }

  try {
    // Get active pet
    const activePet = await getActivePet(pool, req.user.id);
    if (!activePet) {
      return res.status(400).json({ error: 'No tienes mascotas' });
    }

    // Check if member
    const { isMember } = await checkClanMemberRole(pool, clan_id, activePet);
    if (!isMember) {
      return res.status(403).json({ error: 'No eres miembro del clan' });
    }

    // Check if post exists
    const postResult = await pool.query(
      'SELECT id FROM clan_posts WHERE id = $1 AND clan_id = $2',
      [post_id, clan_id]
    );

    if (!postResult.rows.length) {
      return res.status(404).json({ error: 'Publicación no encontrada' });
    }

    // Create comment
    const commentId = uuidv4();
    await pool.query(
      `INSERT INTO clan_post_comments (id, post_id, author_pet_id, content, sent_as_owner)
       VALUES ($1, $2, $3, $4, $5)`,
      [commentId, post_id, activePet, content, sent_as_owner === true]
    );

    // Get comment with author info
    const authorInfo = await getAuthorInfo(pool, activePet, sent_as_owner);
    const commentData = await pool.query(
      'SELECT * FROM clan_post_comments WHERE id = $1',
      [commentId]
    );

    res.status(201).json({
      ...commentData.rows[0],
      author_name: authorInfo?.author_name,
      author_avatar: authorInfo?.author_avatar,
      author_username: authorInfo?.author_username,
      author_owner_name: authorInfo?.author_owner_name,
      author_owner_username: authorInfo?.author_owner_username,
    });
  } catch (err) {
    console.error('Error al crear comentario:', err);
    res.status(500).json({ error: 'Error al crear comentario' });
  }
});

// Listar comentarios de publicación
router.get('/:clan_id/posts/:post_id/comments', authenticate, async (req, res) => {
  const { clan_id, post_id } = req.params;
  const { limit = 50, offset = 0 } = req.query;

  try {
    // Get active pet
    const activePet = await getActivePet(pool, req.user.id);
    if (!activePet) {
      return res.status(400).json({ error: 'No tienes mascotas' });
    }

    // Check if member
    const { isMember } = await checkClanMemberRole(pool, clan_id, activePet);
    if (!isMember) {
      return res.status(403).json({ error: 'No eres miembro del clan' });
    }

    const comments = await pool.query(
      `SELECT cpc.*,
        CASE WHEN cpc.sent_as_owner THEN c.name ELSE p.name END AS author_name,
        CASE WHEN cpc.sent_as_owner THEN c.avatar_url ELSE p.avatar_url END AS author_avatar,
        CASE WHEN cpc.sent_as_owner THEN c.username ELSE p.username END AS author_username,
        CASE WHEN cpc.sent_as_owner THEN NULL ELSE c.name END AS author_owner_name,
        CASE WHEN cpc.sent_as_owner THEN NULL ELSE c.username END AS author_owner_username
       FROM clan_post_comments cpc
       JOIN pets p ON cpc.author_pet_id = p.id
       JOIN companions c ON c.id = p.companion_id
       WHERE cpc.post_id = $1
       ORDER BY cpc.created_at ASC
       LIMIT $2 OFFSET $3`,
      [post_id, parseInt(limit), parseInt(offset)]
    );

    res.json(comments.rows);
  } catch (err) {
    console.error('Error al obtener comentarios:', err);
    res.status(500).json({ error: 'Error al obtener comentarios' });
  }
});

// Eliminar comentario
router.delete('/:clan_id/posts/:post_id/comments/:comment_id', authenticate, async (req, res) => {
  const { clan_id, post_id, comment_id } = req.params;

  try {
    // Get active pet
    const activePet = await getActivePet(pool, req.user.id);
    if (!activePet) {
      return res.status(400).json({ error: 'No tienes mascotas' });
    }

    // Get comment
    const commentResult = await pool.query(
      'SELECT author_pet_id FROM clan_post_comments WHERE id = $1 AND post_id = $2',
      [comment_id, post_id]
    );

    if (!commentResult.rows.length) {
      return res.status(404).json({ error: 'Comentario no encontrado' });
    }

    // Check permissions
    const canDelete = await canDeleteClanContent(pool, clan_id, commentResult.rows[0].author_pet_id, activePet);
    if (!canDelete) {
      return res.status(403).json({ error: 'No tienes permisos para eliminar este comentario' });
    }

    await pool.query(
      'DELETE FROM clan_post_comments WHERE id = $1',
      [comment_id]
    );

    res.json({ success: true, message: 'Comentario eliminado' });
  } catch (err) {
    console.error('Error al eliminar comentario:', err);
    res.status(500).json({ error: 'Error al eliminar comentario' });
  }
});

// ========== CLAN GALLERY ==========

// Subir imagen a galería del clan
router.post('/:clan_id/gallery', authenticate, uploadSingle, processImage, async (req, res) => {
  const { clan_id } = req.params;

  if (!req.file) {
    return res.status(400).json({ error: 'No se cargó archivo' });
  }

  try {
    // Get active pet
    const activePet = await getActivePet(pool, req.user.id);
    if (!activePet) {
      return res.status(400).json({ error: 'No tienes mascotas' });
    }

    // Check if member of clan
    const { isMember } = await checkClanMemberRole(pool, clan_id, activePet);
    if (!isMember) {
      return res.status(403).json({ error: 'No eres miembro del clan' });
    }

    // Upload to Cloudinary
    const image_url = await uploadToCloudinary(
      req.file.buffer,
      req.file.originalname,
      `clans/${clan_id}`
    );

    // Save to database
    const imageId = uuidv4();
    await pool.query(
      `INSERT INTO clan_gallery (id, clan_id, image_url, uploaded_by)
       VALUES ($1, $2, $3, $4)`,
      [imageId, clan_id, image_url, activePet]
    );

    const result = await pool.query(
      'SELECT id, image_url, uploaded_by, created_at FROM clan_gallery WHERE id = $1',
      [imageId]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error al subir imagen:', err);
    res.status(500).json({ error: 'Error al subir imagen' });
  }
});

// Obtener galería del clan
router.get('/:clan_id/gallery', authenticate, async (req, res) => {
  const { clan_id } = req.params;
  const { limit = 20, offset = 0 } = req.query;

  try {
    // Get active pet
    const activePet = await getActivePet(pool, req.user.id);
    if (!activePet) {
      return res.status(400).json({ error: 'No tienes mascotas' });
    }

    // Check if member
    const { isMember } = await checkClanMemberRole(pool, clan_id, activePet);
    if (!isMember) {
      return res.status(403).json({ error: 'No eres miembro del clan' });
    }

    const [images, total] = await Promise.all([
      pool.query(
        `SELECT cg.id, cg.image_url, cg.uploaded_by, p.name as uploader_name, p.username as uploader_username, cg.created_at
         FROM clan_gallery cg
         JOIN pets p ON cg.uploaded_by = p.id
         WHERE cg.clan_id = $1
         ORDER BY cg.created_at DESC
         LIMIT $2 OFFSET $3`,
        [clan_id, parseInt(limit), parseInt(offset)]
      ),
      pool.query('SELECT COUNT(*) FROM clan_gallery WHERE clan_id = $1', [clan_id]),
    ]);

    res.json({
      images: images.rows,
      total: parseInt(total.rows[0].count),
    });
  } catch (err) {
    console.error('Error al obtener galería:', err);
    res.status(500).json({ error: 'Error al obtener galería' });
  }
});

// Eliminar imagen de galería del clan
router.delete('/:clan_id/gallery/:image_id', authenticate, async (req, res) => {
  const { clan_id, image_id } = req.params;

  try {
    // Get active pet
    const activePet = await getActivePet(pool, req.user.id);
    if (!activePet) {
      return res.status(400).json({ error: 'No tienes mascotas' });
    }

    // Get image
    const imageResult = await pool.query(
      'SELECT uploaded_by FROM clan_gallery WHERE id = $1 AND clan_id = $2',
      [image_id, clan_id]
    );

    if (!imageResult.rows.length) {
      return res.status(404).json({ error: 'Imagen no encontrada' });
    }

    // Check permissions
    const canDelete = await canDeleteClanContent(pool, clan_id, imageResult.rows[0].uploaded_by, activePet);
    if (!canDelete) {
      return res.status(403).json({ error: 'No tienes permisos para eliminar esta imagen' });
    }

    await pool.query(
      'DELETE FROM clan_gallery WHERE id = $1',
      [image_id]
    );

    res.json({ success: true, message: 'Imagen eliminada' });
  } catch (err) {
    console.error('Error al eliminar imagen:', err);
    res.status(500).json({ error: 'Error al eliminar imagen' });
  }
});

// Comentar en imagen de galería
router.post('/:clan_id/gallery/:image_id/comments', authenticate, async (req, res) => {
  const { content, sent_as_owner = false } = req.body;
  const { clan_id, image_id } = req.params;

  if (!content?.trim()) {
    return res.status(400).json({ error: 'El comentario es requerido' });
  }

  try {
    // Get active pet
    const activePet = await getActivePet(pool, req.user.id);
    if (!activePet) {
      return res.status(400).json({ error: 'No tienes mascotas' });
    }

    // Check if member
    const { isMember } = await checkClanMemberRole(pool, clan_id, activePet);
    if (!isMember) {
      return res.status(403).json({ error: 'No eres miembro del clan' });
    }

    // Check if image exists
    const imageResult = await pool.query(
      'SELECT id FROM clan_gallery WHERE id = $1 AND clan_id = $2',
      [image_id, clan_id]
    );

    if (!imageResult.rows.length) {
      return res.status(404).json({ error: 'Imagen no encontrada' });
    }

    // Create comment
    const commentId = uuidv4();
    await pool.query(
      `INSERT INTO clan_gallery_comments (id, gallery_image_id, author_pet_id, content, sent_as_owner)
       VALUES ($1, $2, $3, $4, $5)`,
      [commentId, image_id, activePet, content, sent_as_owner === true]
    );

    // Get comment with author info
    const authorInfo = await getAuthorInfo(pool, activePet, sent_as_owner);
    const commentData = await pool.query(
      'SELECT * FROM clan_gallery_comments WHERE id = $1',
      [commentId]
    );

    res.status(201).json({
      ...commentData.rows[0],
      author_name: authorInfo?.author_name,
      author_avatar: authorInfo?.author_avatar,
      author_username: authorInfo?.author_username,
      author_owner_name: authorInfo?.author_owner_name,
      author_owner_username: authorInfo?.author_owner_username,
    });
  } catch (err) {
    console.error('Error al crear comentario:', err);
    res.status(500).json({ error: 'Error al crear comentario' });
  }
});

// Obtener comentarios de imagen
router.get('/:clan_id/gallery/:image_id/comments', authenticate, async (req, res) => {
  const { clan_id, image_id } = req.params;
  const { limit = 50, offset = 0 } = req.query;

  try {
    // Get active pet
    const activePet = await getActivePet(pool, req.user.id);
    if (!activePet) {
      return res.status(400).json({ error: 'No tienes mascotas' });
    }

    // Check if member
    const { isMember } = await checkClanMemberRole(pool, clan_id, activePet);
    if (!isMember) {
      return res.status(403).json({ error: 'No eres miembro del clan' });
    }

    const comments = await pool.query(
      `SELECT cgc.*,
        CASE WHEN cgc.sent_as_owner THEN c.name ELSE p.name END AS author_name,
        CASE WHEN cgc.sent_as_owner THEN c.avatar_url ELSE p.avatar_url END AS author_avatar,
        CASE WHEN cgc.sent_as_owner THEN c.username ELSE p.username END AS author_username,
        CASE WHEN cgc.sent_as_owner THEN NULL ELSE c.name END AS author_owner_name,
        CASE WHEN cgc.sent_as_owner THEN NULL ELSE c.username END AS author_owner_username
       FROM clan_gallery_comments cgc
       JOIN pets p ON cgc.author_pet_id = p.id
       JOIN companions c ON c.id = p.companion_id
       WHERE cgc.gallery_image_id = $1
       ORDER BY cgc.created_at ASC
       LIMIT $2 OFFSET $3`,
      [image_id, parseInt(limit), parseInt(offset)]
    );

    res.json(comments.rows);
  } catch (err) {
    console.error('Error al obtener comentarios:', err);
    res.status(500).json({ error: 'Error al obtener comentarios' });
  }
});

// Eliminar comentario de imagen
router.delete('/:clan_id/gallery/:image_id/comments/:comment_id', authenticate, async (req, res) => {
  const { clan_id, image_id, comment_id } = req.params;

  try {
    // Get active pet
    const activePet = await getActivePet(pool, req.user.id);
    if (!activePet) {
      return res.status(400).json({ error: 'No tienes mascotas' });
    }

    // Get comment
    const commentResult = await pool.query(
      'SELECT author_pet_id FROM clan_gallery_comments WHERE id = $1 AND gallery_image_id = $2',
      [comment_id, image_id]
    );

    if (!commentResult.rows.length) {
      return res.status(404).json({ error: 'Comentario no encontrado' });
    }

    // Check permissions
    const canDelete = await canDeleteClanContent(pool, clan_id, commentResult.rows[0].author_pet_id, activePet);
    if (!canDelete) {
      return res.status(403).json({ error: 'No tienes permisos para eliminar este comentario' });
    }

    await pool.query(
      'DELETE FROM clan_gallery_comments WHERE id = $1',
      [comment_id]
    );

    res.json({ success: true, message: 'Comentario eliminado' });
  } catch (err) {
    console.error('Error al eliminar comentario:', err);
    res.status(500).json({ error: 'Error al eliminar comentario' });
  }
});

// ========== CLAN CHAT ==========

// Enviar mensaje al chat del clan
router.post('/:clan_id/messages', authenticate, async (req, res) => {
  const { content, sent_as_owner = false } = req.body;
  const { clan_id } = req.params;

  if (!content?.trim()) {
    return res.status(400).json({ error: 'El mensaje no puede estar vacío' });
  }

  try {
    // Get active pet
    const activePet = await getActivePet(pool, req.user.id);
    if (!activePet) {
      return res.status(400).json({ error: 'No tienes mascotas' });
    }

    // Check if member of clan
    const { isMember } = await checkClanMemberRole(pool, clan_id, activePet);
    if (!isMember) {
      return res.status(403).json({ error: 'No eres miembro del clan' });
    }

    // Create message
    const messageId = uuidv4();
    await pool.query(
      `INSERT INTO clan_chat_messages (id, clan_id, author_pet_id, content, sent_as_owner)
       VALUES ($1, $2, $3, $4, $5)`,
      [messageId, clan_id, activePet, content, sent_as_owner === true]
    );

    // Get message with author info
    const authorInfo = await getAuthorInfo(pool, activePet, sent_as_owner);
    const messageData = await pool.query(
      'SELECT * FROM clan_chat_messages WHERE id = $1',
      [messageId]
    );

    res.status(201).json({
      ...messageData.rows[0],
      author_name: authorInfo?.author_name,
      author_avatar: authorInfo?.author_avatar,
      author_username: authorInfo?.author_username,
      author_owner_name: authorInfo?.author_owner_name,
      author_owner_username: authorInfo?.author_owner_username,
    });
  } catch (err) {
    console.error('Error al enviar mensaje:', err);
    res.status(500).json({ error: 'Error al enviar mensaje' });
  }
});

// Obtener mensajes del chat del clan
router.get('/:clan_id/messages', authenticate, async (req, res) => {
  const { clan_id } = req.params;
  const { limit = 50, offset = 0 } = req.query;

  try {
    // Get active pet
    const activePet = await getActivePet(pool, req.user.id);
    if (!activePet) {
      return res.status(400).json({ error: 'No tienes mascotas' });
    }

    // Check if member
    const { isMember } = await checkClanMemberRole(pool, clan_id, activePet);
    if (!isMember) {
      return res.status(403).json({ error: 'No eres miembro del clan' });
    }

    const messages = await pool.query(
      `SELECT ccm.*,
        CASE WHEN ccm.sent_as_owner THEN c.name ELSE p.name END AS author_name,
        CASE WHEN ccm.sent_as_owner THEN c.avatar_url ELSE p.avatar_url END AS author_avatar,
        CASE WHEN ccm.sent_as_owner THEN c.username ELSE p.username END AS author_username,
        CASE WHEN ccm.sent_as_owner THEN NULL ELSE c.name END AS author_owner_name,
        CASE WHEN ccm.sent_as_owner THEN NULL ELSE c.username END AS author_owner_username
       FROM clan_chat_messages ccm
       JOIN pets p ON ccm.author_pet_id = p.id
       JOIN companions c ON c.id = p.companion_id
       WHERE ccm.clan_id = $1
       ORDER BY ccm.created_at DESC
       LIMIT $2 OFFSET $3`,
      [clan_id, parseInt(limit), parseInt(offset)]
    );

    // Reverse to show chronological order
    res.json(messages.rows.reverse());
  } catch (err) {
    console.error('Error al obtener mensajes:', err);
    res.status(500).json({ error: 'Error al obtener mensajes' });
  }
});

// Listar solicitudes de acceso pendientes (moderator+)
router.get('/:clan_id/requests', authenticate, async (req, res) => {
  const { clan_id } = req.params;
  try {
    const activePet = await getActivePet(pool, req.user.id);
    if (!activePet) return res.status(400).json({ error: 'No tienes mascotas' });

    const { isMember, role } = await checkClanMemberRole(pool, clan_id, activePet);
    if (!isMember) return res.status(403).json({ error: 'No eres miembro del clan' });
    if (role !== 'admin' && role !== 'moderator') {
      return res.status(403).json({ error: 'Solo moderadores y administradores pueden ver solicitudes' });
    }

    const result = await pool.query(
      `SELECT cjr.id, cjr.pet_id, cjr.status, cjr.requested_at,
              p.name, p.username, p.avatar_url
       FROM clan_join_requests cjr
       JOIN pets p ON cjr.pet_id = p.id
       WHERE cjr.clan_id = $1 AND cjr.status = 'pending'
       ORDER BY cjr.requested_at ASC`,
      [clan_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener solicitudes:', err);
    res.status(500).json({ error: 'Error al obtener solicitudes' });
  }
});

// Aceptar solicitud de acceso
router.post('/:clan_id/requests/:request_id/approve', authenticate, async (req, res) => {
  const { clan_id, request_id } = req.params;
  try {
    const activePet = await getActivePet(pool, req.user.id);
    if (!activePet) return res.status(400).json({ error: 'No tienes mascotas' });

    const { isMember, role } = await checkClanMemberRole(pool, clan_id, activePet);
    if (!isMember) return res.status(403).json({ error: 'No eres miembro del clan' });
    if (role !== 'admin' && role !== 'moderator') {
      return res.status(403).json({ error: 'Solo moderadores y administradores pueden aprobar solicitudes' });
    }

    // Get request
    const requestResult = await pool.query(
      'SELECT pet_id FROM clan_join_requests WHERE id = $1 AND clan_id = $2 AND status = $3',
      [request_id, clan_id, 'pending']
    );
    if (!requestResult.rows.length) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    const petId = requestResult.rows[0].pet_id;

    // Add to clan
    await pool.query(
      'INSERT INTO clan_members (clan_id, pet_id, role) VALUES ($1, $2, $3)',
      [clan_id, petId, 'member']
    );

    // Mark request as approved
    await pool.query(
      'UPDATE clan_join_requests SET status = $1 WHERE id = $2',
      ['approved', request_id]
    );

    res.json({ success: true, message: 'Solicitud aceptada' });
  } catch (err) {
    console.error('Error al aceptar solicitud:', err);
    res.status(500).json({ error: 'Error al aceptar solicitud' });
  }
});

// Rechazar solicitud de acceso
router.post('/:clan_id/requests/:request_id/reject', authenticate, async (req, res) => {
  const { clan_id, request_id } = req.params;
  try {
    const activePet = await getActivePet(pool, req.user.id);
    if (!activePet) return res.status(400).json({ error: 'No tienes mascotas' });

    const { isMember, role } = await checkClanMemberRole(pool, clan_id, activePet);
    if (!isMember) return res.status(403).json({ error: 'No eres miembro del clan' });
    if (role !== 'admin' && role !== 'moderator') {
      return res.status(403).json({ error: 'Solo moderadores y administradores pueden rechazar solicitudes' });
    }

    // Mark request as rejected
    await pool.query(
      'UPDATE clan_join_requests SET status = $1 WHERE id = $2 AND clan_id = $3',
      ['rejected', request_id, clan_id]
    );

    res.json({ success: true, message: 'Solicitud rechazada' });
  } catch (err) {
    console.error('Error al rechazar solicitud:', err);
    res.status(500).json({ error: 'Error al rechazar solicitud' });
  }
});

// Eliminar clan (solo admin/fundador)
router.delete('/:clan_id', authenticate, async (req, res) => {
  const { clan_id } = req.params;
  try {
    const activePet = await getActivePet(pool, req.user.id);
    if (!activePet) return res.status(400).json({ error: 'No tienes mascotas' });

    const { isMember, role } = await checkClanMemberRole(pool, clan_id, activePet);
    if (!isMember) return res.status(403).json({ error: 'No eres miembro del clan' });
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Solo el fundador puede eliminar el clan' });
    }

    // Delete clan (cascade will handle members, posts, etc.)
    await pool.query('DELETE FROM clans WHERE id = $1', [clan_id]);

    res.json({ success: true, message: 'Clan eliminado' });
  } catch (err) {
    console.error('Error al eliminar clan:', err);
    res.status(500).json({ error: 'Error al eliminar clan' });
  }
});

export default router;
