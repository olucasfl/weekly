import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { addExtraOccurrence, createTask, deleteTask, listTasks, updateTask } from './tasks.service.js';

const taskInputSchema = z.object({
  title: z.string().min(1),
  type: z.enum(['RECURRING', 'SCHEDULED']),
  weekdays: z.array(z.number().int().min(0).max(6)).default([]),
  date: z.string().optional(),
  endDate: z.string().nullable().optional(),
  startTime: z.string().min(1),
  endTime: z.string().optional(),
  reminder: z.boolean().default(true),
  reminderMin: z.number().int().default(60),
  categoryId: z.string().nullable().optional(),
  active: z.boolean().default(true),
  notes: z.string().optional(),
  recurrenceType: z.enum(['weekly', 'biweekly', 'monthly_date', 'monthly_weekday']).default('weekly'),
  biweeklyAnchor: z.string().nullable().optional(),
  monthlyDay: z.number().int().min(1).max(31).nullable().optional(),
  monthlyWeekday: z.number().int().min(0).max(6).nullable().optional(),
  monthlyWeek: z.number().int().nullable().optional(),
});

export const tasksRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      return reply.code(401).send({ statusCode: 401, message: 'Não autenticado' });
    }

    const type = (request.query as { type?: string }).type;
    const taskType = type === 'recurring' ? 'RECURRING' : type === 'scheduled' ? 'SCHEDULED' : undefined;
    return listTasks(userId, taskType, false);
  });

  app.post('/', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      return reply.code(401).send({ statusCode: 401, message: 'Não autenticado' });
    }

    try {
      const task = await createTask(userId, taskInputSchema.parse(request.body));
      return reply.code(201).send(task);
    } catch (error) {
      return reply.code(400).send({ statusCode: 400, message: error instanceof Error ? error.message : 'Erro ao criar tarefa' });
    }
  });

  app.patch('/:id', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      return reply.code(401).send({ statusCode: 401, message: 'Não autenticado' });
    }

    try {
      const task = await updateTask(userId, (request.params as { id: string }).id, taskInputSchema.partial().parse(request.body));
      return reply.send(task);
    } catch (error) {
      return reply.code(404).send({ statusCode: 404, message: error instanceof Error ? error.message : 'Erro ao atualizar tarefa' });
    }
  });

  app.delete('/:id', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      return reply.code(401).send({ statusCode: 401, message: 'Não autenticado' });
    }

    try {
      const result = await deleteTask(userId, (request.params as { id: string }).id);
      return reply.send(result);
    } catch (error) {
      return reply.code(404).send({ statusCode: 404, message: error instanceof Error ? error.message : 'Erro ao apagar tarefa' });
    }
  });

  app.post('/:id/extra-days', async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) return reply.code(401).send({ statusCode: 401, message: 'Não autenticado' });
    try {
      const { date } = z.object({ date: z.string() }).parse(request.body);
      const result = await addExtraOccurrence(userId, (request.params as { id: string }).id, date);
      return reply.send(result);
    } catch (error) {
      return reply.code(400).send({ statusCode: 400, message: error instanceof Error ? error.message : 'Erro ao adicionar ocorrência' });
    }
  });
};
