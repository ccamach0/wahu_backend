import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = Router();

// ===== PET POSTS =====

// GET /api/posts/pets/:pet_id/posts - Obtener posts de una mascota
router.get('/pets/:pet_id/posts', optionalAuth, async (req, res) => {
  const { limit = 20, offset = 0 } = req.query;
  try {
    const [posts, total] = await Promise.all([
      pool.query(
        `SELECT
          p.id, p.content, p.sent_as_owner, p.created_at,
          CASE WHEN p.sent_as_owner THEN c.name ELSE pet.name END AS author_name,
          CASE WHEN p.sent_as_owner THEN c.avatar_url ELSE pet.avatar_url END AS author_avatar,
          CASE WHEN p.sent_as_owner THEN c.username ELSE pet.username END AS author_username,
          CASE WHEN p.sent_as_owner THEN NULL ELSE c.name END AS author_owner_name,
          CASE WHEN p.sent_as_owner THEN NULL ELSE c.username END AS author_owner_username,
          p.pet_id
         FROM pet_posts p
         JOIN pets pet ON pet.id = p.pet_id
         JOIN companions c ON c.id = pet.companion_id
         WHERE p.pet_id = $1
         ORDER BY p.created_at DESC
         LIMIT $2 OFFSET $3`,
        [req.params.pet_id, parseInt(limit), parseInt(offset)]
      ),
      pool.query('SELECT COUNT(*) FROM pet_posts WHERE pet_id = $1', [req.params.pet_id]),
    ]);

    res.json({
      posts: posts.rows,
      total: parseInt(total.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching posts' });
  }
});

// POST /api/posts/pets/:pet_id/posts - Crear post
router.post('/pets/:pet_id/posts', authenticate, async (req, res) => {
  const { content, sent_as_owner } = req.body;
  if (!content || content.trim() === '') {
    return res.status(400).json({ error: 'Content is required' });
  }

  try {
    const pet = await pool.query('SELECT companion_id FROM pets WHERE id = $1', [req.params.pet_id]);
    if (!pet.rows.length) return res.status(404).json({ error: 'Pet not found' });

    // Get companion's active pet, fallback to first pet
    const companionPet = await pool.query(
      'SELECT active_pet_id FROM companions WHERE id = $1',
      [req.user.id]
    );

    let activePetId = companionPet.rows[0]?.active_pet_id;

    if (!activePetId) {
      const firstPet = await pool.query(
        'SELECT id FROM pets WHERE companion_id = $1 ORDER BY created_at LIMIT 1',
        [req.user.id]
      );
      activePetId = firstPet.rows[0]?.id;
    }

    if (!activePetId) {
      return res.status(400).json({ error: 'You must have an active pet to post' });
    }

    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO pet_posts (id, pet_id, content, sent_as_owner)
       VALUES ($1, $2, $3, $4)
       RETURNING id, content, sent_as_owner, created_at, pet_id`,
      [id, activePetId, content, sent_as_owner === true]
    );

    const post = result.rows[0];
    const authorData = await pool.query(
      `SELECT
        CASE WHEN $2 THEN c.name ELSE p.name END AS author_name,
        CASE WHEN $2 THEN c.avatar_url ELSE p.avatar_url END AS author_avatar,
        CASE WHEN $2 THEN c.username ELSE p.username END AS author_username,
        CASE WHEN $2 THEN NULL ELSE c.name END AS author_owner_name,
        CASE WHEN $2 THEN NULL ELSE c.username END AS author_owner_username
       FROM pets p
       JOIN companions c ON c.id = p.companion_id
       WHERE p.id = $1`,
      [post.pet_id, post.sent_as_owner]
    );

    res.status(201).json({ ...post, ...authorData.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creating post' });
  }
});

// DELETE /api/posts/pets/:pet_id/posts/:post_id - Eliminar post
router.delete('/pets/:pet_id/posts/:post_id', authenticate, async (req, res) => {
  try {
    const post = await pool.query(
      'SELECT pet_id FROM pet_posts WHERE id = $1',
      [req.params.post_id]
    );
    if (!post.rows.length) return res.status(404).json({ error: 'Post not found' });

    const pet = await pool.query(
      'SELECT companion_id FROM pets WHERE id = $1',
      [post.rows[0].pet_id]
    );
    if (pet.rows[0].companion_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await pool.query('DELETE FROM pet_posts WHERE id = $1', [req.params.post_id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error deleting post' });
  }
});

// ===== PET POST COMMENTS =====

// GET /api/posts/pets/:pet_id/posts/:post_id/comments
router.get('/pets/:pet_id/posts/:post_id/comments', optionalAuth, async (req, res) => {
  const { limit = 50, offset = 0 } = req.query;
  try {
    const [comments, total] = await Promise.all([
      pool.query(
        `SELECT
          c.id, c.content, c.author_pet_id, c.sent_as_owner, c.created_at,
          CASE WHEN c.sent_as_owner THEN comp.name ELSE p.name END AS author_name,
          CASE WHEN c.sent_as_owner THEN comp.avatar_url ELSE p.avatar_url END AS author_avatar,
          CASE WHEN c.sent_as_owner THEN comp.username ELSE p.username END AS author_username,
          CASE WHEN c.sent_as_owner THEN NULL ELSE comp.name END AS author_owner_name,
          CASE WHEN c.sent_as_owner THEN NULL ELSE comp.username END AS author_owner_username
         FROM pet_post_comments c
         JOIN pets p ON p.id = c.author_pet_id
         JOIN companions comp ON comp.id = p.companion_id
         WHERE c.post_id = $1
         ORDER BY c.created_at ASC
         LIMIT $2 OFFSET $3`,
        [req.params.post_id, parseInt(limit), parseInt(offset)]
      ),
      pool.query('SELECT COUNT(*) FROM pet_post_comments WHERE post_id = $1', [req.params.post_id]),
    ]);

    res.json({
      comments: comments.rows,
      total: parseInt(total.rows[0].count),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching comments' });
  }
});

// POST /api/posts/pets/:pet_id/posts/:post_id/comments
router.post('/pets/:pet_id/posts/:post_id/comments', authenticate, async (req, res) => {
  const { content, sent_as_owner } = req.body;
  if (!content || content.trim() === '') {
    return res.status(400).json({ error: 'Content is required' });
  }

  try {
    // Get companion's active pet, fallback to first pet
    const companion = await pool.query(
      'SELECT active_pet_id FROM companions WHERE id = $1',
      [req.user.id]
    );

    let activePetId = companion.rows[0]?.active_pet_id;

    if (!activePetId) {
      const firstPet = await pool.query(
        'SELECT id FROM pets WHERE companion_id = $1 ORDER BY created_at LIMIT 1',
        [req.user.id]
      );
      activePetId = firstPet.rows[0]?.id;
    }

    if (!activePetId) {
      return res.status(400).json({ error: 'You must have an active pet to comment' });
    }

    const post = await pool.query('SELECT id FROM pet_posts WHERE id = $1', [req.params.post_id]);
    if (!post.rows.length) return res.status(404).json({ error: 'Post not found' });

    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO pet_post_comments (id, post_id, author_pet_id, content, sent_as_owner)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, content, author_pet_id, sent_as_owner, created_at`,
      [id, req.params.post_id, activePetId, content, sent_as_owner === true]
    );

    const comment = result.rows[0];
    const authorData = await pool.query(
      `SELECT
        CASE WHEN $2 THEN c.name ELSE p.name END AS author_name,
        CASE WHEN $2 THEN c.avatar_url ELSE p.avatar_url END AS author_avatar,
        CASE WHEN $2 THEN c.username ELSE p.username END AS author_username,
        CASE WHEN $2 THEN NULL ELSE c.name END AS author_owner_name,
        CASE WHEN $2 THEN NULL ELSE c.username END AS author_owner_username
       FROM pets p
       JOIN companions c ON c.id = p.companion_id
       WHERE p.id = $1`,
      [comment.author_pet_id, comment.sent_as_owner]
    );

    res.status(201).json({ ...comment, ...authorData.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creating comment' });
  }
});

// DELETE /api/posts/pets/:pet_id/posts/:post_id/comments/:comment_id
router.delete('/pets/:pet_id/posts/:post_id/comments/:comment_id', authenticate, async (req, res) => {
  try {
    const comment = await pool.query(
      'SELECT author_pet_id FROM pet_post_comments WHERE id = $1',
      [req.params.comment_id]
    );
    if (!comment.rows.length) return res.status(404).json({ error: 'Comment not found' });

    const pet = await pool.query(
      'SELECT companion_id FROM pets WHERE id = $1',
      [comment.rows[0].author_pet_id]
    );
    if (pet.rows[0].companion_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await pool.query('DELETE FROM pet_post_comments WHERE id = $1', [req.params.comment_id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error deleting comment' });
  }
});

// ===== PET GALLERY COMMENTS =====

// GET /api/posts/pets/:pet_id/gallery/:image_id/comments
router.get('/pets/:pet_id/gallery/:image_id/comments', optionalAuth, async (req, res) => {
  const { limit = 50, offset = 0 } = req.query;
  try {
    const [comments, total] = await Promise.all([
      pool.query(
        `SELECT
          c.id, c.content, c.author_pet_id, c.sent_as_owner, c.created_at,
          CASE WHEN c.sent_as_owner THEN comp.name ELSE p.name END AS author_name,
          CASE WHEN c.sent_as_owner THEN comp.avatar_url ELSE p.avatar_url END AS author_avatar,
          CASE WHEN c.sent_as_owner THEN comp.username ELSE p.username END AS author_username,
          CASE WHEN c.sent_as_owner THEN NULL ELSE comp.name END AS author_owner_name,
          CASE WHEN c.sent_as_owner THEN NULL ELSE comp.username END AS author_owner_username
         FROM pet_gallery_comments c
         JOIN pets p ON p.id = c.author_pet_id
         JOIN companions comp ON comp.id = p.companion_id
         WHERE c.gallery_image_id = $1
         ORDER BY c.created_at ASC
         LIMIT $2 OFFSET $3`,
        [req.params.image_id, parseInt(limit), parseInt(offset)]
      ),
      pool.query('SELECT COUNT(*) FROM pet_gallery_comments WHERE gallery_image_id = $1', [req.params.image_id]),
    ]);

    res.json({
      comments: comments.rows,
      total: parseInt(total.rows[0].count),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching comments' });
  }
});

// POST /api/posts/pets/:pet_id/gallery/:image_id/comments
router.post('/pets/:pet_id/gallery/:image_id/comments', authenticate, async (req, res) => {
  const { content, sent_as_owner } = req.body;
  if (!content || content.trim() === '') {
    return res.status(400).json({ error: 'Content is required' });
  }

  try {
    // Get companion's active pet, fallback to first pet
    const companion = await pool.query(
      'SELECT active_pet_id FROM companions WHERE id = $1',
      [req.user.id]
    );

    let activePetId = companion.rows[0]?.active_pet_id;

    if (!activePetId) {
      const firstPet = await pool.query(
        'SELECT id FROM pets WHERE companion_id = $1 ORDER BY created_at LIMIT 1',
        [req.user.id]
      );
      activePetId = firstPet.rows[0]?.id;
    }

    if (!activePetId) {
      return res.status(400).json({ error: 'You must have an active pet to comment' });
    }

    const image = await pool.query('SELECT id FROM pet_gallery WHERE id = $1', [req.params.image_id]);
    if (!image.rows.length) return res.status(404).json({ error: 'Image not found' });

    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO pet_gallery_comments (id, gallery_image_id, author_pet_id, content, sent_as_owner)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, content, author_pet_id, sent_as_owner, created_at`,
      [id, req.params.image_id, activePetId, content, sent_as_owner === true]
    );

    const comment = result.rows[0];
    const authorData = await pool.query(
      `SELECT
        CASE WHEN $2 THEN c.name ELSE p.name END AS author_name,
        CASE WHEN $2 THEN c.avatar_url ELSE p.avatar_url END AS author_avatar,
        CASE WHEN $2 THEN c.username ELSE p.username END AS author_username,
        CASE WHEN $2 THEN NULL ELSE c.name END AS author_owner_name,
        CASE WHEN $2 THEN NULL ELSE c.username END AS author_owner_username
       FROM pets p
       JOIN companions c ON c.id = p.companion_id
       WHERE p.id = $1`,
      [comment.author_pet_id, comment.sent_as_owner]
    );

    res.status(201).json({ ...comment, ...authorData.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creating comment' });
  }
});

// DELETE /api/posts/pets/:pet_id/gallery/:image_id/comments/:comment_id
router.delete('/pets/:pet_id/gallery/:image_id/comments/:comment_id', authenticate, async (req, res) => {
  try {
    const comment = await pool.query(
      'SELECT author_pet_id FROM pet_gallery_comments WHERE id = $1',
      [req.params.comment_id]
    );
    if (!comment.rows.length) return res.status(404).json({ error: 'Comment not found' });

    const pet = await pool.query(
      'SELECT companion_id FROM pets WHERE id = $1',
      [comment.rows[0].author_pet_id]
    );
    if (pet.rows[0].companion_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await pool.query('DELETE FROM pet_gallery_comments WHERE id = $1', [req.params.comment_id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error deleting comment' });
  }
});

// ===== COMPANION POSTS =====

// GET /api/posts/companions/:companion_id/posts
router.get('/companions/:companion_id/posts', optionalAuth, async (req, res) => {
  const { limit = 20, offset = 0 } = req.query;
  try {
    const [posts, total] = await Promise.all([
      pool.query(
        `SELECT
          p.id, p.content, p.sent_as_owner, p.created_at,
          CASE WHEN p.sent_as_owner THEN c.name ELSE pet.name END AS author_name,
          CASE WHEN p.sent_as_owner THEN c.avatar_url ELSE pet.avatar_url END AS author_avatar,
          CASE WHEN p.sent_as_owner THEN c.username ELSE pet.username END AS author_username,
          CASE WHEN p.sent_as_owner THEN NULL ELSE c.name END AS author_owner_name,
          CASE WHEN p.sent_as_owner THEN NULL ELSE c.username END AS author_owner_username,
          p.pet_id, p.companion_id
         FROM companion_posts p
         JOIN pets pet ON pet.id = p.pet_id
         JOIN companions c ON c.id = pet.companion_id
         WHERE p.companion_id = $1
         ORDER BY p.created_at DESC
         LIMIT $2 OFFSET $3`,
        [req.params.companion_id, parseInt(limit), parseInt(offset)]
      ),
      pool.query('SELECT COUNT(*) FROM companion_posts WHERE companion_id = $1', [req.params.companion_id]),
    ]);

    res.json({
      posts: posts.rows,
      total: parseInt(total.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching posts' });
  }
});

// POST /api/posts/companions/:companion_id/posts
router.post('/companions/:companion_id/posts', authenticate, async (req, res) => {
  const { content, sent_as_owner } = req.body;
  if (!content || content.trim() === '') {
    return res.status(400).json({ error: 'Content is required' });
  }

  try {
    const companion = await pool.query(
      'SELECT id FROM companions WHERE id = $1',
      [req.params.companion_id]
    );
    if (!companion.rows.length) return res.status(404).json({ error: 'Companion not found' });

    // Get companion's active pet, fallback to first pet
    const companionPet = await pool.query(
      'SELECT active_pet_id FROM companions WHERE id = $1',
      [req.user.id]
    );

    let activePetId = companionPet.rows[0]?.active_pet_id;

    if (!activePetId) {
      const firstPet = await pool.query(
        'SELECT id FROM pets WHERE companion_id = $1 ORDER BY created_at LIMIT 1',
        [req.user.id]
      );
      activePetId = firstPet.rows[0]?.id;
    }

    if (!activePetId) {
      return res.status(400).json({ error: 'You must have an active pet to post' });
    }

    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO companion_posts (id, companion_id, pet_id, content, sent_as_owner)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, content, sent_as_owner, created_at, pet_id, companion_id`,
      [id, req.params.companion_id, activePetId, content, sent_as_owner === true]
    );

    const post = result.rows[0];
    const authorData = await pool.query(
      `SELECT
        CASE WHEN $2 THEN c.name ELSE p.name END AS author_name,
        CASE WHEN $2 THEN c.avatar_url ELSE p.avatar_url END AS author_avatar,
        CASE WHEN $2 THEN c.username ELSE p.username END AS author_username,
        CASE WHEN $2 THEN NULL ELSE c.name END AS author_owner_name,
        CASE WHEN $2 THEN NULL ELSE c.username END AS author_owner_username
       FROM pets p
       JOIN companions c ON c.id = p.companion_id
       WHERE p.id = $1`,
      [post.pet_id, post.sent_as_owner]
    );

    res.status(201).json({ ...post, ...authorData.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creating post' });
  }
});

// DELETE /api/posts/companions/:companion_id/posts/:post_id
router.delete('/companions/:companion_id/posts/:post_id', authenticate, async (req, res) => {
  try {
    const post = await pool.query(
      'SELECT pet_id FROM companion_posts WHERE id = $1',
      [req.params.post_id]
    );
    if (!post.rows.length) return res.status(404).json({ error: 'Post not found' });

    const pet = await pool.query(
      'SELECT companion_id FROM pets WHERE id = $1',
      [post.rows[0].pet_id]
    );
    if (pet.rows[0].companion_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await pool.query('DELETE FROM companion_posts WHERE id = $1', [req.params.post_id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error deleting post' });
  }
});

// ===== COMPANION POST COMMENTS =====

// GET /api/posts/companions/:companion_id/posts/:post_id/comments
router.get('/companions/:companion_id/posts/:post_id/comments', optionalAuth, async (req, res) => {
  const { limit = 50, offset = 0 } = req.query;
  try {
    const [comments, total] = await Promise.all([
      pool.query(
        `SELECT
          c.id, c.content, c.author_pet_id, c.sent_as_owner, c.created_at,
          CASE WHEN c.sent_as_owner THEN comp.name ELSE p.name END AS author_name,
          CASE WHEN c.sent_as_owner THEN comp.avatar_url ELSE p.avatar_url END AS author_avatar,
          CASE WHEN c.sent_as_owner THEN comp.username ELSE p.username END AS author_username,
          CASE WHEN c.sent_as_owner THEN NULL ELSE comp.name END AS author_owner_name,
          CASE WHEN c.sent_as_owner THEN NULL ELSE comp.username END AS author_owner_username
         FROM companion_post_comments c
         JOIN pets p ON p.id = c.author_pet_id
         JOIN companions comp ON comp.id = p.companion_id
         WHERE c.post_id = $1
         ORDER BY c.created_at ASC
         LIMIT $2 OFFSET $3`,
        [req.params.post_id, parseInt(limit), parseInt(offset)]
      ),
      pool.query('SELECT COUNT(*) FROM companion_post_comments WHERE post_id = $1', [req.params.post_id]),
    ]);

    res.json({
      comments: comments.rows,
      total: parseInt(total.rows[0].count),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching comments' });
  }
});

// POST /api/posts/companions/:companion_id/posts/:post_id/comments
router.post('/companions/:companion_id/posts/:post_id/comments', authenticate, async (req, res) => {
  const { content, sent_as_owner } = req.body;
  if (!content || content.trim() === '') {
    return res.status(400).json({ error: 'Content is required' });
  }

  try {
    // Get companion's active pet, fallback to first pet
    const companion = await pool.query(
      'SELECT active_pet_id FROM companions WHERE id = $1',
      [req.user.id]
    );

    let activePetId = companion.rows[0]?.active_pet_id;

    if (!activePetId) {
      const firstPet = await pool.query(
        'SELECT id FROM pets WHERE companion_id = $1 ORDER BY created_at LIMIT 1',
        [req.user.id]
      );
      activePetId = firstPet.rows[0]?.id;
    }

    if (!activePetId) {
      return res.status(400).json({ error: 'You must have an active pet to comment' });
    }

    const post = await pool.query('SELECT id FROM companion_posts WHERE id = $1', [req.params.post_id]);
    if (!post.rows.length) return res.status(404).json({ error: 'Post not found' });

    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO companion_post_comments (id, post_id, author_pet_id, content, sent_as_owner)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, content, author_pet_id, sent_as_owner, created_at`,
      [id, req.params.post_id, activePetId, content, sent_as_owner === true]
    );

    const comment = result.rows[0];
    const authorData = await pool.query(
      `SELECT
        CASE WHEN $2 THEN c.name ELSE p.name END AS author_name,
        CASE WHEN $2 THEN c.avatar_url ELSE p.avatar_url END AS author_avatar,
        CASE WHEN $2 THEN c.username ELSE p.username END AS author_username,
        CASE WHEN $2 THEN NULL ELSE c.name END AS author_owner_name,
        CASE WHEN $2 THEN NULL ELSE c.username END AS author_owner_username
       FROM pets p
       JOIN companions c ON c.id = p.companion_id
       WHERE p.id = $1`,
      [comment.author_pet_id, comment.sent_as_owner]
    );

    res.status(201).json({ ...comment, ...authorData.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creating comment' });
  }
});

// DELETE /api/posts/companions/:companion_id/posts/:post_id/comments/:comment_id
router.delete('/companions/:companion_id/posts/:post_id/comments/:comment_id', authenticate, async (req, res) => {
  try {
    const comment = await pool.query(
      'SELECT author_pet_id FROM companion_post_comments WHERE id = $1',
      [req.params.comment_id]
    );
    if (!comment.rows.length) return res.status(404).json({ error: 'Comment not found' });

    const pet = await pool.query(
      'SELECT companion_id FROM pets WHERE id = $1',
      [comment.rows[0].author_pet_id]
    );
    if (pet.rows[0].companion_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await pool.query('DELETE FROM companion_post_comments WHERE id = $1', [req.params.comment_id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error deleting comment' });
  }
});

// ===== COMPANION GALLERY COMMENTS =====

// GET /api/posts/companions/:companion_id/gallery/:image_id/comments
router.get('/companions/:companion_id/gallery/:image_id/comments', optionalAuth, async (req, res) => {
  const { limit = 50, offset = 0 } = req.query;
  try {
    const [comments, total] = await Promise.all([
      pool.query(
        `SELECT
          c.id, c.content, c.author_pet_id, c.sent_as_owner, c.created_at,
          CASE WHEN c.sent_as_owner THEN comp.name ELSE p.name END AS author_name,
          CASE WHEN c.sent_as_owner THEN comp.avatar_url ELSE p.avatar_url END AS author_avatar,
          CASE WHEN c.sent_as_owner THEN comp.username ELSE p.username END AS author_username,
          CASE WHEN c.sent_as_owner THEN NULL ELSE comp.name END AS author_owner_name,
          CASE WHEN c.sent_as_owner THEN NULL ELSE comp.username END AS author_owner_username
         FROM companion_gallery_comments c
         JOIN pets p ON p.id = c.author_pet_id
         JOIN companions comp ON comp.id = p.companion_id
         WHERE c.gallery_image_id = $1
         ORDER BY c.created_at ASC
         LIMIT $2 OFFSET $3`,
        [req.params.image_id, parseInt(limit), parseInt(offset)]
      ),
      pool.query('SELECT COUNT(*) FROM companion_gallery_comments WHERE gallery_image_id = $1', [req.params.image_id]),
    ]);

    res.json({
      comments: comments.rows,
      total: parseInt(total.rows[0].count),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching comments' });
  }
});

// POST /api/posts/companions/:companion_id/gallery/:image_id/comments
router.post('/companions/:companion_id/gallery/:image_id/comments', authenticate, async (req, res) => {
  const { content, sent_as_owner } = req.body;
  if (!content || content.trim() === '') {
    return res.status(400).json({ error: 'Content is required' });
  }

  try {
    // Get companion's active pet, fallback to first pet
    const companion = await pool.query(
      'SELECT active_pet_id FROM companions WHERE id = $1',
      [req.user.id]
    );

    let activePetId = companion.rows[0]?.active_pet_id;

    if (!activePetId) {
      const firstPet = await pool.query(
        'SELECT id FROM pets WHERE companion_id = $1 ORDER BY created_at LIMIT 1',
        [req.user.id]
      );
      activePetId = firstPet.rows[0]?.id;
    }

    if (!activePetId) {
      return res.status(400).json({ error: 'You must have an active pet to comment' });
    }

    const image = await pool.query('SELECT id FROM companion_gallery WHERE id = $1', [req.params.image_id]);
    if (!image.rows.length) return res.status(404).json({ error: 'Image not found' });

    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO companion_gallery_comments (id, gallery_image_id, author_pet_id, content, sent_as_owner)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, content, author_pet_id, sent_as_owner, created_at`,
      [id, req.params.image_id, activePetId, content, sent_as_owner === true]
    );

    const comment = result.rows[0];
    const authorData = await pool.query(
      `SELECT
        CASE WHEN $2 THEN c.name ELSE p.name END AS author_name,
        CASE WHEN $2 THEN c.avatar_url ELSE p.avatar_url END AS author_avatar,
        CASE WHEN $2 THEN c.username ELSE p.username END AS author_username,
        CASE WHEN $2 THEN NULL ELSE c.name END AS author_owner_name,
        CASE WHEN $2 THEN NULL ELSE c.username END AS author_owner_username
       FROM pets p
       JOIN companions c ON c.id = p.companion_id
       WHERE p.id = $1`,
      [comment.author_pet_id, comment.sent_as_owner]
    );

    res.status(201).json({ ...comment, ...authorData.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creating comment' });
  }
});

// DELETE /api/posts/companions/:companion_id/gallery/:image_id/comments/:comment_id
router.delete('/companions/:companion_id/gallery/:image_id/comments/:comment_id', authenticate, async (req, res) => {
  try {
    const comment = await pool.query(
      'SELECT author_pet_id FROM companion_gallery_comments WHERE id = $1',
      [req.params.comment_id]
    );
    if (!comment.rows.length) return res.status(404).json({ error: 'Comment not found' });

    const pet = await pool.query(
      'SELECT companion_id FROM pets WHERE id = $1',
      [comment.rows[0].author_pet_id]
    );
    if (pet.rows[0].companion_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await pool.query('DELETE FROM companion_gallery_comments WHERE id = $1', [req.params.comment_id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error deleting comment' });
  }
});

export default router;
