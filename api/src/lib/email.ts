import { env } from '../env.js';

async function sendEmail(to: string, toName: string, subject: string, html: string) {
  if (!env.BREVO_API_KEY || !env.BREVO_SENDER_EMAIL) {
    console.warn('[email] Brevo not configured — skipping send');
    return;
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': env.BREVO_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: env.BREVO_SENDER_NAME, email: env.BREVO_SENDER_EMAIL },
      to: [{ email: to, name: toName }],
      subject,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('[email] Brevo error:', res.status, body);
    throw new Error('Falha ao enviar email');
  }
}

export async function sendVerificationEmail(to: string, name: string, token: string) {
  const link = `${env.APP_URL}/verificar-email?token=${token}`;
  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;background:#f7f6fc;padding:32px 16px;">
      <div style="background:#fff;border-radius:20px;padding:36px 32px;box-shadow:0 4px 24px rgba(114,85,224,0.10);">
        <div style="text-align:center;margin-bottom:28px;">
          <div style="display:inline-block;background:linear-gradient(135deg,#7255e0,#a78bfa);border-radius:16px;padding:14px 18px;margin-bottom:12px;">
            <span style="font-size:28px;">📅</span>
          </div>
          <h1 style="font-size:22px;font-weight:800;color:#18141f;margin:0;letter-spacing:-0.03em;">Weekly</h1>
        </div>

        <h2 style="font-size:18px;font-weight:700;color:#18141f;margin:0 0 10px;">Olá, ${name}!</h2>
        <p style="color:#4e4868;font-size:15px;line-height:1.6;margin:0 0 28px;">
          Clique no botão abaixo para verificar seu email e ativar sua conta Weekly.
          O link expira em <strong>24 horas</strong>.
        </p>

        <div style="text-align:center;margin-bottom:28px;">
          <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#7255e0,#a78bfa);color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 32px;border-radius:999px;letter-spacing:-0.01em;">
            Verificar email
          </a>
        </div>

        <p style="color:#9189a8;font-size:12px;text-align:center;margin:0;">
          Se não criou uma conta, ignore este email.<br/>
          <a href="${link}" style="color:#7255e0;word-break:break-all;">${link}</a>
        </p>
      </div>
    </div>
  `;
  await sendEmail(to, name, 'Verifique seu email — Weekly', html);
}

export async function sendEmailChangeVerification(to: string, name: string, token: string) {
  const link = `${env.APP_URL}/verificar-troca-email?token=${token}`;
  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;background:#f7f6fc;padding:32px 16px;">
      <div style="background:#fff;border-radius:20px;padding:36px 32px;box-shadow:0 4px 24px rgba(114,85,224,0.10);">
        <div style="text-align:center;margin-bottom:28px;">
          <div style="display:inline-block;background:linear-gradient(135deg,#7255e0,#a78bfa);border-radius:16px;padding:14px 18px;margin-bottom:12px;">
            <span style="font-size:28px;">✉️</span>
          </div>
          <h1 style="font-size:22px;font-weight:800;color:#18141f;margin:0;letter-spacing:-0.03em;">Weekly</h1>
        </div>
        <h2 style="font-size:18px;font-weight:700;color:#18141f;margin:0 0 10px;">Confirme o novo email</h2>
        <p style="color:#4e4868;font-size:15px;line-height:1.6;margin:0 0 28px;">
          Olá, ${name}! Você solicitou a troca de email na sua conta Weekly.<br/>
          Clique no botão abaixo para confirmar este endereço. O link expira em <strong>1 hora</strong>.
        </p>
        <div style="text-align:center;margin-bottom:28px;">
          <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#7255e0,#a78bfa);color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 32px;border-radius:999px;letter-spacing:-0.01em;">
            Confirmar novo email
          </a>
        </div>
        <p style="color:#9189a8;font-size:12px;text-align:center;margin:0;">
          Se não foi você quem solicitou, ignore este email — seu email atual permanece o mesmo.<br/>
          <a href="${link}" style="color:#7255e0;word-break:break-all;">${link}</a>
        </p>
      </div>
    </div>
  `;
  await sendEmail(to, name, 'Confirme seu novo email — Weekly', html);
}

export async function sendPasswordResetEmail(to: string, name: string, token: string) {
  const link = `${env.APP_URL}/redefinir-senha?token=${token}`;
  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;background:#f7f6fc;padding:32px 16px;">
      <div style="background:#fff;border-radius:20px;padding:36px 32px;box-shadow:0 4px 24px rgba(114,85,224,0.10);">
        <div style="text-align:center;margin-bottom:28px;">
          <div style="display:inline-block;background:linear-gradient(135deg,#7255e0,#a78bfa);border-radius:16px;padding:14px 18px;margin-bottom:12px;">
            <span style="font-size:28px;">🔑</span>
          </div>
          <h1 style="font-size:22px;font-weight:800;color:#18141f;margin:0;letter-spacing:-0.03em;">Weekly</h1>
        </div>

        <h2 style="font-size:18px;font-weight:700;color:#18141f;margin:0 0 10px;">Redefinição de senha</h2>
        <p style="color:#4e4868;font-size:15px;line-height:1.6;margin:0 0 28px;">
          Olá, ${name}! Recebemos uma solicitação para redefinir a senha da sua conta.<br/>
          O link expira em <strong>1 hora</strong>. Se não foi você, ignore este email.
        </p>

        <div style="text-align:center;margin-bottom:28px;">
          <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#7255e0,#a78bfa);color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 32px;border-radius:999px;letter-spacing:-0.01em;">
            Redefinir senha
          </a>
        </div>

        <p style="color:#9189a8;font-size:12px;text-align:center;margin:0;">
          <a href="${link}" style="color:#7255e0;word-break:break-all;">${link}</a>
        </p>
      </div>
    </div>
  `;
  await sendEmail(to, name, 'Redefinição de senha — Weekly', html);
}
