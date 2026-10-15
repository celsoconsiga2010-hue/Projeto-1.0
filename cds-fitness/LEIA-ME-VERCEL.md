# CDS Fitness na Vercel

O site é estático. A Vercel roda `scripts/vercel-build.js`, que monta a pasta `public/` e grava a URL e a chave do Supabase a partir de variáveis de ambiente. Você não precisa editar `js/config.js`.

## Antes: banco no Supabase
Faça o Passo 1 do README: crie o projeto e rode `supabase/schema.sql` em **SQL Editor > New query**. Copie, em **Project Settings > API**, a **Project URL** e a chave **anon / publishable**.

## Opção 1. Pelo site da Vercel (sem instalar nada)
1. Crie um repositório no GitHub e envie o conteúdo desta pasta (o `index.html` fica na raiz do repositório).
2. Em vercel.com: **Add New > Project**, escolha o repositório e **Import**.
3. Em **Environment Variables**, adicione:
   - `SUPABASE_URL` = a Project URL
   - `SUPABASE_ANON_KEY` = a chave anon/publishable
4. Clique em **Deploy**. O `vercel.json` já define o build e a pasta de saída. Deixe o *Framework Preset* como **Other**.

## Opção 2. Pela linha de comando
```
npm i -g vercel
vercel login
vercel env add SUPABASE_URL production
vercel env add SUPABASE_ANON_KEY production
vercel --prod
```

## Depois de publicar
1. Copie o endereço (`https://seu-app.vercel.app`).
2. No Supabase, em **Authentication > URL Configuration**, ponha esse endereço em *Site URL* e em *Redirect URLs*.
3. Abra o endereço no iPhone, no Safari, e use **Compartilhar > Adicionar à Tela de Início**. No Android, use o menu do Chrome > **Instalar app**.

## Se você mudar as variáveis
Elas só valem em um novo deploy. Em **Deployments**, use **Redeploy**.

## Cuidados
- Use só a chave **anon/publishable**. O build recusa a chave `service_role`.
- A URL e a chave anon ficam visíveis no navegador por desenho. Quem protege os dados são as regras RLS do `schema.sql`.
- Para forçar os aparelhos a descartar o cache antigo ao lançar uma versão, troque `VERSION` no `sw.js`.
- Se usar domínio próprio no Supabase, inclua-o em `connect-src` no `index.html`.
