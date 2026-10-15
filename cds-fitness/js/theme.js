/* Aplica o tema salvo antes da tela aparecer (evita piscar). */
(function(){var t='dark';try{t=localStorage.getItem('cds.theme')||'dark'}catch(e){}document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark')})();
