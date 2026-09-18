# Exemplo Quiz — Astro + Hono + D1 + Cloudflare (tema escuro / laranja)

Mesmo esquema do quiz atual (`/`, perguntas → captura → confirmação → `/resultado`),
mas nessa stack:

- **Astro SSR** (`output: server`) com adapter `@astrojs/cloudflare`
- **Hono** como API (`src/server/app.ts` montado em `src/pages/api/[...route].ts`)
- **D1 (SQLite)** como banco (`migrations/0001_init.sql`, binding `DB`)
- **Tailwind v4** com tema escuro + laranja

## Rodar local

```sh
cd quiz
npm install

# 1. crie o D1 local e aplique a migration
npx wrangler d1 migrations apply quiz_db --local

# 2. ajuste o id gerado no wrangler.jsonc (database_id)
# 3. rode
npm run dev
```

Acesse `http://localhost:4321`.

## API (Hono)

- `POST /api/lead` — valida (zod), avalia regras, salva em `leads`, retorna `{ qualified, leadId, whatsappUrl }`
- `POST /api/track` — salva em `analytics_events` (`page_view`, `quiz_step_view`, `quiz_answer`, `lead_submit_*`)
- `GET /api/health` — checagem

## D1

Schema em `migrations/0001_init.sql` (versão SQLite do `supabase/schema.sql`):
`qualification_rules`, `leads`, `analytics_events`.

Criar banco remoto:

```sh
npx wrangler d1 create quiz_db
npx wrangler d1 migrations apply quiz_db --remote
```

## Deploy

```sh
npm run deploy
```

## Tema

Fundo `#09090b` → preto, cards `zinc-950/90`, borda `zinc-800`,
acento `orange-500/600` (botões, progresso, seleção), sucesso `emerald`.
