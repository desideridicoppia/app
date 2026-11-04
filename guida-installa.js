/* GUIDA ALL'INSTALLAZIONE (04/11/2026). Detecta iOS Safari, Android/Chrome
   (beforeinstallprompt), navegador in-app (Instagram/Facebook/TikTok); some se ja instalado; fechar lembra 7 dias. */
(function () {
  var K = 'dcg_guida_chiusa' /* fora do prefixo dc_: nao conta como 'ja usava' na ativacao */, DIAS = 7, ua = navigator.userAgent, q = new URLSearchParams(location.search);
  var installato = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true || q.get('forza') === 'standalone';
  if (installato) return;
  try { var t = +localStorage.getItem(K); if (t && Date.now() - t < DIAS * 864e5 && !q.has('forza')) return; } catch (e) {}
  var inApp = /Instagram|FBAN|FBAV|FB_IAB|musical_ly|TikTok|BytedanceWebview/i.test(ua) || q.get('forza') === 'inapp';
  var ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var tipo = inApp ? 'inapp' : ios ? 'ios' : 'android', prompt = null;
  var css = '#gi{position:fixed;inset:0;z-index:9999;background:rgba(18,6,11,.72);backdrop-filter:blur(6px);display:flex;align-items:flex-end;justify-content:center;font-family:Manrope,system-ui,sans-serif;color:#f7ede6}' +
   '#gi .f{width:100%;max-width:440px;background:linear-gradient(180deg,#3d0b1a,#1c0910);border:1px solid rgba(233,185,143,.25);border-bottom:0;border-radius:24px 24px 0 0;padding:22px 22px calc(22px + env(safe-area-inset-bottom));box-shadow:0 -10px 40px rgba(0,0,0,.5);animation:su .35s ease}' +
   '@keyframes su{from{transform:translateY(100%)}}' +
   '#gi h2{font-family:"Cormorant Garamond",Georgia,serif;font-size:28px;font-weight:600;margin:0 0 6px;color:#f4d6bc}#gi p{margin:0 0 14px;color:#b9a2a8;font-size:14.5px;line-height:1.45}' +
   '#gi ol{margin:0 0 16px;padding:0;list-style:none;counter-reset:n}#gi li{counter-increment:n;display:flex;gap:10px;align-items:center;margin:9px 0;font-size:15px}' +
   '#gi li:before{content:counter(n);flex:none;width:24px;height:24px;border-radius:50%;background:#b0123e;color:#fff;font-size:13px;font-weight:700;display:grid;place-items:center}' +
   '#gi li svg{width:20px;height:20px;vertical-align:-4px;stroke:#e9b98f}' +
   '#gi .b{display:block;width:100%;border:0;border-radius:14px;padding:14px;font:700 16px Manrope,sans-serif;background:linear-gradient(90deg,#ff4d5e,#ff8a5b);color:#12060b;margin-top:8px;cursor:pointer}' +
   '#gi .b2{background:transparent;color:#e9b98f;border:1px solid rgba(233,185,143,.35)}#gi .x{position:absolute;right:16px;top:14px;background:none;border:0;color:#b9a2a8;font-size:26px;cursor:pointer}' +
   '#gi .demo{position:relative;height:130px;border-radius:16px;background:#12060b;border:1px solid rgba(233,185,143,.16);margin:0 0 14px;overflow:hidden}' +
   '#gi .bar{position:absolute;left:0;right:0;bottom:0;height:40px;background:#2a0f17;display:flex;justify-content:space-around;align-items:center}#gi .bar svg{width:22px;height:22px;stroke:#b9a2a8}' +
   '#gi .bar .sh{stroke:#ff8a5b;animation:pu 1.6s infinite}@keyframes pu{50%{transform:scale(1.3)}}' +
   '#gi .arr{position:absolute;left:50%;bottom:40px;line-height:1;transform:translateX(-50%);color:#ff8a5b;font-size:26px;animation:bo 1.2s infinite}@keyframes bo{50%{bottom:46px}}' +
   '#gi .menu{position:absolute;left:8%;right:8%;top:10px;white-space:nowrap;background:#f7ede6;color:#12060b;border-radius:10px;padding:7px 10px;font-size:12.5px;font-weight:600;display:flex;justify-content:space-between;align-items:center;animation:ap 3.2s infinite}' +
   '@keyframes ap{0%,35%{opacity:0;transform:translateY(8px)}50%,100%{opacity:1;transform:none}}' +
   '#gi .top{position:absolute;right:14px;top:10px;color:#ff8a5b;font-size:26px;animation:bo2 1.2s infinite}@keyframes bo2{50%{top:2px}}#gi .ok{color:#e58ba0;font-size:13px;text-align:center;margin-top:8px;min-height:16px}';
  var SH = '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M12 3v12M7 8l5-5 5 5M5 12v8h14v-8"/></svg>';
  var PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';
  var DOTS = '<svg viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round"><path d="M12 5h.01M12 12h.01M12 19h.01"/></svg>';
  var dove = /Instagram/i.test(ua) ? 'Instagram' : /FBAN|FBAV|FB_IAB/i.test(ua) ? 'Facebook' : /musical_ly|TikTok|Bytedance/i.test(ua) ? 'TikTok' : 'questa app';
  var H = {
    ios: '<h2>Metti il gioco nella schermata Home</h2><p>Così si apre con un tocco, a schermo intero, come una vera app.</p>' +
      '<div class="demo"><div class="menu">Aggiungi alla schermata Home ' + PLUS + '</div><div class="arr">↓</div><div class="bar"><svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M15 6l-6 6 6 6"/></svg><span class="sh">' + SH + '</span><svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M5 5h14v14H5z"/></svg></div></div>' +
      '<ol><li><span>Tocca ' + SH + ' <b>Condividi</b> nella barra di Safari</span></li><li><span>Scorri e tocca ' + PLUS + ' <b>Aggiungi alla schermata Home</b></span></li><li><span>Tocca <b>Aggiungi</b> in alto a destra</span></li></ol>' +
      '<button class="b" data-x>Ho capito</button>',
    android: '<h2>Installa il gioco sul telefono</h2><p>Un tocco e l\'icona compare nella schermata Home. Si apre a schermo intero, come una vera app.</p>' +
      '<div id="giNat"><button class="b" data-inst>Installa l\'app</button></div>' +
      '<div id="giMan" hidden><div class="demo"><div class="top">↑</div><div class="menu" style="top:40px">Installa app ' + PLUS + '</div></div>' +
      '<ol><li><span>Tocca ' + DOTS + ' <b>menu</b> in alto a destra in Chrome</span></li><li><span>Tocca <b>Installa app</b> (o <b>Aggiungi a schermata Home</b>)</span></li><li><span>Conferma con <b>Installa</b></span></li></ol></div>' +
      '<button class="b b2" data-x>Più tardi</button><div class="ok" id="giOk"></div>',
    inapp: '<h2>Apri il gioco nel browser</h2><p>Sei dentro ' + dove + ': da qui il gioco non si può installare. Aprilo in ' + (ios ? 'Safari' : 'Chrome') + ' per averlo sempre a portata di mano.</p>' +
      '<div class="demo"><div class="top">↑</div><div class="menu" style="top:40px">' + (ios ? 'Apri in Safari' : 'Apri in Chrome') + '</div></div>' +
      '<ol><li><span>Tocca ' + DOTS + ' in alto a destra</span></li><li><span>Scegli <b>' + (ios ? 'Apri in Safari' : 'Apri nel browser') + '</b></span></li></ol>' +
      '<button class="b" data-copia>Copia il link</button><div class="ok" id="giOk"></div><button class="b b2" data-x>Più tardi</button>'
  };
  function mostra() {
    if (document.getElementById('gi')) return;
    /* a tela de ativacao por e-mail vem primeiro: espera ela fechar */
    if (document.getElementById('ativ')) { setTimeout(mostra, 1500); return; }
    var s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
    var d = document.createElement('div'); d.id = 'gi'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true');
    d.innerHTML = '<div class="f" style="position:relative"><button class="x" data-x aria-label="Chiudi">×</button>' + H[tipo] + '</div>';
    document.body.appendChild(d);
    if (tipo === 'android' && !prompt && q.get('forza') !== 'android') { d.querySelector('#giNat').hidden = true; d.querySelector('#giMan').hidden = false; }
    d.addEventListener('click', function (e) {
      if (e.target === d || e.target.closest('[data-x]')) { try { localStorage.setItem(K, Date.now()); } catch (x) {} d.remove(); }
      if (e.target.closest('[data-inst]') && prompt) { prompt.prompt(); prompt.userChoice.then(function (r) { if (r.outcome === 'accepted') d.remove(); }); prompt = null; }
      if (e.target.closest('[data-copia]')) {
        var ok = function () { d.querySelector('#giOk').textContent = 'Link copiato! Incollalo in ' + (ios ? 'Safari' : 'Chrome') + '.'; };
        (navigator.clipboard ? navigator.clipboard.writeText(location.href).then(ok, ok) : ok());
      }
    });
  }
  addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); prompt = e; var m = document.getElementById('giMan'); if (m) { m.hidden = true; document.getElementById('giNat').hidden = false; } });
  addEventListener('appinstalled', function () { var d = document.getElementById('gi'); if (d) d.remove(); });
  setTimeout(mostra, q.has('forza') ? 300 : 2500);
})();
