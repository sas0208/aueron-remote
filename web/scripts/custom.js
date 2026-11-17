/* Presentation only. Preserve auth handlers; never inspect passwords or session data. */
(() => {
  'use strict';
  const mark = '<svg class="au-mark" viewBox="0 0 40 40" fill="none" aria-hidden="true"><rect width="40" height="40" rx="12" fill="#5265E8"/><path d="M10 28 20 11l10 17M15 23h10" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const icon = path => '<svg class="au-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>';
  const desktop = icon('<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/>');
  const terminal = icon('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3m6 0h4"/>');
  const folder = icon('<path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11H3Z"/>');
  const shield = icon('<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/>');

  function auth() {
    const panels = ['loginpanel', 'createpanel', 'resetpanel', 'tokenpanel', 'resettokenpanel', 'resetpasswordpanel', 'checkemailpanel', 'waitpushpanel'].map(id => document.getElementById(id)).filter(Boolean);
    if (!panels.some(p => p.id === 'loginpanel') || document.querySelector('.au-auth-shell')) return;
    const shell = document.createElement('div');
    shell.className = 'au-auth-shell';
    shell.innerHTML = `<header class="au-brand">${mark}<div class="au-wordmark">aueron<small>REMOTE</small></div></header>
      <main class="au-auth-main">
        <section class="au-intro" aria-labelledby="au-intro-title">
          <p class="au-eyebrow">IL TUO SPAZIO, OVUNQUE</p>
          <h1 id="au-intro-title">Tutti i tuoi PC.<br><span>Un solo posto.</span></h1>
          <p>Il tuo desktop, i tuoi file e i tuoi progetti.<br>Riprendi da dove eri, anche dal telefono.</p>
          <ul class="au-capabilities"><li>${desktop}Desktop</li><li>${terminal}Terminale</li><li>${folder}File</li></ul>
          <svg class="au-network" viewBox="0 0 450 164" fill="none" aria-hidden="true">
            <path d="M86 81h88m100 0h91" stroke="#4C5F85" stroke-dasharray="4 5"/>
            <circle cx="225" cy="81" r="48" stroke="#2E3E5B"/><circle cx="225" cy="81" r="34" fill="#1F2D49" stroke="#566CB0"/>
            <path d="m211 92 14-25 14 25m-20-7h12" stroke="#B6C1FF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <rect x="8" y="45" width="78" height="56" rx="7" fill="#162239" stroke="#566A8F"/>
            <path d="M18 90h58M47 101v12m-15 0h30" stroke="#8297BB" stroke-linecap="round"/>
            <rect x="365" y="43" width="40" height="76" rx="8" fill="#162239" stroke="#566A8F"/>
            <path d="M378 51h14m-10 59h6" stroke="#8297BB" stroke-linecap="round"/>
            <circle cx="132" cy="81" r="3" fill="#9BACFF"/><circle cx="317" cy="81" r="3" fill="#9BACFF"/>
          </svg>
        </section>
        <section class="au-auth-card" aria-labelledby="au-auth-title">
          <p class="au-eyebrow">CENTRO DI COMANDO</p><h2 id="au-auth-title">Bentornato.</h2>
          <p class="au-auth-description" id="au-auth-description">Accedi al tuo account Aueron per continuare.</p>
          <div class="au-auth-panels"></div>
          <div class="au-auth-note">${shield}<span>Il tuo accesso personale ai computer collegati al centro.</span></div>
        </section>
      </main>
      <footer class="au-auth-footer"><span>Aueron Remote · Powered by MeshCentral</span><span class="au-footer-links"></span></footer>`;
    const target = shell.querySelector('.au-auth-panels');
    panels.forEach(panel => target.appendChild(panel));
    document.querySelectorAll('#centralTable #flink a').forEach(link => shell.querySelector('.au-footer-links').appendChild(link));
    document.body.appendChild(shell);
    document.body.classList.add('au-auth');
    [['username', 'Nome utente'], ['password', 'Password']].forEach(([id, title]) => {
      const field = document.getElementById(id);
      if (!field) return;
      const label = document.createElement('label');
      label.className = 'au-field-label'; label.htmlFor = id; label.textContent = title;
      field.before(label); field.setAttribute('placeholder', id === 'username' ? 'Il tuo nome utente' : 'La tua password');
    });
    const button = document.getElementById('loginButton');
    if (button) button.value = 'Entra nel centro';
    const headings = {
      loginpanel: ['Bentornato.', 'Accedi al tuo account Aueron per continuare.'],
      createpanel: ['Il tuo account.', 'Scegli una password di almeno 10 caratteri.'],
      resetpanel: ['Recupera l’accesso.', 'Segui le indicazioni per recuperare il tuo account.'],
      tokenpanel: ['Conferma l’accesso.', 'Completa la verifica richiesta dal tuo account.'],
      resettokenpanel: ['Verifica il tuo account.', 'Inserisci il codice richiesto per continuare.'],
      resetpasswordpanel: ['Una nuova password.', 'Scegli una password di almeno 10 caratteri.'],
      checkemailpanel: ['Controlla la tua email.', 'Segui le indicazioni per completare la verifica.'],
      waitpushpanel: ['Conferma sul dispositivo.', 'In attesa della tua approvazione.']
    };
    const update = () => {
      const panel = panels.find(p => p.style.display !== 'none');
      if (!panel || !headings[panel.id]) return;
      document.getElementById('au-auth-title').textContent = headings[panel.id][0];
      document.getElementById('au-auth-description').textContent = headings[panel.id][1];
    };
    const observer = new MutationObserver(update);
    panels.forEach(panel => observer.observe(panel, { attributes: true, attributeFilter: ['style'] }));
    update();
  }

  function workspace() {
    if (!document.getElementById('page_leftbar') || document.body.classList.contains('au-workspace')) return;
    document.body.classList.add('au-workspace');
    const masthead = document.querySelector('.masthead-left');
    if (masthead) {
      const logo = document.createElement('span'); logo.className = 'au-workspace-logo'; logo.innerHTML = mark;
      masthead.prepend(logo);
    }
    const labels = { LeftMenuMyDevices: 'Dispositivi', LeftMenuMyAccount: 'Il mio account', LeftMenuMyEvents: 'Attività', LeftMenuMyFiles: 'File del centro', LeftMenuMyUsers: 'Utenti', LeftMenuMyServer: 'Impostazioni' };
    Object.entries(labels).forEach(([id, text]) => {
      const link = document.getElementById(id);
      if (!link) return;
      link.setAttribute('aria-label', text); link.setAttribute('title', text);
      const label = document.createElement('span'); label.className = 'au-nav-label'; label.textContent = text;
      link.appendChild(label);
    });
    const heading = document.querySelector('#p1title > div:first-child');
    if (heading) {
      heading.className = 'au-devices-heading';
      // 2/11/2026: sul telefono niente link all'installatore per Windows (un tocco per sbaglio scaricava AueronHost-Setup.zip)
      const telefono = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      heading.innerHTML = '<h1>I tuoi dispositivi</h1><p>Apri un computer per accedere a desktop, terminale e file.</p>' + (telefono ? '' : '<a class="au-install-host" href="downloads/AueronHost-Setup.zip" download>Collega un PC Windows <span aria-hidden="true">\u2197</span></a>');
    }
    const empty = document.getElementById('NoMeshesPanel');
    if (empty) {
      const oldIcon = empty.querySelector('img');
      if (oldIcon) {
        const image = document.createElement('span'); image.className = 'au-empty-icon'; image.innerHTML = desktop;
        oldIcon.replaceWith(image);
      }
      const heading = document.createElement('h2'); heading.textContent = 'Il prossimo PC parte da qui.';
      empty.prepend(heading);
      const start = document.querySelector('#getStarted1 a');
      if (start) start.textContent = 'Crea il tuo primo gruppo di dispositivi';
      const text = document.querySelector('#getStarted1');
      if (text && text.firstChild?.nodeType === Node.TEXT_NODE) text.firstChild.textContent = '';
      if (text) [...text.childNodes].filter(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim() === '.').forEach(node => node.remove());
    }
  }

  const start = () => { if (document.body.classList.contains('login')) auth(); else workspace(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();

/* 2/11/2026 (apertura diretta di desktop o terminale da un link esterno). Il link arriva con
   viewmode=11 (Desktop) o 12 (Terminale) e connetti=1: appena il PC è caricato ci si collega UNA volta, con le stesse
   chiamate del menu del PC di MeshCentral (default3 riga 7934-7936). Niente password lette, niente altro toccato:
   se il PC è spento o non ha i permessi, resta la scheda col tasto Connetti. Si smette di provare dopo 30 secondi. */
(() => {
  'use strict';
  // la pagina riscrive subito l'indirizzo (resta solo «?connetti=1»): la scheda si legge da xxcurrentView
  if (new URLSearchParams(location.search).get('connetti') !== '1') return;
  const fine = Date.now() + 30000;
  const prova = () => {
    if (Date.now() > fine) return;
    try {
      // nomi della pagina: alcuni non stanno su window (dichiarati con let nella versione compressa), si leggono per nome
      /* global xxcurrentView, currentNode, meshes, xxdialogMode, desktop, terminal, connectDesktop, connectTerminal */
      const vista = typeof xxcurrentView === 'number' ? xxcurrentView : null;
      const n = typeof currentNode === 'object' ? currentNode : null;
      const m = n && typeof meshes === 'object' && meshes ? meshes[n.meshid] : null;
      if ((vista === 11 || vista === 12) && n && m && n.agent && (n.conn & 1) && m.mtype == 2 && !(typeof xxdialogMode !== 'undefined' && xxdialogMode)) {
        if (vista === 11) { if (desktop == null && (n.agent.caps & 1)) connectDesktop(null, 3); return; }
        if (terminal == null && (n.agent.caps & 2)) connectTerminal(null, 1);
        return;
      }
    } catch { /* pagina non ancora pronta */ }
    setTimeout(prova, 400);
  };
  prova();
})();
