import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../env.js';

export const pushRoutes: FastifyPluginAsync = async (app) => {
  app.get('/public-key', async () => ({ publicKey: env.VAPID_PUBLIC_KEY }));

  app.post('/subscribe', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) return reply.code(401).send({ statusCode: 401, message: 'Não autenticado' });

    const { endpoint, p256dh, auth, timezone } = z.object({
      endpoint: z.string(),
      p256dh: z.string(),
      auth: z.string(),
      timezone: z.string().default('UTC'),
    }).parse(request.body);

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { userId, endpoint, p256dh, auth, timezone },
      update: { userId, p256dh, auth, timezone },
    });

    return reply.code(201).send({ ok: true });
  });

  app.delete('/subscribe', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) return reply.code(401).send({ statusCode: 401, message: 'Não autenticado' });

    const { endpoint } = z.object({ endpoint: z.string() }).parse(request.body);
    await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
    return { ok: true };
  });
};
