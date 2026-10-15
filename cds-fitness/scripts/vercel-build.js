// Build da Vercel: copia o site para public/ e gera js/config.js
// a partir das variáveis de ambiente SUPABASE_URL e SUPABASE_ANON_KEY.
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..'),out=path.join(root,'public');
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out);
for(const f of ['index.html','manifest.webmanifest','sw.js','css','js','icons'])
  fs.cpSync(path.join(root,f),path.join(out,f),{recursive:true});
const url=(process.env.SUPABASE_URL||'').trim(),key=(process.env.SUPABASE_ANON_KEY||'').trim();
if(url&&key){
  if(/service_role/i.test(key)||(key.split('.')[1]&&Buffer.from(key.split('.')[1],'base64').toString().includes('"service_role"'))){
    console.error('ERRO: essa chave é a service_role. Use a chave anon/publishable.');process.exit(1);
  }
  const cfg={SUPABASE_URL:url,SUPABASE_ANON_KEY:key,allowUsernameLogin:process.env.ALLOW_USERNAME_LOGIN!=='false',WEB_URL:''};
  fs.writeFileSync(path.join(out,'js','config.js'),'window.CDS_CONFIG='+JSON.stringify(cfg)+';\n');
  console.log('config.js gerado a partir das variáveis de ambiente');
}else{
  console.warn('AVISO: SUPABASE_URL/SUPABASE_ANON_KEY não definidas. Usando js/config.js do projeto.');
}
console.log('public/ pronto');
