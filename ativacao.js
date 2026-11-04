/* ===== ATIVACAO DO APP PELO E-MAIL DA COMPRA (Desideri di Coppia IT, 04/11/2026: copia do No Tapetinho,
   textos em italiano e visual do app; venda pela Hotmart, painel em modo tolerante: sem compra na base LIBERA) =====
   Copiada do app do Lucro na Mao (2026-08-lucro-na-mao/app/ativacao.js, regra de 26/10 e 03/11/2026).
   So mudam o bloco OFERTA, os textos T e o visual. Mexeu na regra la, traga pra ca.

   Por que existe: quem abre o app e nao ve login nem cadastro acha que e "so um site" e pede
   reembolso; a tela de e-mail da a sensacao de conta. E quem foi reembolsado deixa de usar o app.

   Como decide (o painel responde pelo e-mail, que viaja so em hash sha256, rota /api/app/acesso):
     ok           -> libera e lembra, com os produtos que o e-mail comprou (`p`)
     reembolsado  -> tela de acesso encerrado
     nao_achei    -> tenta de novo por ate 3 min (a venda leva ate 3 min pra chegar no painel)
                     e depois pede pra conferir o e-mail
     erro/offline -> LIBERA (provisorio) e confere na proxima abertura. Quem pagou nunca fica
                     trancado porque o painel caiu ou faltou internet.

   QUEM JA USAVA NAO VE NADA: aparelho com chave `nt_` e sem ativacao vira "legado", nunca ve a
   tela e nunca e conferido. Por isso este script roda ANTES do app, que grava `nt_acesso` ao abrir.

   O iPhone separa o storage do Safari do app instalado. O estado decidido tambem vai para o Cache
   Storage (`nt-ativacao`), que e por origem e atravessa os dois. O nome NAO comeca com
   `tapetinho-`: o sw.js apaga esses caches a cada versao.

   Os produtos do e-mail so SOMAM ao que a pasta do link libera (o app faz a conta, nunca tira).
   A compra feita dentro do app libera na volta: `Ativacao.conferirCompra()` (quem ja ativou) e
   `Ativacao.liberar()` (quem nunca digitou o e-mail). */
(function () {
  'use strict';

  /* ---------- o que e desta oferta ---------- */
  var OFERTA = {
    prefixo: 'dc_',
    cache: 'dc-ativacao',
    painel: 'o=2026-10-desejos-do-casal',
    comprar: 'https://desideridicoppia.com/',
    marca: 'Desideri di Coppia',
    suporte: 'contatti@desideridicoppia.com'
  };
  var T = {
    titulo: 'Attiva il tuo gioco',
    sub: 'Inserisci l\'email che hai usato per l\'acquisto. Basta farlo una volta su questo telefono.',
    info1: '<b>Quello che fate insieme resta su questo telefono.</b> Le carte scelte e i punteggi non finiscono online.',
    info2: 'Volete giocare anche sull\'altro telefono? Apri il gioco lì e inserisci la stessa email.',
    rotulo: 'La tua email d\'acquisto',
    exemplo: 'latuaemail@esempio.it',
    botao: 'Attiva il gioco',
    conferindo: 'Sto controllando il tuo acquisto...',
    pronto: 'Fatto!',
    ativado: 'Gioco attivato. Buon divertimento!',
    liberado: 'Fatto, sbloccato.',
    invalido: 'Controlla l\'email: sembra che manchi qualcosa.',
    esperando: 'Se hai appena acquistato, l\'ordine può metterci fino a 3 minuti ad arrivare. Stiamo ricontrollando.',
    naoAchei: 'Non troviamo un acquisto con questa email. Controlla che sia la stessa usata per pagare, lettera per lettera.',
    naoAcheiDepois: 'Non troviamo un acquisto con questa email. Controlla e riprova.',
    lembrar: 'Non ricordi l\'email? È quella a cui è arrivata la conferma d\'acquisto di Hotmart.',
    apple: '<b>Hai pagato con Apple Pay?</b> Usa l\'email del tuo account Apple.',
    encerradoTit: 'Accesso terminato',
    encerrado: function (email) {
      return 'L\'acquisto fatto con l\'email <b>' + email + '</b> è stato rimborsato, quindi l\'accesso a questo gioco è terminato.';
    },
    encerradoInfo: 'Se vuoi tornare a giocare, puoi riacquistarlo quando vuoi.',
    voltar: 'Voglio tornare a giocare',
    semRede: 'Nessuna connessione. Connettiti e tocca di nuovo Attiva.',
    paguei: 'Ho pagato e non si attiva',
    pagueiCorpo: 'Ciao! Ho acquistato Desideri di Coppia e il gioco non si attiva con l\'email: ',
    outro: 'Ho acquistato con un\'altra email',
    liberarTit: 'Sblocca quello che hai acquistato',
    liberarSub: 'Inserisci l\'email usata per l\'acquisto. Quello che hai comprato si sblocca subito.',
    agoraNao: 'Non ora',
    semEsse: 'Questa email non ha ancora questo acquisto. Se hai appena pagato, aspetta un minuto e tocca di nuovo Sblocca.',
    botaoLiberar: 'Sblocca'
  };

  var CHAVE = OFERTA.prefixo + 'ativacao';
  var URL_CACHE = '/__ativacao__';
  /* o painel aceita a origem local (CORS em lib/acesso-do-app), entao o teste local fala com a mesma rota */
  var LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var PAINEL = (LOCAL ? 'http://localhost:3100' : 'https://painel.labofertas.com') +
    '/api/app/acesso?' + OFERTA.painel + '&e=';
  var RECONFERIR_MS = 6 * 60 * 60 * 1000;
  var ESPERA_VENDA_MS = 180 * 1000;
  var BASE = (document.currentScript && document.currentScript.src || location.href).replace(/[^\/]*$/, '');

  /* ---------- estado ---------- */
  function ler() {
    try { return JSON.parse(localStorage.getItem(CHAVE) || 'null'); } catch (e) { return null; }
  }
  function publicar() {
    var a = window.Ativacao || (window.Ativacao = {});
    a.estado = st.estado; a.email = st.email || null; a.produtos = st.p || null;
  }
  function gravar(novo) {
    st = novo;
    publicar();
    try { localStorage.setItem(CHAVE, JSON.stringify(st)); } catch (e) {}
    espelhar(st);
  }
  /* atravessa pro icone o que ja foi decidido; pendente e provisorio nao */
  function espelhar(s) {
    if (!s || !/^(legado|ativo|bloqueado)$/.test(s.estado)) return;
    try {
      caches.open(OFERTA.cache).then(function (c) {
        return c.put(URL_CACHE, new Response(JSON.stringify(s), { headers: { 'content-type': 'application/json' } }));
      }).catch(function () {});
    } catch (e) {}
  }
  function lerEspelho() {
    try {
      return caches.open(OFERTA.cache).then(function (c) { return c.match(URL_CACHE); })
        .then(function (r) { return r ? r.json() : null; }).catch(function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  }
  function jaUsava() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(OFERTA.prefixo) === 0 && k !== CHAVE) return true;
      }
    } catch (e) {}
    return false;
  }

  try { localStorage.setItem(CHAVE + '_teste', '1'); localStorage.removeItem(CHAVE + '_teste'); }
  catch (e) { return; } /* sem storage (aba privada antiga): nada a lembrar, segue pelo link */

  var st = ler();
  if (!st) gravar(jaUsava() ? { estado: 'legado', desde: Date.now() } : { estado: 'pendente' });
  else publicar();

  /* ---------- conferir no painel ---------- */
  function hash(email) {
    var e = String(email || '').trim().toLowerCase();
    if (!window.crypto || !crypto.subtle || !window.TextEncoder) return Promise.reject(new Error('sem crypto'));
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(e)).then(function (b) {
      return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    });
  }
  /* devolve 'ok' | 'reembolsado' | 'nao_achei' | 'erro' (rede, painel fora, timeout).
     No 'ok', os produtos do e-mail ficam em `ultimoP`. `novo`: acabou de comprar, o painel olha a Cakto na hora */
  var ultimoP = null;
  function conferir(h, novo) {
    if (navigator.onLine === false) return Promise.resolve('erro');
    var ctl = window.AbortController ? new AbortController() : null;
    var t = setTimeout(function () { if (ctl) ctl.abort(); }, 8000);
    return fetch(PAINEL + h + (novo ? '&novo=1' : ''), { cache: 'no-store', credentials: 'omit', signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        ultimoP = (j && Array.isArray(j.p)) ? j.p.map(String) : null;
        return (j && /^(ok|reembolsado|nao_achei)$/.test(j.s)) ? j.s : 'erro';
      })
      .catch(function () { return 'erro'; })
      .then(function (s) { clearTimeout(t); return s; });
  }

  /* ---------- a tela, no visual do app ---------- */
  var CSS = '' +
    'html.ativ-trava,html.ativ-trava body{overflow:hidden!important}' +
    'html.ativ-trava body>*:not(#ativ){visibility:hidden!important}' +
    '#ativ{position:fixed;inset:0;z-index:2147483000;background:radial-gradient(120% 60% at 50% 0,#3d0b1a 0,#12060b 70%) no-repeat,#12060b;overflow-y:auto;-webkit-overflow-scrolling:touch;' +
    'font-family:Manrope,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-weight:600;color:#f7ede6;visibility:visible!important}' +
    '#ativ *{box-sizing:border-box}' +
    '#ativ .av-topo{text-align:center;padding:calc(env(safe-area-inset-top) + 30px) 16px 4px}' +
    '#ativ .av-topo img{width:76px;height:76px;border-radius:22px;display:block;margin:0 auto;box-shadow:0 8px 22px rgba(0,0,0,.4)}' +
    '#ativ .av-topo b{display:block;margin-top:10px;font-size:15px;font-weight:900;color:#e9b98f;letter-spacing:.2px}' +
    '#ativ .av-corpo{max-width:460px;margin:0 auto;padding:18px 20px 36px}' +
    '#ativ h1{font-family:"Cormorant Garamond",Georgia,serif;font-size:32px;font-weight:600;color:#f4d6bc;line-height:1.15;margin:0 0 6px;letter-spacing:-.4px}' +
    '#ativ .av-sub{font-size:17px;line-height:1.5;color:#b9a2a8;margin:0 0 18px}' +
    '#ativ .av-info{display:flex;gap:12px;background:rgba(233,185,143,.06);border:1px solid rgba(233,185,143,.18);border-radius:20px;padding:15px;margin:0 0 18px;font-size:15px;line-height:1.5;box-shadow:none}' +
    '#ativ .av-info svg{width:24px;height:24px;flex-shrink:0;margin-top:1px;color:#ff8a5b}' +
    '#ativ .av-info p{margin:0}#ativ .av-info p+p{margin-top:7px}' +
    '#ativ label{display:block;font-size:15px;font-weight:800;margin:0 0 7px}' +
    '#ativ input{width:100%;font:inherit;font-size:18px;padding:15px 14px;border:2px solid rgba(233,185,143,.35);border-radius:16px;background:#1c0910;color:#f7ede6;outline:none}' +
    '#ativ input::placeholder{color:#8a7378;opacity:1}' +
    '#ativ input:focus{border-color:#ff8a5b;box-shadow:0 0 0 3px rgba(255,138,91,.2)}' +
    '#ativ input[aria-invalid=true]{border-color:#ff4d5e}' +
    '#ativ .av-btn{display:flex;align-items:center;justify-content:center;width:100%;min-height:58px;margin-top:14px;background:linear-gradient(90deg,#ff4d5e,#ff8a5b);color:#12060b;border:0;border-radius:18px;padding:14px;font:inherit;font-size:18px;font-weight:900;cursor:pointer;text-align:center;text-decoration:none;box-shadow:0 6px 16px rgba(255,77,94,.3)}' +
    '#ativ .av-btn:active{filter:brightness(.9)}' +
    '#ativ .av-btn:focus-visible,#ativ .av-link:focus-visible{outline:3px solid #f4d6bc;outline-offset:2px}' +
    '#ativ .av-btn[disabled]{opacity:.75;cursor:default}' +
    '#ativ .av-btn.sec{background:transparent;color:#e9b98f;border:1px solid rgba(233,185,143,.35);box-shadow:none}' +
    '#ativ .av-msg{min-height:1px;font-size:15px;line-height:1.45;margin-top:12px}' +
    '#ativ .av-msg.erro{color:#ff8a8f;font-weight:700}' +
    '#ativ .av-msg.ok{color:#9be3b5;font-weight:800}' +
    '#ativ .av-nota{font-size:14px;line-height:1.5;color:#b9a2a8;margin-top:18px;text-align:center}' +
    '#ativ .av-apple{background:rgba(201,161,91,.12);border-radius:16px;padding:12px 14px;margin:0 0 16px;font-size:15px;line-height:1.45;color:#f4d6bc}' +
    '#ativ .av-spin{display:inline-block;width:17px;height:17px;border:2.5px solid rgba(18,6,11,.35);border-top-color:#12060b;border-radius:50%;margin-right:9px;animation:avGira .8s linear infinite}' +
    '@keyframes avGira{to{transform:rotate(360deg)}}' +
    '@media (prefers-reduced-motion:reduce){#ativ .av-spin{animation:none}}';

  function svg(corpo) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + corpo + '</svg>';
  }
  var ICO_CEL = svg('<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>');
  var ICO_X = svg('<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>');

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  /* msg: um aviso de erro ja na abertura (texto puro). `voluntario`: a tela de liberar, aberta pelo
     app ("Ja comprei, atualizar"), que fecha com "Agora nao" */
  function telaEmail(msg) {
    return '<div class="av-corpo">' +
      '<h1 id="avTit">' + (voluntario ? T.liberarTit : T.titulo) + '</h1>' +
      '<p class="av-sub">' + (voluntario ? T.liberarSub : T.sub) + '</p>' +
      (voluntario ? '' : '<div class="av-info">' + ICO_CEL + '<div><p>' + T.info1 + '</p><p>' + T.info2 + '</p></div></div>') +
      (T.apple ? '<p class="av-apple">' + T.apple + '</p>' : '') +
      '<form id="avForm" novalidate>' +
        '<label for="avEmail">' + T.rotulo + '</label>' +
        '<input id="avEmail" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false"' +
        ' placeholder="' + T.exemplo + '" aria-describedby="avMsg" required>' +
        '<button class="av-btn" id="avBtn" type="submit">' + (voluntario ? T.botaoLiberar : T.botao) + '</button>' +
        '<div class="av-msg' + (msg ? ' erro' : '') + '" id="avMsg" role="status" aria-live="polite">' + esc(msg || '') + '</div>' +
      '</form>' +
      (voluntario ? '<button class="av-btn sec" id="avFechar" type="button">' + T.agoraNao + '</button>' : '') +
      '<p class="av-nota">' + T.lembrar + '</p>' +
    '</div>';
  }

  function telaEncerrada(email) {
    return '<div class="av-corpo">' +
      '<h1 id="avTit">' + T.encerradoTit + '</h1>' +
      '<p class="av-sub">' + T.encerrado(esc(email || '')) + '</p>' +
      '<div class="av-info">' + ICO_X + '<div><p>' + T.encerradoInfo + '</p></div></div>' +
      '<a class="av-btn" href="' + OFERTA.comprar + '?utm_source=app&utm_medium=reembolsado">' + T.voltar + '</a>' +
      '<button class="av-btn sec" id="avOutro" type="button">' + T.outro + '</button>' +
    '</div>';
  }

  var raiz = null;
  function estilo() {
    if (document.getElementById('ativCss')) return;
    var css = document.createElement('style');
    css.id = 'ativCss';
    css.textContent = CSS;
    (document.head || document.documentElement).appendChild(css);
  }
  function montar(html) {
    estilo();
    document.documentElement.classList.add('ativ-trava');
    var pintar = function () {
      if (!raiz) {
        raiz = document.createElement('div');
        raiz.id = 'ativ';
        raiz.setAttribute('role', 'dialog');
        raiz.setAttribute('aria-modal', 'true');
        raiz.setAttribute('aria-labelledby', 'avTit');
        document.body.appendChild(raiz);
      }
      /* so trava o que estava livre, e marca: ao sair, solta so o que ela travou */
      Array.prototype.forEach.call(document.body.children, function (el) {
        if (el === raiz || el.hasAttribute('inert')) return;
        el.setAttribute('inert', ''); el.setAttribute('data-ativ-inert', '');
      });
      raiz.innerHTML = '<div class="av-topo"><img src="' + BASE + 'img/icones/icone-192.png" alt=""><b>' + OFERTA.marca + '</b></div>' + html;
      raiz.scrollTop = 0;
      ligar();
    };
    if (document.body) pintar(); else document.addEventListener('DOMContentLoaded', pintar);
  }
  function desmontar() {
    document.documentElement.classList.remove('ativ-trava');
    if (raiz) { raiz.remove(); raiz = null; }
    Array.prototype.forEach.call(document.querySelectorAll('[data-ativ-inert]'), function (el) {
      el.removeAttribute('inert'); el.removeAttribute('data-ativ-inert');
    });
  }

  function ligar() {
    var form = document.getElementById('avForm');
    if (form) {
      var inp = document.getElementById('avEmail');
      /* volta com o e-mail que nao foi achado; quem veio do "comprei com outro" comeca vazio */
      if (st.email && (st.estado === 'pendente' || voluntario)) inp.value = st.email;
      setTimeout(function () { try { inp.focus({ preventScroll: true }); } catch (e) {} }, 60);
      inp.addEventListener('input', function () {
        inp.removeAttribute('aria-invalid');
        /* corrigiu o e-mail no meio da espera: solta o botao na hora */
        if (enviando) { tentativa++; enviando = false; botao('livre'); aviso(''); }
      });
      form.addEventListener('submit', function (ev) { ev.preventDefault(); ativar(inp.value); });
    }
    else {
      var tit = document.getElementById('avTit');
      if (tit) { tit.tabIndex = -1; setTimeout(function () { try { tit.focus({ preventScroll: true }); } catch (e) {} }, 60); }
    }
    var fechar = document.getElementById('avFechar');
    if (fechar) fechar.addEventListener('click', function () {
      tentativa++; enviando = false; voluntario = false; procura = null; desmontar();
    });
    var outro = document.getElementById('avOutro');
    if (outro) outro.addEventListener('click', function () { montar(telaEmail()); });
  }

  function aviso(txt, tipo) {
    var m = document.getElementById('avMsg');
    if (m) { m.className = 'av-msg' + (tipo ? ' ' + tipo : ''); m.textContent = txt; }
  }
  function botao(estado) {
    var b = document.getElementById('avBtn');
    if (!b) return;
    b.disabled = estado !== 'livre';
    if (estado === 'livre') b.textContent = voluntario ? T.botaoLiberar : T.botao;
    else if (estado === 'pronto') b.textContent = T.pronto;
    else b.innerHTML = '<span class="av-spin" aria-hidden="true"></span>' + T.conferindo;
  }

  var enviando = false, tentativa = 0;
  function ativar(valor) {
    if (enviando) return;
    var email = String(valor || '').trim();
    var inp = document.getElementById('avEmail');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      if (inp) { inp.setAttribute('aria-invalid', 'true'); inp.focus(); }
      aviso(T.invalido, 'erro');
      return;
    }
    enviando = true;
    var minha = ++tentativa;
    var antes = st.estado;
    botao('ocupado');
    aviso('');
    /* SO NO COMPUTADOR (127.0.0.1 ou localhost), para ver o fluxo sem compra real: teste@notapetinho.test ativa com
       o que a pasta libera (sem produto pelo e-mail, entao os bumps ficam trancados) e reembolso@notapetinho.test
       mostra o acesso encerrado. No ar (github.io) isto nunca roda: la todo e-mail vai ao painel. */
    var sim = LOCAL && { 'test@desideri.test': 'ok', 'rimborso@desideri.test': 'reembolsado' }[email.toLowerCase()];
    if (sim) { ultimoP = []; setTimeout(function () { if (minha === tentativa) concluir(sim, email, null, antes); }, 600); return; }
    var inicio = Date.now();
    hash(email).then(function (h) {
      var tentar = function () {
        if (minha !== tentativa) return Promise.resolve(null);
        return conferir(h, voluntario).then(function (s) {
          if (minha !== tentativa) return null;
          if (s === 'nao_achei' && Date.now() - inicio < ESPERA_VENDA_MS) {
            aviso(T.esperando);
            return new Promise(function (ok) { setTimeout(ok, 10000); }).then(tentar);
          }
          return s;
        });
      };
      return tentar().then(function (s) { if (s) concluir(s, email, h, antes); });
    }).catch(function () { if (minha === tentativa) concluir('erro', email, null, antes); });
  }

  function concluir(s, email, h, antes) {
    enviando = false;
    if (voluntario) {
      /* so o "ok" muda algo: vira ativo com os produtos. Reembolsado, nao achei ou sem rede so
         avisam, e o estado de antes (legado, provisorio) fica */
      if (s === 'ok' && !(procura && !temProduto(ultimoP, procura))) {
        voluntario = false; procura = null;
        gravar({ estado: 'ativo', email: email, h: h, em: Date.now(), p: ultimoP || [] });
        botao('pronto');
        aviso(T.liberado, 'ok');
        setTimeout(function () { desmontar(); avisarProdutos(); }, 900);
        return;
      }
      botao('livre');
      aviso(s === 'erro' ? T.semRede : s === 'ok' ? T.semEsse : T.naoAcheiDepois, 'erro');
      return;
    }
    /* quem ja foi barrado nao entra pelo "sem internet": sem resposta, sem acesso */
    if (s === 'erro' && antes === 'bloqueado') {
      botao('livre');
      aviso(T.semRede, 'erro');
      return;
    }
    if (s === 'reembolsado') {
      gravar({ estado: 'bloqueado', email: email, h: h, em: Date.now() });
      montar(telaEncerrada(email));
      return;
    }
    if (s === 'nao_achei') {
      botao('livre');
      var inp = document.getElementById('avEmail');
      if (inp) inp.setAttribute('aria-invalid', 'true');
      aviso(T.naoAchei, 'erro');
      var m = document.getElementById('avMsg');
      if (m && OFERTA.suporte) {
        var a = document.createElement('a');
        a.className = 'av-btn sec';
        a.href = 'mailto:' + OFERTA.suporte + '?subject=' + encodeURIComponent('Il gioco non si attiva') +
          '&body=' + encodeURIComponent(T.pagueiCorpo + email);
        a.textContent = T.paguei;
        m.appendChild(a);
      }
      return;
    }
    /* ok, ou erro nosso / sem internet: libera. No erro fica provisorio e confere depois. */
    gravar(s === 'ok'
      ? { estado: 'ativo', email: email, h: h, em: Date.now(), p: ultimoP || [] }
      : { estado: 'provisorio', email: email, h: h, em: Date.now() });
    botao('pronto');
    aviso(T.ativado, 'ok');
    setTimeout(function () { desmontar(); avisarProdutos(); }, 900);
  }

  /* ---------- o que o e-mail tem ---------- */
  var voluntario = false, procura = null, comprando = false;
  function temProduto(lista, re) {
    return (lista || []).some(function (n) { return re.test(n); });
  }
  function chaveDosProdutos(lista) { return (lista || []).slice().sort().join('|'); }
  /* o app escuta e se redesenha com o que entrou */
  function avisarProdutos() {
    try { document.dispatchEvent(new CustomEvent('ativacao-produtos', { detail: st.p || [] })); } catch (e) {}
  }

  /* A tela de liberar, aberta pelo app ("Ja comprei, atualizar") ou na volta de uma compra feita
     no app por quem nunca ativou. `procura`: o produto que ela foi comprar (RegExp), para dizer
     "ainda nao chegou" em vez de fechar sem mudar nada. */
  window.Ativacao.liberar = function (opc) {
    if (st.estado === 'bloqueado') return;
    voluntario = true;
    procura = (opc && opc.procura) || null;
    montar(telaEmail());
  };

  /* Quem ja ativou e acabou de comprar dentro do app: confere de 10 em 10 s, por ate 3 min, ate o
     produto novo aparecer. Sem tela: o app so se redesenha. */
  window.Ativacao.conferirCompra = function () {
    if (st.estado !== 'ativo' || !st.h || comprando) return false;
    comprando = true;
    var antes = chaveDosProdutos(st.p), inicio = Date.now();
    (function vez() {
      conferir(st.h, true).then(function (s) {
        if (s === 'reembolsado') { comprando = false; reconferir(); return; }
        if (s === 'ok' && ultimoP) {
          var mudou = chaveDosProdutos(ultimoP) !== antes;
          gravar({ estado: 'ativo', email: st.email, h: st.h, em: Date.now(), p: ultimoP });
          if (mudou) { comprando = false; avisarProdutos(); return; }
        }
        if (Date.now() - inicio < ESPERA_VENDA_MS && document.visibilityState !== 'hidden') setTimeout(vez, 10000);
        else comprando = false;
      });
    })();
    return true;
  };

  /* confere em silencio quem ja ativou; so muda algo se a compra foi reembolsada */
  function reconferir() {
    if (!st.h) {
      if (st.email) hash(st.email).then(function (h) { st.h = h; reconferir(); }).catch(function () {});
      return;
    }
    conferir(st.h).then(function (s) {
      if (s === 'reembolsado') {
        if (st.estado !== 'bloqueado') montar(telaEncerrada(st.email));
        gravar({ estado: 'bloqueado', email: st.email, h: st.h, em: Date.now() });
      } else if (s === 'ok') {
        var eraTrava = st.estado === 'bloqueado';
        var mudou = !!ultimoP && chaveDosProdutos(ultimoP) !== chaveDosProdutos(st.p);
        gravar({ estado: 'ativo', email: st.email, h: st.h, em: Date.now(), p: ultimoP || st.p || [] });
        if (eraTrava) desmontar();
        if (mudou || eraTrava) avisarProdutos();
      } else if (s === 'nao_achei' && st.estado === 'provisorio') {
        gravar({ estado: 'pendente', email: st.email });
        montar(telaEmail(T.naoAcheiDepois));
      }
    });
  }

  /* ---------- ao abrir ---------- */
  function abrir() {
    if (st.estado === 'bloqueado') {
      montar(telaEncerrada(st.email));
      reconferir();
    } else if (st.estado === 'pendente') {
      montar(telaEmail());
    } else if (st.estado === 'provisorio' ||
               (st.estado === 'ativo' && (!Array.isArray(st.p) || Date.now() - (st.em || 0) > RECONFERIR_MS))) {
      reconferir();
    }
  }

  if (st.estado === 'pendente') {
    /* Icone novo no iPhone: o Safari pode ja ter decidido (legado, ativo ou bloqueado). A pagina
       fica escondida ate o espelho responder (milissegundos), para quem ja usava nao ver a tela
       piscar. Sem resposta em 1,5 s, segue. */
    estilo();
    document.documentElement.classList.add('ativ-trava');
    var decidido = false;
    var decidir = function (esp) {
      if (decidido) return;
      decidido = true;
      if (esp && /^(legado|ativo|bloqueado)$/.test(esp.estado) && !st.email) {
        st = esp;
        publicar();
        try { localStorage.setItem(CHAVE, JSON.stringify(st)); } catch (e) {}
        avisarProdutos();
      }
      document.documentElement.classList.remove('ativ-trava');
      abrir();
    };
    lerEspelho().then(decidir);
    setTimeout(function () { decidir(null); }, 1500);
  } else {
    if (st.estado === 'legado') espelhar(st);
    abrir();
  }
})();
