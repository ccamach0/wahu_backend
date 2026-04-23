import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { uploadSingle, processImage } from '../middleware/imageUpload.js';
import { uploadToR2, deleteFromR2 } from '../services/r2.js';

const router = Router();

// Obtener perfil de usuario
router.get('/:companion_id', optionalAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, username, avatar_url, created_at FROM companions WHERE id = $1`,
      [req.params.companion_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching user profile' });
  }
});

// Actualizar perfil de usuario + avatar
router.put('/:companion_id', authenticate, uploadSingle, processImage, async (req, res) => {
  if (req.user.id !== req.params.companion_id) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const { name, bio } = req.body;

  try {
    let avatar_url = undefined;
    if (req.file) {
      avatar_url = await uploadToR2(req.file.buffer, req.file.originalname, 'companions/avatars');
    }

    const updateFields = [];
    const params = [];
    let paramCount = 1;

    if (name !== undefined) {
      updateFields.push(`name = $${paramCount}`);
      params.push(name);
      paramCount++;
    }

    if (avatar_url) {
      updateFields.push(`avatar_url = $${paramCount}`);
      params.push(avatar_url);
      paramCount++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(req.params.companion_id);
    const query = `UPDATE companions SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING id, name, username, avatar_url`;

    const result = await pool.query(query, params);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error updating profile' });
  }
});

// Galería de usuario - Subir foto
router.post('/:companion_id/gallery', authenticate, uploadSingle, processImage, async (req, res) => {
  if (req.user.id !== req.params.companion_id) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const image_url = await uploadToR2(req.file.buffer, req.file.originalname, `companions/${req.params.companion_id}`);

    const result = await pool.query(
      `INSERT INTO companion_gallery (id, companion_id, image_url, "order")
       VALUES ($1, $2, $3, (SELECT COALESCE(MAX("order"), -1) + 1 FROM companion_gallery WHERE companion_id = $2))
       RETURNING id, image_url, created_at`,
      [uuidv4(), req.params.companion_id, image_url]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error uploading image' });
  }
});

// Galería de usuario - Obtener fotos
router.get('/:companion_id/gallery', optionalAuth, async (req, res) => {
  const { limit = 10, offset = 0 } = req.query;

  try {
    const [images, total] = await Promise.all([
      pool.query(
        `SELECT id, image_url, created_at FROM companion_gallery WHERE companion_id = $1 ORDER BY "order" ASC LIMIT $2 OFFSET $3`,
        [req.params.companion_id, parseInt(limit), parseInt(offset)]
      ),
      pool.query('SELECT COUNT(*) FROM companion_gallery WHERE companion_id = $1', [req.params.companion_id]),
    ]);

    res.json({
      total: parseInt(total.rows[0].count),
      images: images.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching gallery' });
  }
});

// Galería de usuario - Eliminar foto
router.delete('/:companion_id/gallery/:image_id', authenticate, async (req, res) => {
  if (req.user.id !== req.params.companion_id) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const image = await pool.query(
      'SELECT image_url FROM companion_gallery WHERE id = $1 AND companion_id = $2',
      [req.params.image_id, req.params.companion_id]
    );
    if (!image.rows.length) return res.status(404).json({ error: 'Image not found' });

    await deleteFromR2(image.rows[0].image_url);
    await pool.query('DELETE FROM companion_gallery WHERE id = $1', [req.params.image_id]);

    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error deleting image' });
  }
});

// Galería de usuario - Reordenar
router.put('/:companion_id/gallery/reorder', authenticate, async (req, res) => {
  if (req.user.id !== req.params.companion_id) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const { imageIds } = req.body;
  if (!Array.isArray(imageIds)) return res.status(400).json({ error: 'imageIds must be an array' });

  try {
    for (let i = 0; i < imageIds.length; i++) {
      await pool.query(
        'UPDATE companion_gallery SET "order" = $1 WHERE id = $2 AND companion_id = $3',
        [i, imageIds[i], req.params.companion_id]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error reordering gallery' });
  }
});

export default router;
