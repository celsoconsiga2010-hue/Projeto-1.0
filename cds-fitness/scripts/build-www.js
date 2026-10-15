// Copia os arquivos do app para www/, que é a pasta que o Capacitor empacota.
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..'),out=path.join(root,'www');
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out);
for(const f of ['index.html','manifest.webmanifest','sw.js','css','js','icons']){
  fs.cpSync(path.join(root,f),path.join(out,f),{recursive:true});
}
console.log('www/ pronto');
