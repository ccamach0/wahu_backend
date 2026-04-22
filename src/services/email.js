import nodemailer from 'nodemailer';

const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const FROM = process.env.SMTP_FROM || 'Wahu 🐾 <noreply@wahu.pet>';

const createTransporter = () => {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
};

export const sendVerificationEmail = async (email, name, token) => {
  const link = `${APP_URL}/verify?token=${token}`;

  if (!process.env.SMTP_HOST) {
    console.log('\n📧 [DEV] Email de verificación:');
    console.log(`   Para: ${email}`);
    console.log(`   Link: ${link}\n`);
    return;
  }

  const transporter = createTransporter();
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: '¡Bienvenido a Wahu! Verifica tu cuenta 🐾',
    html: `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#FFF5F0;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#FF6B35,#FF8A50);padding:36px 40px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:28px;font-weight:800;letter-spacing:-0.5px;">Wahu 🐾</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">La red social para mascotas</p>
    </div>
    <div style="padding:36px 40px;">
      <h2 style="margin:0 0 8px;color:#1a1a2e;font-size:20px;font-weight:700;">¡Hola, ${name}!</h2>
      <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 28px;">
        Gracias por unirte a Wahu. Para activar tu cuenta y comenzar a conectar con mascotas de todo el mundo, confirma tu email haciendo clic en el botón de abajo.
      </p>
      <div style="text-align:center;margin-bottom:28px;">
        <a href="${link}" style="display:inline-block;background:#FF6B35;color:#fff;font-weight:700;font-size:16px;text-decoration:none;padding:14px 36px;border-radius:12px;">
          Verificar mi cuenta
        </a>
      </div>
      <p style="color:#9ca3af;font-size:13px;line-height:1.5;margin:0;">
        Este enlace expira en <strong>24 horas</strong>. Si no creaste una cuenta en Wahu, puedes ignorar este email.
      </p>
    </div>
    <div style="padding:20px 40px;background:#FFF5F0;text-align:center;">
      <p style="margin:0;color:#d1a58a;font-size:12px;">© 2024 Wahu · La red social para mascotas</p>
    </div>
  </div>
</body>
</html>`,
  });
};
