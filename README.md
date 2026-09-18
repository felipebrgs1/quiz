# Quiz do evento — Mota e Silva Advogados

Astro + Hono + Cloudflare Workers + D1. Domínio: **https://quiz.cassiomota.com**.

## Desenvolvimento

```sh
npm install
npm run db:migrate:local
npm run dev
```

Quiz: `http://localhost:4321`.
Painel: `http://localhost:4321/config`, senha **Fecoimp2026**.

## Publicar na Cloudflare

O `wrangler.jsonc` usa a conta **Dev@vozeduca.com.br** e configura o custom domain
`quiz.cassiomota.com`. A zona `cassiomota.com` precisa estar ativa nessa conta.

1. Autentique com acesso à conta correta:

   ```sh
   npx wrangler login
   npx wrangler whoami
   ```

2. Crie o banco remoto:

   ```sh
   npm run db:create
   ```

   Substitua o `database_id` provisório de `wrangler.jsonc` pelo UUID retornado.
   Se `quiz_db` já existir na conta, obtenha o ID com `npx wrangler d1 list`.

3. Aplique as migrations:

   ```sh
   npm run db:migrate:remote
   ```

4. Valide e publique:

   ```sh
   npm run typecheck
   npm run deploy
   ```

O Wrangler configura o custom domain na publicação. Acesso ao painel:
**https://quiz.cassiomota.com/config**, senha **Fecoimp2026**.

## Painel do evento

- Visitantes únicos por navegador, visitas e visualizações.
- Visitas que iniciaram o quiz e chegaram ao formulário.
- Contatos confirmados no banco e pré-aprovados.
- Conversão de visitas em envios.
- Funil e perguntas vistas/respostas, com visitas ainda sem resposta.
- Acessos por hora e origem por `utm_source`.
- Últimos 100 contatos do período, incluindo as respostas de cada um.
- Filtros: hoje, últimos 7 dias, últimos 30 dias ou todo o período.
- Atualização a cada 30 segundos; pausa ao abrir respostas ou mudar o filtro.
- Datas exibidas no horário de Brasília.

`/config` abre uma tela de login simples, não aparece na navegação,
não é indexável e retorna `Cache-Control: private, no-store`.

### Link para QR code do evento

```text
https://quiz.cassiomota.com/?utm_source=evento&utm_medium=qrcode&utm_campaign=evento_2026
```

Use fontes diferentes para distinguir materiais ou pontos de entrada.
Visitantes são uma estimativa por navegador, não uma contagem de pessoas físicas.
Recarregar a página gera uma visualização, mas preserva a sessão da aba; após um
envio confirmado, a próxima participação ganha uma nova sessão. Visitas que
atravessam o início do período podem aparecer em fases diferentes do funil.
Contatos são contados diretamente no banco, mesmo se o evento de analytics falhar.

## API Hono e banco

- `POST /api/lead`: valida nome, telefone e todas as respostas, aplica as regras e
  salva em `leads` antes de retornar o resultado. Exige `submissionId` (UUID),
  reutilizado pelo cliente nas tentativas para evitar contatos duplicados.
- `POST /api/track`: salva os eventos permitidos em `analytics_events`.
- `GET /api/health`: verifica se a API está respondendo.
- `GET /config`: consulta o D1 e renderiza o painel autenticado pelo Hono.

Migrations:
- `0001_init.sql`: tabelas `leads`, `analytics_events`, `qualification_rules` e regra inicial.
- `0002_event_analytics.sql`: índices do painel e identificador único de envio.

Os bindings do Worker são repassados pelo Astro para o Hono usando
`locals.runtime.env`; `DB` é o binding D1. Não são necessárias chaves do banco
no navegador.

## Verificação de integração

O teste usa um Worker local com banco isolado, sem alterar dados remotos:

```sh
npx wrangler d1 migrations apply quiz_db --local --persist-to /tmp/opencode/quiz-event-test
npm run build
npx wrangler dev --port 8787 --persist-to /tmp/opencode/quiz-event-test
```

Em outro terminal:

```sh
node --test tests/event.integration.mjs
```
