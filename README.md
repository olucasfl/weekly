# Rotina Weekly Planner

Aplicativo pessoal de rotina semanal com backend Fastify e frontend React/Vite em pastas separadas.

## Estrutura

- api/: backend Node + TypeScript + Fastify
- web/: frontend React + Vite + PWA
- shared/: schemas e utilidades compartilhadas

## Como rodar

Não há necessidade de Docker. O projeto roda diretamente com Node.js e npm.

### Backend

```bash
cd api
npm install
npm run dev
```

### Frontend

```bash
cd web
npm install
npm run dev
```

Ou, a partir da raiz do projeto:

```bash
npm run dev:api
npm run dev:web
```

- API: http://localhost:3333
- Frontend: http://localhost:5173

### Deploy futuro

Para deploy simples, você pode publicar o frontend no Vercel ou Netlify e o backend em Render, Railway ou Fly.io, sem usar containers.
