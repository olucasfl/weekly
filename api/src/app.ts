import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import fastifyCors from '@fastify/cors';
import fastifyCookie from '@fastify/cookie';

import { env } from './env.js';
import { verifyAccessToken } from './lib/auth.js';
import { prisma } from './lib/prisma.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { findUserById } from './modules/auth/auth.service.js';
import { categoriesRoutes } from './modules/categories/categories.routes.js';
import { tasksRoutes } from './modules/tasks/tasks.routes.js';
import { weekRoutes } from './modules/week/week.routes.js';
import { completionsRoutes } from './modules/completions/completions.routes.js';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes.js';
import { pushRoutes } from './modules/push/push.routes.js';
import { notesRoutes } from './modules/notes/notes.routes.js';

export async function buildApp() {
  const app = Fastify({ logger: true });
  app.withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(fastifyCookie);
  await app.register(fastifyCors, { origin: env.CORS_ORIGIN.split(',') });

  app.decorateRequest('user', null);
  const PUBLIC_PATHS = new Set([
    '/auth/login',
    '/auth/register',
    '/auth/verify-email',
    '/auth/resend-verification',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/refresh',
    '/auth/verify-email-change',
    '/health',
  ]);

  app.addHook('preHandler', async (request, reply) => {
    if (PUBLIC_PATHS.has(request.url.split('?')[0])) {
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

  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(categoriesRoutes, { prefix: '/categories' });
  await app.register(tasksRoutes, { prefix: '/tasks' });
  await app.register(weekRoutes, { prefix: '/week' });
  await app.register(completionsRoutes, { prefix: '/completions' });
  await app.register(dashboardRoutes, { prefix: '/dashboard' });
  await app.register(pushRoutes, { prefix: '/push' });
  await app.register(notesRoutes, { prefix: '/notes' });

  app.setErrorHandler((error, request, reply) => {
    app.log.error(error);
    reply.code(error.statusCode ?? 500).send({
      statusCode: error.statusCode ?? 500,
      message: error.message ?? 'Erro inesperado',
    });
  });

  app.get('/health', async () => {
    const result = (await prisma.$queryRawUnsafe('SELECT 1 as ok')) as Array<{ ok: number }>;
    return { ok: true, db: result[0]?.ok === 1 };
  });

  return app;
}

export default buildApp;
