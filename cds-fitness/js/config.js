/* Configuração do app. Preencha com os dados do SEU projeto Supabase:
   Supabase > Project Settings > API.
   A chave "anon" (publishable) é pública por desenho: a segurança vem das
   regras RLS do banco. NUNCA ponha aqui a chave "service_role". */
window.CDS_CONFIG = {
  SUPABASE_URL: 'https://SEU-PROJETO.supabase.co',
  SUPABASE_ANON_KEY: 'COLE_A_CHAVE_ANON_AQUI',

  /* true: dá para entrar com nome de usuário ou e-mail (usa a função
     email_for_username do banco). false: só e-mail. */
  allowUsernameLogin: true,

  /* Só para o app nativo (Capacitor): endereço https onde o app está publicado,
     usado nos links dos e-mails. Deixe vazio se usar só o PWA. */
  WEB_URL: ''
};
