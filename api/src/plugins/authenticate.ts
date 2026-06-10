import { FastifyInstance, FastifyRequest } from 'fastify';
import { verifyAccessToken } from '../lib/auth.js';
import { findUserById } from '../modules/auth/auth.service.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: { sub: string; email: string };
  }
}

export async function authenticatePlugin(app: FastifyInstance) {
  app.decorateRequest('user', null);

  app.addHook('preHandler', async (request, reply) => {
    if (request.url.startsWith('/auth') || request.url === '/health') {
      return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      reply.code(401).send({ statusCode: 401, message: 'Token ausente' });
      return;
    }

    const token = authHeader.replace('Bearer ', '');
    const payload = verifyAccessToken(token);
    if (!payload || typeof payload.sub !== 'string') {
      reply.code(401).send({ statusCode: 401, message: 'Token inválido' });
      return;
    }

    const user = await findUserById(payload.sub);
    if (!user) {
      reply.code(401).send({ statusCode: 401, message: 'Usuário não encontrado' });
      return;
    }

    request.user = { sub: user.id, email: user.email };
  });
}
