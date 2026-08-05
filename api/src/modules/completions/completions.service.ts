import { prisma } from '../../lib/prisma.js';

function mondayOfDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (day + 6) % 7);
  return d.toISOString().slice(0, 10);
}

// Advances (or reverts) the progress of any goal linked to the completed task's category,
// for the week the occurrence falls in — so finishing a routine in a category with an active
// goal moves that goal forward without the user having to open the Metas screen at all.
async function syncGoalProgress(userId: string, taskId: string, date: string, delta: 1 | -1) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { categoryId: true } });
  if (!task?.categoryId) return;

  const weekStart = mondayOfDate(date);
  const goals = await prisma.goal.findMany({
    where: { userId, categoryId: task.categoryId, OR: [{ weekStart: null }, { weekStart }] },
    include: { progresses: { where: { userId, weekStart } } },
  });

  for (const goal of goals) {
    const current = goal.progresses[0]?.count ?? 0;
    const next = Math.max(0, Math.min(current + delta, goal.target));
    if (next === current) continue;
    await prisma.$executeRaw`
      INSERT INTO "GoalProgress" ("id", "userId", "goalId", "weekStart", "count")
      VALUES (${crypto.randomUUID()}, ${userId}, ${goal.id}, ${weekStart}, ${next})
      ON CONFLICT ("userId", "goalId", "weekStart") DO UPDATE SET "count" = ${next}
    `;
  }
}

export async function markCompletion(
  userId: string,
  taskId: string,
  date: string,
  done: boolean,
  options: { resetSteps?: boolean } = {},
) {
  const { resetSteps = true } = options;
  // Task com checklist só pode ser marcada como feita quando todas as etapas daquele dia
  // já estiverem concluídas — protege tanto o fluxo de step (toggleStepCompletion) quanto
  // quem chamar PUT /completions direto tentando pular o checklist.
  if (done) {
    const steps = await prisma.taskStep.findMany({ where: { taskId }, select: { id: true } });
    if (steps.length > 0) {
      const stepCompletions = await prisma.stepCompletion.findMany({
        where: { userId, date, taskStepId: { in: steps.map((s) => s.id) } },
        select: { taskStepId: true, done: true },
      });
      const doneIds = new Set(stepCompletions.filter((c) => c.done).map((c) => c.taskStepId));
      const allStepsDone = steps.every((s) => doneIds.has(s.id));
      if (!allStepsDone) {
        throw new Error('Conclua todas as etapas primeiro');
      }
    }
  }

  const existing = await prisma.completion.findUnique({
    where: { userId_taskId_date: { userId, taskId, date } },
  });
  const wasDone = existing?.done ?? false;

  const completion = await prisma.completion.upsert({
    where: { userId_taskId_date: { userId, taskId, date } },
    create: { userId, taskId, date, done, skipped: false },
    update: { done },
  });

  // Only sync on an actual flip — repeated calls with the same value (e.g. a retried
  // request) must not double-count the linked goal's progress.
  if (done !== wasDone) {
    await syncGoalProgress(userId, taskId, date, done ? 1 : -1);
  }

  // Desfazer o "feito" também desfaz as etapas — senão o badge de progresso do checklist
  // fica inconsistente com o estado "não feito" do pai. No-op quando a task não tem etapas.
  // resetSteps=false quando quem chamou foi toggleStepCompletion: ali o pai só está virando
  // "não feito" como efeito colateral de UMA etapa ter sido desmarcada, então as outras etapas
  // não podem ser resetadas junto (senão desmarcar 1 de N etapas desmarcava todas as N).
  if (!done && resetSteps) {
    await prisma.stepCompletion.updateMany({
      where: { userId, date, taskStep: { taskId } },
      data: { done: false },
    });
  }

  return completion;
}

export async function skipOccurrence(userId: string, taskId: string, date: string, skipped: boolean) {
  return prisma.completion.upsert({
    where: { userId_taskId_date: { userId, taskId, date } },
    create: { userId, taskId, date, done: false, skipped },
    update: { skipped },
  });
}

export async function getCompletionsForRange(userId: string, from: string, to: string) {
  return prisma.completion.findMany({
    where: { userId, date: { gte: from, lte: to } },
  });
}

export async function getStepCompletionsForRange(userId: string, from: string, to: string) {
  return prisma.stepCompletion.findMany({
    where: { userId, date: { gte: from, lte: to } },
  });
}

export async function toggleStepCompletion(userId: string, taskId: string, stepId: string, date: string, done: boolean) {
  const step = await prisma.taskStep.findFirst({ where: { id: stepId, taskId, userId } });
  if (!step) throw new Error('Etapa não encontrada');

  await prisma.stepCompletion.upsert({
    where: { userId_taskStepId_date: { userId, taskStepId: stepId, date } },
    create: { userId, taskStepId: stepId, date, done },
    update: { done },
  });

  const allSteps = await prisma.taskStep.findMany({ where: { taskId }, select: { id: true } });
  const stepCompletions = await prisma.stepCompletion.findMany({
    where: { userId, date, taskStepId: { in: allSteps.map((s) => s.id) } },
    select: { taskStepId: true, done: true },
  });
  const doneIds = new Set(stepCompletions.filter((c) => c.done).map((c) => c.taskStepId));
  const allDone = allSteps.length > 0 && allSteps.every((s) => doneIds.has(s.id));

  const existingCompletion = await prisma.completion.findUnique({
    where: { userId_taskId_date: { userId, taskId, date } },
  });
  const wasDone = existingCompletion?.done ?? false;
  if (allDone !== wasDone) {
    await markCompletion(userId, taskId, date, allDone, { resetSteps: false });
  }

  return { success: true, allDone };
}
