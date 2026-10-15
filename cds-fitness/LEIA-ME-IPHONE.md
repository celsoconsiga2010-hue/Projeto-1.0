# CDS Fitness no iPhone

Há dois caminhos. O primeiro é o que atende "mandar um link e abrir no celular".

## Caminho A. Link + tela de início (PWA). Sem Mac, sem custo

1. Faça os Passos 1 e 2 do README (Supabase e `js/config.js`).
2. Publique a pasta em HTTPS. O jeito mais curto: em app.netlify.com, **Add new site > Deploy manually**, e arraste a pasta `cds-fitness`. O Netlify devolve um link `https://nome.netlify.app`.
3. Ponha esse link em **Authentication > URL Configuration** do Supabase (Site URL e Redirect URLs).
4. Mande o link para o iPhone (WhatsApp, e-mail). Abra **no Safari**, toque em **Compartilhar > Adicionar à Tela de Início**.

Pronto: o ícone fica na tela, abre em tela cheia e funciona como app.

## Caminho B. App nativo com Capacitor (precisa de Mac)

Exige: Mac com Xcode, Node 18+, e conta Apple (grátis para testar no seu próprio iPhone por 7 dias por vez; US$ 99/ano para TestFlight e App Store).

1. Em `js/config.js`, preencha também `WEB_URL` com o endereço do Caminho A. Ele é usado nos links dos e-mails de confirmação e de recuperação de senha.
2. No Supabase, em Redirect URLs, inclua `capacitor://localhost` e o endereço do Caminho A.
3. No Terminal, dentro da pasta:
   ```
   npm install
   npm run ios:add
   npm run ios:open
   ```
4. No Xcode: selecione o projeto **App**, em *Signing & Capabilities* escolha seu Team, conecte o iPhone e clique em Run.
5. Depois de mudar qualquer arquivo do app: `npm run ios:sync`.

Observações do modo nativo: o service worker não roda dentro do app nativo (o app já abre sem internet pelos dados guardados no aparelho, mas os arquivos vêm embutidos). O aviso de fim de descanso em segundo plano não funciona no nativo sem um plugin de notificações, que não está incluído.

Android: `npm run android:add` e `npx cap open android` (precisa do Android Studio).
