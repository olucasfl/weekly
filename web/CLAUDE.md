# Weekly Web — Spec

Spec do frontend. Deploy independente do backend (Vercel) — este pacote só fala com a API via
`VITE_API_URL`. Para o domínio (modelo de dados, motor de recorrência), ver [`../CLAUDE.md`](../CLAUDE.md).

## 1. Stack

React 18 + TypeScript + Vite + React Router 6 + TanStack Query 5 + Zustand + react-hook-form + Zod
+ `vite-plugin-pwa` (estratégia `injectManifest`, service worker próprio em `src/sw.ts`).

| Comando (rodar dentro de `web/`) | Faz |
|---|---|
| `npm run dev` | dev server, :5173 |
| `npm run build` | `tsc -b && vite build` → `dist/` |
| `npm run preview` | serve o build local |
| `npm run lint` | eslint |

Sem testes automatizados hoje (só `@playwright/test` como devDependency, sem specs escritos).

## 2. Estrutura

```
src/
  App.tsx            # rotas (ver §3) + ProtectedRoute (redireciona p/ /auth sem user)
  main.tsx           # bootstrap, registra sw
  sw.ts              # service worker custom (push, cache via injectManifest)
  store/             # auth.ts (zustand: user/token/refreshToken), theme.ts
  lib/                # api.ts (client fetch único), date.ts, constants.ts
  hooks/              # useOnlineStatus.ts
  components/         # BottomNav, ErrorBoundary, Logo, OfflineBanner, PullToRefresh, Skeleton, SplashScreen
  features/<nome>/    # 1 pasta por tela, componente principal `<Nome>Screen.tsx`
```

## 3. Rotas (`App.tsx`)

| Path | Screen | Protegida |
|---|---|---|
| `/auth` | AuthScreen | não |
| `/verificar-email` | VerifyEmailScreen | não |
| `/verificar-troca-email` | VerifyEmailChangeScreen | não |
| `/esqueci-senha` | ForgotPasswordScreen | não |
| `/redefinir-senha` | ResetPasswordScreen | não |
| `/` | WeekScreen (sub-views: TimeGridView, MonthView) | sim |
| `/rotinas` | TasksScreen | sim |
| `/eventos` | EventsScreen | sim |
| `/metas` | GoalsScreen | sim |
| `/progresso` | ProgressScreen | sim |
| `/perfil` | ProfileScreen | sim |

`ProtectedRoute` lê `useAuthStore` e redireciona pra `/auth` sem `user`; também sincroniza timezone
de push (`PATCH /push/timezone`) quando há subscription ativa.

## 4. Estado e dados

- **Client-side**: `store/auth.ts` (Zustand — `user`, `token`, `refreshToken`, persistido), `store/theme.ts`.
- **Server-side**: TanStack Query em cada `*Screen.tsx` (sem client de query centralizado além do `QueryClientProvider` em `main.tsx`); sem cache/normalização própria além do que o React Query oferece.
- **Formulários**: react-hook-form + Zod (schemas locais ou de `@shared/schemas` quando aplicável — hoje nenhuma tela importa `@shared` de fato, embora o alias exista no `tsconfig.json`).

## 5. `lib/api.ts` — client HTTP

Único ponto de chamada à API (`fetch` puro, sem axios). Regras:
- injeta `Authorization: Bearer <token>` automaticamente;
- em `401` (fora de rotas `/auth/*`), tenta `POST /auth/refresh` uma única vez em voo (single-flight
  via `_refreshing`) e repete a requisição original; se falhar, chama `onUnauthorized` (logout) e
  lança `Error('Sessão expirada')`;
- bloqueia mutações (`method !== 'GET'`) quando `navigator.onLine === false`;
- erros da API viram `Error(message)` com `.code` opcional (do corpo `{message, code}`).

`configureApi(...)` é chamado uma vez (provavelmente em `main.tsx`/`App.tsx`) pra injetar os getters/setters do `store/auth`.

## 6. PWA / Push

`vite-plugin-pwa` com `strategies: 'injectManifest'` usa `src/sw.ts` como base e injeta o manifest de
cache. Ícones em `public/weekly-{180,192,512}.png`. Push: `GET /push/public-key` → `subscribe` via
`PushManager` → `POST /push/subscribe`; permissão só é checada (`Notification.permission`), nunca
pedida automaticamente fora de ação do usuário.

## 7. Convenções

- UI e rotas em pt-BR.
- Datas como `string` ISO (`YYYY-MM-DD`) ponta a ponta, formatação em `lib/date.ts`/`lib/constants.ts`.
- 1 arquivo por tela em `features/`, sem index barrel.
- Ícones: `lucide-react`.

## 8. Env vars (`web/.env`, ver `.env.example`)

`VITE_API_URL` — URL base da API publicada (sem barra final). Único ponto de acoplamento com o backend.

## 9. Deploy

Vercel (`vercel.json` faz rewrite de tudo pra `/index.html` — SPA). Build command `npm run build`,
output `dist/`. Definir `VITE_API_URL` nas env vars do projeto Vercel apontando pro backend publicado.
