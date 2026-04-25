import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import pool from '../config/db.js';
import { sendVerificationEmail } from '../services/email.js';

const router = Router();

const makeToken = (user) =>
  jwt.sign({ id: user.id, username: user.username, name: user.name }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const formatUser = (u) => ({
  id: u.id,
  username: u.username,
  name: u.name,
  email: u.email,
  avatar_url: u.avatar_url || null,
  croquetas: u.croquetas || 0,
  active_pet_id: u.active_pet_id || null,
});

router.post('/register', async (req, res) => {
  const { username, name, email, password } = req.body;
  if (!username || !name || !email || !password)
    return res.status(400).json({ error: 'Todos los campos son requeridos' });

  try {
    const exists = await pool.query(
      'SELECT id FROM companions WHERE email=$1 OR username=$2',
      [email, username]
    );
    if (exists.rows.length > 0)
      return res.status(409).json({ error: 'Email o username ya registrado' });

    const hash = await bcrypt.hash(password, 10);
    const id = uuidv4();
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO companions (id, username, name, email, password_hash, email_verified, verification_token, verification_token_expires_at)
       VALUES ($1,$2,$3,$4,$5,false,$6,$7)`,
      [id, username, name, email, hash, token, expires]
    );
    await pool.query(
      'INSERT INTO companion_croquetas (companion_id, balance) VALUES ($1, 0)',
      [id]
    );

    await sendVerificationEmail(email, name, token);

    res.status(201).json({ message: 'Cuenta creada. Revisa tu email para verificar tu cuenta.', email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email y contraseña requeridos' });

  try {
    const result = await pool.query(
      'SELECT c.*, cc.balance as croquetas FROM companions c LEFT JOIN companion_croquetas cc ON c.id = cc.companion_id WHERE c.email=$1',
      [email]
    );
    if (result.rows.length === 0)
      return res.status(401).json({ error: 'Credenciales incorrectas' });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)
      return res.status(401).json({ error: 'Credenciales incorrectas' });

    if (!user.email_verified)
      return res.status(403).json({ error: 'Debes verificar tu email antes de ingresar.', code: 'EMAIL_NOT_VERIFIED', email });

    res.json({ token: makeToken(user), user: formatUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

router.get('/verify/:token', async (req, res) => {
  const { token } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM companions WHERE verification_token=$1 AND verification_token_expires_at > NOW()',
      [token]
    );
    if (result.rows.length === 0)
      return res.status(400).json({ error: 'Token inválido o expirado' });

    const user = result.rows[0];
    await pool.query(
      'UPDATE companions SET email_verified=true, verification_token=NULL, verification_token_expires_at=NULL WHERE id=$1',
      [user.id]
    );

    const croquetas = await pool.query('SELECT balance FROM companion_croquetas WHERE companion_id=$1', [user.id]);
    user.croquetas = croquetas.rows[0]?.balance || 0;

    res.json({ token: makeToken(user), user: formatUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al verificar' });
  }
});

router.post('/resend-verification', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requerido' });

  try {
    const result = await pool.query('SELECT * FROM companions WHERE email=$1', [email]);
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Usuario no encontrado' });

    const user = result.rows[0];
    if (user.email_verified)
      return res.status(400).json({ error: 'El email ya está verificado' });

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await pool.query(
      'UPDATE companions SET verification_token=$1, verification_token_expires_at=$2 WHERE id=$3',
      [token, expires, user.id]
    );

    await sendVerificationEmail(email, user.name, token);

    res.json({ message: 'Email de verificación reenviado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al reenviar verificación' });
  }
});

router.post('/google', async (req, res) => {
  const { access_token } = req.body;
  if (!access_token)
    return res.status(400).json({ error: 'Token de Google requerido' });

  try {
    const googleRes = await fetch(
      `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${access_token}`
    );
    if (!googleRes.ok)
      return res.status(401).json({ error: 'Token de Google inválido' });

    const { email, name, picture } = await googleRes.json();
    if (!email)
      return res.status(401).json({ error: 'No se pudo obtener el email de Google' });

    let result = await pool.query(
      'SELECT c.*, cc.balance as croquetas FROM companions c LEFT JOIN companion_croquetas cc ON c.id=cc.companion_id WHERE c.email=$1',
      [email]
    );

    let user;
    if (result.rows.length > 0) {
      user = result.rows[0];
      if (!user.avatar_url && picture) {
        await pool.query('UPDATE companions SET avatar_url=$1 WHERE id=$2', [picture, user.id]);
        user.avatar_url = picture;
      }
      // Google login always marks email as verified
      if (!user.email_verified) {
        await pool.query('UPDATE companions SET email_verified=true WHERE id=$1', [user.id]);
      }
    } else {
      const id = uuidv4();
      const username = email.split('@')[0].replace(/[^a-z0-9_]/gi, '_').toLowerCase().slice(0, 30);
      const usernameExists = await pool.query('SELECT id FROM companions WHERE username=$1', [username]);
      const finalUsername = usernameExists.rows.length > 0 ? `${username}_${Date.now().toString().slice(-4)}` : username;

      await pool.query(
        `INSERT INTO companions (id, username, name, email, avatar_url, password_hash, email_verified)
         VALUES ($1,$2,$3,$4,$5,$6,true)`,
        [id, finalUsername, name, email, picture || null, await bcrypt.hash(uuidv4(), 10)]
      );
      await pool.query('INSERT INTO companion_croquetas (companion_id, balance) VALUES ($1, 0)', [id]);
      user = { id, username: finalUsername, name, email, avatar_url: picture || null, croquetas: 0 };
    }

    res.json({ token: makeToken(user), user: formatUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al autenticar con Google' });
  }
});

router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No autorizado' });
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await pool.query(
      'SELECT c.id, c.username, c.name, c.email, c.avatar_url, c.active_pet_id, cc.balance as croquetas FROM companions c LEFT JOIN companion_croquetas cc ON c.id=cc.companion_id WHERE c.id=$1',
      [decoded.id]
    );
    res.json(formatUser(result.rows[0]));
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
});

router.put('/active-pet', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No autorizado' });
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { pet_id } = req.body;

    // Verificar que la mascota pertenece al usuario
    if (pet_id) {
      const check = await pool.query('SELECT id FROM pets WHERE id=$1 AND companion_id=$2', [pet_id, decoded.id]);
      if (check.rows.length === 0)
        return res.status(403).json({ error: 'Mascota no pertenece al usuario' });
    }

    await pool.query('UPDATE companions SET active_pet_id=$1 WHERE id=$2', [pet_id || null, decoded.id]);
    res.json({ ok: true });
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
});

router.get('/has-password', async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader)
    return res.status(401).json({ error: 'Token requerido' });

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await pool.query('SELECT password_hash FROM companions WHERE id=$1', [decoded.id]);
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Usuario no encontrado' });

    const hasPassword = !!result.rows[0].password_hash;
    res.json({ hasPassword });
  } catch (err) {
    if (err.name === 'JsonWebTokenError')
      return res.status(401).json({ error: 'Token inválido' });
    console.error(err);
    res.status(500).json({ error: 'Error al verificar' });
  }
});

router.put('/change-password', async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const authHeader = req.headers.authorization;

  if (!authHeader)
    return res.status(401).json({ error: 'Token requerido' });

  if (!newPassword)
    return res.status(400).json({ error: 'La nueva contraseña es requerida' });

  if (newPassword.length < 6)
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Obtener usuario actual
    const result = await pool.query('SELECT password_hash FROM companions WHERE id=$1', [decoded.id]);
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Usuario no encontrado' });

    const user = result.rows[0];

    // Si el usuario tiene contraseña (no se registró con Google), validar la contraseña actual
    if (user.password_hash) {
      if (!currentPassword)
        return res.status(400).json({ error: 'La contraseña actual es requerida' });

      const valid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!valid)
        return res.status(401).json({ error: 'Contraseña actual incorrecta' });
    }

    // Hash nueva contraseña
    const newHash = await bcrypt.hash(newPassword, 10);

    // Actualizar contraseña
    await pool.query('UPDATE companions SET password_hash=$1 WHERE id=$2', [newHash, decoded.id]);

    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    if (err.name === 'JsonWebTokenError')
      return res.status(401).json({ error: 'Token inválido' });
    console.error(err);
    res.status(500).json({ error: 'Error al cambiar contraseña' });
  }
});

export default router;
