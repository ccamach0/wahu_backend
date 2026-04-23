import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { uploadSingle, processImage } from '../middleware/imageUpload.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../services/cloudinary.js';

const router = Router();

// Listar mascotas con filtros
router.get('/', optionalAuth, async (req, res) => {
  const { page = 1, limit = 12, search = '', species = '', min_level = '', max_level = '', sort = 'popularity', exclude_companion = '' } = req.query;
  const offset = (page - 1) * limit;

  try {
    const conditions = [];
    const params = [];

    if (search) { params.push(`%${search}%`); conditions.push(`(p.name ILIKE $${params.length} OR p.username ILIKE $${params.length} OR p.breed ILIKE $${params.length})`); }
    if (species) { params.push(species); conditions.push(`p.species = $${params.length}`); }
    if (min_level) { params.push(parseInt(min_level)); conditions.push(`p.level >= $${params.length}`); }
    if (max_level) { params.push(parseInt(max_level)); conditions.push(`p.level <= $${params.length}`); }
    if (exclude_companion) { params.push(exclude_companion); conditions.push(`p.companion_id != $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderBy = sort === 'level' ? 'p.level DESC' : sort === 'name' ? 'p.name ASC' : 'p.popularity DESC';

    const countParams = [...params];
    params.push(limit, offset);

    const result = await pool.query(
      `SELECT p.*, array_agg(c.name) FILTER (WHERE c.name IS NOT NULL) as tags
       FROM pets p
       LEFT JOIN pet_cards pc ON p.id = pc.pet_id
       LEFT JOIN cards c ON pc.card_id = c.id
       ${where} GROUP BY p.id ORDER BY ${orderBy} LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM pets p ${where}`,
      countParams
    );

    res.json({
      pets: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      pages: Math.ceil(countResult.rows[0].count / limit),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener mascotas' });
  }
});

// Mascotas populares (para home)
router.get('/popular', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, array_agg(c.name) FILTER (WHERE c.name IS NOT NULL) as tags,
              COUNT(DISTINCT f.id) as friend_count
       FROM pets p
       LEFT JOIN pet_cards pc ON p.id = pc.pet_id
       LEFT JOIN cards c ON pc.card_id = c.id
       LEFT JOIN friendships f ON p.id = f.pet_id AND f.status = 'accepted'
       GROUP BY p.id ORDER BY p.popularity DESC LIMIT 6`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener mascotas populares' });
  }
});

// Ver mascota por username
router.get('/:username', optionalAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, comp.name as companion_name, comp.username as companion_username,
              comp.avatar_url as companion_avatar,
              array_agg(DISTINCT jsonb_build_object('id', c.id, 'name', c.name, 'category', c.category))
                FILTER (WHERE c.id IS NOT NULL) as cards,
              COUNT(DISTINCT f.id) FILTER (WHERE f.status='accepted') as friend_count
       FROM pets p
       JOIN companions comp ON p.companion_id = comp.id
       LEFT JOIN pet_cards pc ON p.id = pc.pet_id
       LEFT JOIN cards c ON pc.card_id = c.id
       LEFT JOIN friendships f ON p.id = f.pet_id
       WHERE p.username = $1
       GROUP BY p.id, comp.id`,
      [req.params.username]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Mascota no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener mascota' });
  }
});

// Crear mascota
router.post('/', authenticate, uploadSingle, processImage, async (req, res) => {
  const { name, username, breed, species, location, bio } = req.body;
  if (!name || !username) return res.status(400).json({ error: 'Nombre y username requeridos' });

  try {
    const exists = await pool.query('SELECT id FROM pets WHERE username=$1', [username]);
    if (exists.rows.length) return res.status(409).json({ error: 'Username ya en uso' });

    let avatar_url = null;
    if (req.file) {
      avatar_url = await uploadToCloudinary(req.file.buffer, req.file.originalname, 'pets/avatars');
    }

    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO pets (id, companion_id, name, username, breed, species, location, bio, avatar_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [id, req.user.id, name, username, breed, species || 'Perro', location, bio, avatar_url]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating pet:', err.message);
    res.status(500).json({ error: 'Error al crear mascota', details: err.message });
  }
});

// Mis mascotas
router.get('/my/pets', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, array_agg(c.name) FILTER (WHERE c.name IS NOT NULL) as tags
       FROM pets p
       LEFT JOIN pet_cards pc ON p.id = pc.pet_id
       LEFT JOIN cards c ON pc.card_id = c.id
       WHERE p.companion_id = $1
       GROUP BY p.id ORDER BY p.created_at`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener mis mascotas' });
  }
});

// Eliminar mascota (solo si pertenece al usuario)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM pets WHERE id = $1 AND companion_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Mascota no encontrada' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar mascota' });
  }
});

// Cambiar avatar de mascota
router.put('/:id/avatar', authenticate, uploadSingle, processImage, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const pet = await pool.query('SELECT companion_id FROM pets WHERE id = $1', [req.params.id]);
    if (!pet.rows.length) return res.status(404).json({ error: 'Pet not found' });
    if (pet.rows[0].companion_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

    const avatar_url = await uploadToCloudinary(req.file.buffer, req.file.originalname, 'pets/avatars');

    const result = await pool.query(
      'UPDATE pets SET avatar_url = $1 WHERE id = $2 RETURNING id, avatar_url',
      [avatar_url, req.params.id]
    );

    res.json({ id: result.rows[0].id, avatar_url: result.rows[0].avatar_url });
  } catch (err) {
    console.error('Error updating pet avatar:', err.message);
    res.status(500).json({ error: 'Error al cambiar avatar' });
  }
});

// Galería de mascota - Subir foto
router.post('/:pet_id/gallery', authenticate, uploadSingle, processImage, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const pet = await pool.query('SELECT companion_id FROM pets WHERE id = $1', [req.params.pet_id]);
    if (!pet.rows.length) return res.status(404).json({ error: 'Pet not found' });
    if (pet.rows[0].companion_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

    const image_url = await uploadToCloudinary(req.file.buffer, req.file.originalname, `pets/${req.params.pet_id}`);

    const result = await pool.query(
      `INSERT INTO pet_gallery (id, pet_id, image_url, "order")
       VALUES ($1, $2, $3, (SELECT COALESCE(MAX("order"), -1) + 1 FROM pet_gallery WHERE pet_id = $2))
       RETURNING id, image_url, created_at`,
      [uuidv4(), req.params.pet_id, image_url]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error uploading image' });
  }
});

// Galería de mascota - Obtener fotos
router.get('/:pet_id/gallery', optionalAuth, async (req, res) => {
  const { limit = 10, offset = 0 } = req.query;

  try {
    const [images, total] = await Promise.all([
      pool.query(
        `SELECT id, image_url, created_at FROM pet_gallery WHERE pet_id = $1 ORDER BY "order" ASC LIMIT $2 OFFSET $3`,
        [req.params.pet_id, parseInt(limit), parseInt(offset)]
      ),
      pool.query('SELECT COUNT(*) FROM pet_gallery WHERE pet_id = $1', [req.params.pet_id]),
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

// Galería de mascota - Eliminar foto
router.delete('/:pet_id/gallery/:image_id', authenticate, async (req, res) => {
  try {
    const pet = await pool.query('SELECT companion_id FROM pets WHERE id = $1', [req.params.pet_id]);
    if (!pet.rows.length) return res.status(404).json({ error: 'Pet not found' });
    if (pet.rows[0].companion_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

    const image = await pool.query('SELECT image_url FROM pet_gallery WHERE id = $1 AND pet_id = $2', [req.params.image_id, req.params.pet_id]);
    if (!image.rows.length) return res.status(404).json({ error: 'Image not found' });

    await deleteFromCloudinary(image.rows[0].image_url);
    await pool.query('DELETE FROM pet_gallery WHERE id = $1', [req.params.image_id]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error deleting image' });
  }
});

// Galería de mascota - Reordenar
router.put('/:pet_id/gallery/reorder', authenticate, async (req, res) => {
  const { imageIds } = req.body;
  if (!Array.isArray(imageIds)) return res.status(400).json({ error: 'imageIds must be an array' });

  try {
    const pet = await pool.query('SELECT companion_id FROM pets WHERE id = $1', [req.params.pet_id]);
    if (!pet.rows.length) return res.status(404).json({ error: 'Pet not found' });
    if (pet.rows[0].companion_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

    for (let i = 0; i < imageIds.length; i++) {
      await pool.query('UPDATE pet_gallery SET "order" = $1 WHERE id = $2 AND pet_id = $3', [i, imageIds[i], req.params.pet_id]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error reordering gallery' });
  }
});

export default router;
