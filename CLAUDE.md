# Weekly — Spec (índice)

Fonte de verdade do monorepo. **Deploys são separados** (web→Vercel, api→Render/Railway/Fly) — por
isso a spec detalhada de cada pacote vive nele:

- [`api/CLAUDE.md`](api/CLAUDE.md) — backend: rotas, env vars, deploy
- [`web/CLAUDE.md`](web/CLAUDE.md) — frontend: telas, estado, client HTTP, PWA, deploy

Este arquivo só traz o que é genuinamente **compartilhado** pelos dois — não duplique rotas/telas
aqui, mantenha isso nos específicos.

## 1. Propósito

App pessoal de rotina semanal (PWA). Usuário cadastra rotinas (recorrentes) e eventos (data
única/intervalo), risca como feito/pulado, acompanha metas semanais e progresso.

## 2. Pacotes

| Pacote | Deploy | Spec |
|---|---|---|
| `api/` | Render/Railway/Fly | [api/CLAUDE.md](api/CLAUDE.md) |
| `web/` | Vercel | [web/CLAUDE.md](web/CLAUDE.md) |
| `shared/` | não publicado; importado via path alias `@shared/*` — **hoje só o `api/` de fato importa** (`recurrence.ts` em `week.service.ts`/`dashboard.service.ts`/`jobs/notifications.ts`); o alias existe no `tsconfig.json` do `web/` mas nenhuma tela o usa ainda | — (documentado abaixo) |

Sem Docker, sem Turborepo/Nx, sem npm workspaces. Rodar tudo local a partir da raiz:
`npm run dev:api` (na prática use `npm --prefix api run start:dev` — ver ressalva em
[api/CLAUDE.md](api/CLAUDE.md)) e `npm run dev:web`.

## 3. Domínio (Prisma — `api/prisma/schema.prisma`)

| Model | Campos-chave | Nota |
|---|---|---|
| User | email, password (hash), emailVerified, tokens de verificação/reset/troca-email | 1 usuário = todos os dados abaixo via `userId` |
| Task | title, type(`RECURRING`\|`SCHEDULED`), weekdays[], date, endDate, startTime/endTime, recurrenceType, biweeklyAnchor, monthlyDay, monthlyWeekday, monthlyWeek, yearlyMonth, important, countdownDays, active, deletedAt | linha única representa rotina OU evento; ocorrências são *derivadas*, não persistidas |
| ExtraOccurrence | taskId, date | dia extra adicionado manualmente a uma rotina recorrente |
| Completion | taskId, date, done, skipped | estado por ocorrência (chave `userId+taskId+date`) |
| Goal | title, target, weekStart(null=recorrente toda semana) | |
| GoalProgress | goalId, weekStart, count | contador semanal |
| Category | name, color | opcional em Task/Goal |
| Note | date, content | anotação livre por dia |
| PushSubscription | endpoint, p256dh, auth, timezone | web push (VAPID) |

`shared/src/schemas.ts` tem os Zod schemas de input (task/category/goal).

## 4. Motor de recorrência — `shared/src/recurrence.ts`

`buildWeekOccurrences(tasks, weekStart)` → expande Tasks em ocorrências (`{task, date}`) dentro de
uma semana. **Não há tabela de ocorrências no banco** — tudo é calculado on-the-fly a partir de Task
+ ExtraOccurrence. Consumido hoje só pelo backend (`GET /week`, dashboard, job de notificações). É a
peça mais delicada do projeto (histórico de bugs: âncora quinzenal resetando, rotina anual rejeitada,
mensal por dia-da-semana sumindo — ver git log).

`recurrenceType`:
- `weekly` — usa `weekdays[]` toda semana
- `biweekly` — usa `weekdays[]` + `biweeklyAnchor` (segunda-feira de referência); só ocorre em semanas pares de distância do anchor
- `monthly_date` — `monthlyDay` (dia fixo do mês, ex. dia 15)
- `monthly_weekday` — `monthlyWeekday` + `monthlyWeek` (ex. "3ª segunda-feira"; `monthlyWeek=-1` = última ocorrência do mês)
- `yearly` — `monthlyDay` + `yearlyMonth`

`type: SCHEDULED` com `date` (+ opcional `endDate` para evento multi-dia) = evento pontual, não usa `recurrenceType`.

`deletedAt` = soft-delete a partir de uma data (ocorrências antes dela continuam existindo). `date`
em Task recorrente = data de início (ocorrências antes dela não existem). `extraDays` via
ExtraOccurrence adiciona dias avulsos a uma rotina.

Regra ao alterar este arquivo: **rodar `api/src/modules/week/week.service.test.ts`** — é o único
guard-rail automatizado da lógica de datas.

## 5. Convenções globais

- Datas trafegam como `string` ISO (`YYYY-MM-DD`), não `Date`, em toda fronteira API/front/DB salvo `DateTime` explícito no schema.
- UI e rotas em português (pt-BR).
- Validação de input via Zod nos dois lados.

## 6. Fora de escopo

Multi-usuário compartilhado, mobile nativo, integrações de calendário externo (Google/Outlook) — nada disso existe hoje; não assumir.
