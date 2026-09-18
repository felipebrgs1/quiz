# Raio-X do escritório — quiz do evento (Astro + Hono + D1 + Cloudflare)

Quiz de diagnóstico para escritórios de advocacia, usado no evento com
Raio-X gratuito no estande. Domínio: **https://quiz.cassiomota.com**.

## O quiz

5 perguntas (captação, pré-venda/atendimento, fechamento, pós-venda —
indicação e acompanhamento). Cada alternativa vale de 1 a 4 pontos, **sem
exibir os pontos na tela**. Soma de 5 a 20 pontos:

| Pontos | Estágio | Nome |
| ------ | ------- | ---- |
| 5–8    | 1 de 4  | Escritório Artesanal |
| 9–12   | 2 de 4  | Escritório em Transição |
| 13–16  | 3 de 4  | Escritório Estruturado |
| 17–20  | 4 de 4  | Escritório Máquina de Vendas |

O gargalo exibido no resultado é o pilar (ou pilares, em caso de empate)
com a nota mais baixa — gancho do sócio no Raio-X. A tela final mostra
estágio, pontos, gargalo e um código (ex.: `QZ-7D090FE9`) para apresentar
no estande. Pontuação calculada **no servidor**; o cliente envia só as
respostas.

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

2. O banco remoto `quiz_db` já foi criado e o `database_id` já está
   preenchido em `wrangler.jsonc`. Para recriar do zero:

   ```sh
   npm run db:create
   ```

   E atualize o `database_id` com o UUID retornado.

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
- Diagnósticos concluídos no banco e nota média.
- Conversão de visitas em envios.
- Distribuição por estágio (Artesanal → Máquina de Vendas).
- Funil e perguntas vistas/respostas, com visitas ainda sem resposta e nota média por pilar.
- Acessos por hora e origem por `utm_source`.
- Últimos 100 diagnósticos do período, incluindo respostas com notas, gargalo e protocolo de cada um.
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

- `POST /api/lead`: valida nome, telefone e todas as respostas, pontua no
  servidor e salva em `leads` (`score_total`, `tier`, `bottleneck_json`)
  antes de retornar o resultado. Exige `submissionId` (UUID), reutilizado
  pelo cliente nas tentativas para evitar diagnósticos duplicados.
  Retorna `{ tier, score, bottleneck, leadId, redirectTo }`.
- `POST /api/track`: salva os eventos permitidos em `analytics_events`.
- `GET /api/health`: verifica se a API está respondendo.
- `GET /config`: consulta o D1 e renderiza o painel autenticado pelo Hono.
- `/resultado?leadId=...`: lê o diagnóstico no D1 e renderiza estágio,
  pontos, gargalo e código do estande.

Migrations:
- `0001_init.sql`: tabelas originais do quiz anterior.
- `0002_event_analytics.sql`: índices do painel e identificador único de envio.
- `0003_diagnostic.sql`: reconstrói `leads` com `score_total`/`tier`/`bottleneck_json` e remove o motor de regras.

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
