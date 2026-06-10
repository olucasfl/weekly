import crypto from 'crypto';
import { prisma } from '../../lib/prisma.js';
import { createAccessToken, createRefreshToken, hashPassword, verifyPassword, verifyRefreshToken } from '../../lib/auth.js';
import { sendVerificationEmail, sendPasswordResetEmail, sendEmailChangeVerification } from '../../lib/email.js';

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  password: string;
};

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

export async function registerUser(input: { name: string; email: string; password: string }) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new Error('Email já cadastrado');
  }

  const verificationToken = generateToken();

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      password: await hashPassword(input.password),
      emailVerified: false,
      verificationToken,
    },
  });

  await sendVerificationEmail(user.email, user.name, verificationToken);

  return { id: user.id, name: user.name, email: user.email };
}

export async function verifyEmail(token: string) {
  const user = await prisma.user.findUnique({ where: { verificationToken: token } });
  if (!user) {
    throw new Error('Link inválido ou expirado');
  }

  if (!user.emailVerified) {
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });
  }

  return { success: true };
}

export async function loginUser(input: { email: string; password: string }) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    throw new Error('Credenciais inválidas');
  }

  const valid = await verifyPassword(input.password, user.password);
  if (!valid) {
    throw new Error('Credenciais inválidas');
  }

  if (!user.emailVerified) {
    throw new Error('EMAIL_NOT_VERIFIED');
  }

  const accessToken = createAccessToken({ sub: user.id, email: user.email });
  const refreshToken = createRefreshToken({ sub: user.id });

  return {
    user: { id: user.id, name: user.name, email: user.email },
    accessToken,
    refreshToken,
  };
}

export async function resendVerification(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.emailVerified) return; // silencioso por segurança

  const verificationToken = generateToken();
  await prisma.user.update({ where: { id: user.id }, data: { verificationToken } });
  await sendVerificationEmail(user.email, user.name, verificationToken);
}

export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return; // silencioso por segurança — não revela se email existe

  const resetToken = generateToken();
  const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken, resetTokenExpiry },
  });

  await sendPasswordResetEmail(user.email, user.name, resetToken);
}

export async function resetPassword(token: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { resetToken: token } });

  if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
    throw new Error('Link inválido ou expirado');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await hashPassword(newPassword),
      resetToken: null,
      resetTokenExpiry: null,
    },
  });

  return { success: true };
}

export async function refreshAccessToken(refreshToken: string) {
  const payload = verifyRefreshToken(refreshToken);
  if (!payload || typeof payload.sub !== 'string') {
    throw new Error('Refresh token inválido');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) {
    throw new Error('Usuário não encontrado');
  }

  const accessToken = createAccessToken({ sub: user.id, email: user.email });
  return { accessToken };
}

export async function findUserById(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return null;
  return { id: user.id, name: user.name, email: user.email, pendingEmail: user.pendingEmail ?? null };
}

export async function updateProfile(userId: string, input: { name?: string; email?: string }) {
  const current = await prisma.user.findUnique({ where: { id: userId } });
  if (!current) throw new Error('Usuário não encontrado');

  const data: Record<string, unknown> = {};

  // Name: update immediately
  if (input.name && input.name !== current.name) {
    data.name = input.name;
  }

  // Email: initiate pending verification flow
  if (input.email && input.email !== current.email) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new Error('Email já está em uso');

    const pendingEmailToken = generateToken();
    data.pendingEmail = input.email;
    data.pendingEmailToken = pendingEmailToken;
    data.pendingEmailExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    const updatedName = (input.name ?? current.name);
    await prisma.user.update({ where: { id: userId }, data });
    await sendEmailChangeVerification(input.email, updatedName, pendingEmailToken);

    const updated = await prisma.user.findUnique({ where: { id: userId } });
    return {
      id: updated!.id,
      name: updated!.name,
      email: updated!.email,
      pendingEmail: updated!.pendingEmail ?? null,
      emailChangePending: true,
    };
  }

  const user = await prisma.user.update({ where: { id: userId }, data });
  return { id: user.id, name: user.name, email: user.email, pendingEmail: user.pendingEmail ?? null, emailChangePending: false };
}

export async function verifyEmailChange(token: string) {
  const user = await prisma.user.findUnique({ where: { pendingEmailToken: token } });
  if (!user || !user.pendingEmail) throw new Error('Link inválido ou expirado');
  if (!user.pendingEmailExpiry || user.pendingEmailExpiry < new Date()) throw new Error('Link inválido ou expirado');

  const alreadyTaken = await prisma.user.findUnique({ where: { email: user.pendingEmail } });
  if (alreadyTaken && alreadyTaken.id !== user.id) throw new Error('Este email já está sendo usado por outra conta');

  await prisma.user.update({
    where: { id: user.id },
    data: { email: user.pendingEmail, pendingEmail: null, pendingEmailToken: null, pendingEmailExpiry: null },
  });
  return { success: true };
}

export async function cancelEmailChange(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { pendingEmail: null, pendingEmailToken: null, pendingEmailExpiry: null },
  });
  return { success: true };
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('Usuário não encontrado');
  const valid = await verifyPassword(currentPassword, user.password);
  if (!valid) throw new Error('Senha atual incorreta');
  await prisma.user.update({
    where: { id: userId },
    data: { password: await hashPassword(newPassword) },
  });
  return { success: true };
}

export async function deleteAccount(userId: string) {
  await prisma.user.delete({ where: { id: userId } });
  return { success: true };
}
