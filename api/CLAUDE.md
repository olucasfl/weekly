# Weekly API — Spec

Spec do backend. Deploy independente do front (Render/Railway/Fly) — este pacote não sabe nada
de UI. Para o domínio compartilhado (modelo de dados, motor de recorrência), ver [`../CLAUDE.md`](../CLAUDE.md).

## 1. Stack

Node + TypeScript (ESM) + Fastify 4 + `fastify-type-provider-zod` + Prisma + PostgreSQL.

| Comando (rodar dentro de `api/`) | Faz |
|---|---|
| `npm run start:dev` | dev server com watch (tsx) — nota: o script `dev:api` da raiz aponta pra `npm --prefix api run dev`, que **não existe** aqui; use `start:dev` |
| `npm run build` | `tsc` → `dist/` |
| `npm start` | roda `dist/api/src/server.js` (produção) |
| `npm test` | vitest — hoje só `src/modules/week/week.service.test.ts`, cobre o motor de recorrência |
| `npm run lint` | eslint |

## 2. Estrutura

```
src/
  app.ts            # monta Fastify, plugins, auth hook, prefixos de rota, error handler, /health
  server.ts         # start (lê env.PORT/HOST)
  env.ts             # schema Zod das env vars (ver seção 5)
  lib/               # auth.ts (JWT sign/verify), prisma.ts (client singleton), email.ts (Brevo)
  plugins/           # authenticate.ts
  jobs/              # notifications.ts (lembretes/push agendados)
  modules/<nome>/    # <nome>.routes.ts (HTTP) + <nome>.service.ts (regra de negócio + Prisma)
```

Padrão de módulo: rota nunca chama `prisma` direto — sempre via `*.service.ts`. Módulos: `auth`, `categories`, `tasks`, `week`, `completions`, `dashboard`, `push`, `notes`, `goals`.

## 3. Auth

JWT access (curto) + refresh (`POST /auth/refresh`). Hook global em `app.ts` exige
`Authorization: Bearer <token>` em toda rota, exceto `PUBLIC_PATHS`: `/auth/login`, `/auth/register`,
`/auth/verify-email`, `/auth/resend-verification`, `/auth/forgot-password`, `/auth/reset-password`,
`/auth/refresh`, `/auth/verify-email-change`, `/health`. Payload válido preenche `request.user = {sub, email}`.
Erro padrão: `{statusCode, message}`.

## 4. Rotas

| Prefixo | Endpoints | Notas |
|---|---|---|
| `/auth` | POST register, login, refresh, resend-verification, forgot-password, reset-password, cancel-email-change · GET me, verify-email, verify-email-change · PATCH profile · POST change-password · DELETE account | login com rate-limit (5/min); register e demais fluxos de email com `RATE_LIMIT_AUTH` |
| `/categories` | GET /, POST /, PATCH /:id, DELETE /:id | |
| `/tasks` | GET /, POST /, PATCH /:id, DELETE /:id, POST /:id/extra-days | linha única cobre rotina recorrente OU evento pontual (campo `type`) |
| `/week` | GET /?weekStart=YYYY-MM-DD | expande `Task`+`ExtraOccurrence` da semana via `buildWeekOccurrences` (shared) e junta com `Completion` |
| `/completions` | PUT /, PATCH / | upsert de done/skipped por (taskId, date) |
| `/goals` | GET /, GET /summary, POST /, PATCH /:id, DELETE /:id, PUT /:id/progress | |
| `/notes` | GET /, PUT / | 1 nota por (userId, date) |
| `/push` | GET /public-key, POST /subscribe, DELETE /subscribe, PATCH /timezone | web push VAPID; ao registrar nova subscription, remove as antigas do mesmo usuário |
| `/dashboard` | GET / | agregados pra tela de progresso |

## 5. Env vars (`api/.env`, ver `.env.example`)

`PORT`, `HOST`, `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGIN` (origem do front,
sem barra final), `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_EMAIL` (push), `BREVO_API_KEY`/
`BREVO_SENDER_EMAIL`/`BREVO_SENDER_NAME` (envio de email transacional), `APP_URL` (base pra links
de email), `TZ`. Todas validadas em `src/env.ts` com default de dev.

## 6. Banco

`prisma/schema.prisma` é a fonte de verdade do modelo — não documentado aqui de novo (ver
[`../CLAUDE.md`](../CLAUDE.md) §domínio). Migrations em `prisma/migrations/` (ignoradas do contexto
por padrão, ver `.claudeignore`) — gerar com `npx prisma migrate dev`, nunca editar SQL à mão.

## 7. Deploy

Render/Railway/Fly, sem container. Build: `npm run build`. Start: `npm start`. Precisa de
`DATABASE_URL` apontando pra Postgres gerenciado e das env vars da seção 5 configuradas no painel
do provedor (não commitadas). `CORS_ORIGIN` deve apontar pro domínio publicado do `web/`.
