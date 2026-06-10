import crypto from 'crypto';
import { prisma } from '../../lib/prisma.js';
import { createAccessToken, createRefreshToken, hashPassword, verifyPassword, verifyRefreshToken } from '../../lib/auth.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../../lib/email.js';

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
  return { id: user.id, name: user.name, email: user.email };
}
