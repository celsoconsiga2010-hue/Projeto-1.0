# CDS Fitness

Aplicativo de musculação instalável (PWA) com login próprio, banco de dados no Supabase e segurança por usuário. Funciona no Android, no iPhone e no computador, e o treino em andamento continua funcionando sem internet.

## O que ele faz

- Cadastro, login por **usuário ou e-mail**, recuperação de senha por e-mail, troca de senha e sair da conta.
- Treinos com exercícios, séries, faixa de repetições, carga de referência, descanso e progressão; duplicar, editar, excluir e programar a semana.
- Catálogo com 46 exercícios padrão e exercícios próprios.
- Tela de execução: carga e repetições por série, carga da última vez, cronômetro de descanso, autosave.
- Histórico por exercício, gráficos de evolução, comparação entre duas sessões, relatórios com filtros, exportação em CSV e PDF (pela impressão do navegador).
- Sugestão de progressão de carga. Ela nunca altera nada sem você aceitar.
- Editar um treino ou excluir um exercício **não apaga o histórico**.

## Como está organizado

```
index.html            página única
manifest.webmanifest  dados de instalação (PWA)
sw.js                 service worker (abrir offline)
css/app.css           visual
js/config.js          << você edita: URL e chave do Supabase
js/util.js            funções e cálculos (carga, volume, progressão)
js/api.js             tudo que fala com o Supabase
js/views.js           telas de treinos, execução, histórico, relatórios
js/screens.js         login, cadastro, perfil, menu
js/app.js             ações, login, sincronização, offline
icons/                ícones do app
supabase/schema.sql   << você roda no Supabase: tabelas, segurança, funções
_headers, vercel.json cabeçalhos de segurança para a hospedagem
```

Não tem etapa de build. São arquivos estáticos.

---

## Novidades (versão 2): ciclos, atividades extras e gerador

- **Gerar treino automático**: objetivo, grupos musculares, dias por semana e tempo por sessão. O resultado pode ser ajustado (trocar/remover exercícios) antes de salvar.
- **Ciclo de treino** (aba *Ciclo*): sequência A/B/C com prazo, total de sessões, dias por semana necessários, previsão de término e progresso. Encerra sozinho (sessões concluídas ou prazo) ou manualmente; depois é possível **renovar** o treino atual ou **gerar um novo**.
- **Atividades extras**: futebol, futevôlei, canoagem, corrida, ciclismo, natação, lutas e outras, com data e duração, aparecendo no histórico e na semana.
- **Histórico de ciclos**: datas, sessões feitas, exercícios usados e atividades extras de cada ciclo, para comparar.

**Para atualizar um banco já em uso:** abra o SQL Editor do Supabase e execute de novo o `supabase/schema.sql` inteiro. Ele é idempotente: só cria as tabelas novas (`training_cycles`, `extra_activities`) e não altera treinos, exercícios nem sessões existentes. Sem esse passo o app continua funcionando, e a aba *Ciclo* avisa que falta atualizar o banco. Depois publique os arquivos (o cache do app passa para `cds-fitness-v2`).

## Passo 1. Criar o projeto no Supabase

1. Entre em [supabase.com](https://supabase.com), crie uma conta e um **New project**. Guarde a senha do banco.
2. No menu, abra **SQL Editor > New query**, cole o conteúdo de `supabase/schema.sql` e clique em **Run**. Pode rodar de novo sem perder dados.
3. Abra **Project Settings > API** e copie:
   - **Project URL** (algo como `https://abcdxyz.supabase.co`)
   - a chave **anon / publishable**

## Passo 2. Conectar o app

Abra `js/config.js` e preencha:

```js
SUPABASE_URL: 'https://abcdxyz.supabase.co',
SUPABASE_ANON_KEY: 'a-chave-anon-aqui',
```

A chave anon é pública por desenho: quem protege os dados são as regras RLS do banco. **Nunca** coloque a chave `service_role` no app.

## Passo 3. Configurar o login no Supabase

Em **Authentication**:

- **URL Configuration**: em *Site URL* ponha o endereço final do app (passo 5). Em *Redirect URLs* adicione o mesmo endereço e, para testar no computador, `http://localhost:8080`. Sem isso os links de confirmar e-mail e de recuperar senha não voltam para o app.
- **Sign In / Providers > Email**: deixe o provedor de e-mail ligado. Decida se quer **Confirm email**:
  - ligado: a pessoa precisa clicar no link do e-mail antes de entrar (o app mostra as instruções);
  - desligado: entra direto depois de cadastrar.
- **Password requirements**: ponha o mínimo em 8 caracteres.
- **E-mail em produção**: o envio padrão do Supabase tem limite baixo por hora e serve só para testes. Para uso real, configure um SMTP próprio em **Authentication > SMTP Settings**.

## Passo 4. Testar no computador

Dentro da pasta do projeto:

```
python3 -m http.server 8080
```

Abra `http://localhost:8080`. O `localhost` conta como endereço seguro, então o service worker e a instalação funcionam.

## Passo 5. Publicar (precisa de HTTPS)

Qualquer hospedagem de arquivos estáticos serve. As mais simples:

- **Netlify**: arraste a pasta do projeto em *Add new site > Deploy manually*.
- **Cloudflare Pages**: *Create project > Upload assets* e envie a pasta.
- **Vercel**: na pasta, rode `npx vercel --prod` (framework: *Other*, sem build).
- **GitHub Pages**: envie para um repositório e ligue Pages. Funciona em subpasta, os caminhos são relativos.

Depois de publicar, volte ao Passo 3 e confira a *Site URL*.

O app busca os arquivos novos pela rede sempre que há internet. Se quiser forçar os aparelhos a descartar o cache antigo ao lançar uma versão, troque `VERSION` no `sw.js`.

## Passo 6. Instalar no celular

- **Android (Chrome)**: abra o endereço, menu (três pontos) > **Instalar app**. O app também mostra um botão em **Perfil > Instalar app**.
- **iPhone e iPad (Safari)**: abra o endereço no Safari, toque em **Compartilhar** > **Adicionar à Tela de Início**. No iOS tem que ser o Safari.

---

## Teste com duas contas (faça antes de usar de verdade)

1. Crie a conta A e a conta B, de navegadores ou janelas anônimas diferentes.
2. Na A: crie um treino, execute, finalize.
3. Na B: confira que **nenhum** treino, sessão ou exercício próprio da A aparece.
4. Na A: edite o treino e veja que a sessão antiga continua igual no histórico.
5. Na A: exclua o treino e veja que o histórico continua.
6. Sem internet (modo avião): inicie um treino, registre séries, feche e abra o app. Ao voltar a internet, o aviso "Salvo no aparelho, sem sincronizar" some.

## Segurança

- Todas as tabelas têm RLS: cada pessoa só lê e grava linhas com o próprio `user_id`. Visitantes sem login não acessam nenhuma tabela.
- Os exercícios padrão (`user_id` nulo) são somente leitura.
- As funções `save_workout` e `finish_session` rodam com os direitos de quem chama, então a RLS vale dentro delas. Elas são atômicas e podem ser repetidas sem duplicar dados.
- Senhas ficam com o Supabase Auth (hash), nunca no app nem no banco do app.
- O app escapa todo texto exibido e usa uma política de segurança de conteúdo (CSP) no `index.html`. Se usar domínio próprio no Supabase, inclua-o em `connect-src`.
- **Atenção ao login por usuário:** para entrar com o nome de usuário, o app chama a função `email_for_username`, que devolve o e-mail da conta. Isso permite que alguém que conheça um usuário descubra o e-mail dele. Se isso não serve para você, apague essa função no SQL e ponha `allowUsernameLogin: false` em `js/config.js` (o login passa a ser só por e-mail).

## Limites e cuidados

- É um PWA, não um app de loja. Instala pelo navegador, sem Google Play nem App Store. Para publicar nas lojas dá para empacotar com o Capacitor, mas isso não está incluído.
- Sem internet funcionam: abrir o app, ver treinos e histórico (cópia do último acesso) e executar um treino. Criar ou editar treinos, exercícios e perfil precisa de internet.
- O app carrega todo o seu histórico ao abrir. Para milhares de sessões vale paginar, o que não está feito.
- O aviso de fim do descanso com o app em segundo plano depende do aparelho e pode atrasar.
- Trocar a unidade de kg para lb só muda o rótulo, não converte números.
- A biblioteca do Supabase vem do CDN jsDelivr, na versão 2.45.4 fixa (`index.html` e `sw.js`). Para não depender do CDN, baixe o arquivo para `js/` e troque o endereço nos dois lugares.
- O catálogo padrão traz 46 exercícios. Para mudar, edite o final do `schema.sql`.

## O que foi testado

- **Banco**: o `schema.sql` rodou duas vezes seguidas num PostgreSQL 16 sem erro. Com duas contas simuladas, a conta B não vê, não altera e não apaga nada da conta A, e não consegue sobrescrever treinos nem sessões dela. Também foram testados: visitante sem login bloqueado, nome de exercício repetido, finalizar sessão duas vezes sem duplicar, sessão finalizada que não volta a "em andamento", exclusão de treino mantendo histórico e criação de perfil para contas antigas.
- **Interface**: 30 passos num navegador real (cadastro, login por usuário e por e-mail, recuperação de senha, execução de treino, progressão, gráficos, CSV, offline com sincronização depois, confirmação de e-mail, desktop e celular), usando uma simulação do cliente Supabase.
- **Service worker**: instala, guarda o app e abre sem internet.
- **Não testado**: o Supabase real (envio de e-mails, Auth, PostgREST), a instalação em iPhone e Android físicos e o Capacitor. Faça o teste com duas contas acima antes de confiar.
