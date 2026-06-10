import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { loginUser, refreshAccessToken, registerUser, findUserById } from './auth.service.js';

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
      return reply.code(400).send({ statusCode: 400, message: error instanceof Error ? error.message : 'Erro ao registrar' });
    }
  });

  app.post('/login', async (request, reply) => {
    try {
      const body = loginInputSchema.parse(request.body);
      const result = await loginUser(body);
      return reply.send(result);
    } catch (error) {
      return reply.code(401).send({ statusCode: 401, message: error instanceof Error ? error.message : 'Erro de login' });
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
    if (!userId) {
      return reply.code(401).send({ statusCode: 401, message: 'Não autenticado' });
    }

    const user = await findUserById(userId);
    if (!user) {
      return reply.code(404).send({ statusCode: 404, message: 'Usuário não encontrado' });
    }

    return reply.send(user);
  });
};
