import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  loginUser,
  refreshAccessToken,
  registerUser,
  findUserById,
  verifyEmail,
  forgotPassword,
  resetPassword,
  resendVerification,
} from './auth.service.js';

const registerInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/register', async (request, reply) => {
    try {
      const body = registerInputSchema.parse(request.body);
      const user = await registerUser(body);
      return reply.code(201).send(user);
    } catch (error) {
      const msg = error instanceof Error ? error.message : '';
      const safe = msg === 'Email já cadastrado' ? msg : 'Erro ao criar conta. Tente novamente.';
      return reply.code(400).send({ statusCode: 400, message: safe });
    }
  });

  app.post('/login', async (request, reply) => {
    try {
      const body = loginInputSchema.parse(request.body);
      const result = await loginUser(body);
      return reply.send(result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : '';
      if (msg === 'EMAIL_NOT_VERIFIED') {
        return reply.code(403).send({ statusCode: 403, message: 'EMAIL_NOT_VERIFIED' });
      }
      if (msg === 'Credenciais inválidas') {
        return reply.code(401).send({ statusCode: 401, message: 'Credenciais inválidas' });
      }
      // Não expõe erros internos (Prisma, etc.)
      return reply.code(500).send({ statusCode: 500, message: 'Erro interno. Tente novamente.' });
    }
  });

  app.post('/refresh', async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken?: string };
    try {
      const result = await refreshAccessToken(refreshToken ?? '');
      return reply.send(result);
    } catch (error) {
      return reply.code(401).send({ statusCode: 401, message: error instanceof Error ? error.message : 'Refresh inválido' });
    }
  });

  app.get('/me', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) return reply.code(401).send({ statusCode: 401, message: 'Não autenticado' });
    const user = await findUserById(userId);
    if (!user) return reply.code(404).send({ statusCode: 404, message: 'Usuário não encontrado' });
    return reply.send(user);
  });

  // Verificação de email
  app.get('/verify-email', async (request, reply) => {
    const { token } = request.query as { token?: string };
    if (!token) return reply.code(400).send({ statusCode: 400, message: 'Token ausente' });
    try {
      await verifyEmail(token);
      return reply.send({ success: true });
    } catch (error) {
      return reply.code(400).send({ statusCode: 400, message: error instanceof Error ? error.message : 'Erro' });
    }
  });

  app.post('/resend-verification', async (request, reply) => {
    const { email } = request.body as { email?: string };
    if (!email) return reply.code(400).send({ statusCode: 400, message: 'Email ausente' });
    await resendVerification(email);
    return reply.send({ success: true });
  });

  // Redefinição de senha
  app.post('/forgot-password', async (request, reply) => {
    const { email } = request.body as { email?: string };
    if (!email) return reply.code(400).send({ statusCode: 400, message: 'Email ausente' });
    await forgotPassword(email);
    return reply.send({ success: true });
  });

  app.post('/reset-password', async (request, reply) => {
    const { token, password } = request.body as { token?: string; password?: string };
    if (!token || !password) return reply.code(400).send({ statusCode: 400, message: 'Dados ausentes' });
    if (password.length < 6) return reply.code(400).send({ statusCode: 400, message: 'Senha muito curta' });
    try {
      await resetPassword(token, password);
      return reply.send({ success: true });
    } catch (error) {
      const msg = error instanceof Error ? error.message : '';
      const safe = msg === 'Link inválido ou expirado' ? msg : 'Erro ao redefinir senha. Tente novamente.';
      return reply.code(400).send({ statusCode: 400, message: safe });
    }
  });
};
