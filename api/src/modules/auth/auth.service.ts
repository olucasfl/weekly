import { prisma } from '../../lib/prisma.js';
import { createAccessToken, createRefreshToken, hashPassword, verifyPassword, verifyRefreshToken } from '../../lib/auth.js';

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  password: string;
};

export async function registerUser(input: { name: string; email: string; password: string }) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new Error('Email já cadastrado');
  }

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      password: await hashPassword(input.password),
    },
  });

  return { id: user.id, name: user.name, email: user.email };
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

  const accessToken = createAccessToken({ sub: user.id, email: user.email });
  const refreshToken = createRefreshToken({ sub: user.id });

  return {
    user: { id: user.id, name: user.name, email: user.email },
    accessToken,
    refreshToken,
  };
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
  if (!user) {
    return null;
  }

  return { id: user.id, name: user.name, email: user.email };
}
