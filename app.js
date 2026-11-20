/* Geschenke-Gedächtnis – App-Logik. Alle Daten bleiben im Browser (localStorage). */
(function () {
  'use strict';
  const D = window.GiftDetector;
  const KEY = 'geschenke-gedaechtnis-v1';
  const STATUS = { idea: { icon: '', label: 'Idee' }, bought: { icon: '🛍️', label: 'Gekauft' }, given: { icon: '✓', label: 'Verschenkt' } };
  const NEXT_STATUS = { idea: 'bought', bought: 'given', given: 'idea' };

  // ---------- Speicher ----------
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && Array.isArray(s.persons)) return Object.assign(blank(), s);
    } catch (e) { /* leer starten */ }
    return blank();
  }
  function blank() { return { persons: [], ideas: [], settings: { myNames: [], consent: false }, seen: [] }; }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { toast('Speichern nicht möglich – ist der Speicher voll oder privat?'); }
  }
  let state = load();

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const linkify = s => esc(s).replace(/https?:\/\/[^\s<]+/g, u => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u.length > 45 ? u.slice(0, 42) + '…' : u}</a>`);
  const initials = n => (n || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const fmtDate = iso => iso ? new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };

  const personById = id => state.persons.find(p => p.id === id);
  const ideasOf = id => state.ideas.filter(i => i.personId === id);
  function findPersonByName(name) {
    const n = (name || '').trim().toLowerCase();
    if (!n) return null;
    return state.persons.find(p => p.name.toLowerCase() === n || (p.aliases || []).some(a => a.toLowerCase() === n)) || null;
  }

  function daysUntilBirthday(iso) {
    if (!iso) return null;
    const [, m, d] = iso.split('-').map(Number);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let next = new Date(today.getFullYear(), m - 1, d);
    if (next < today) next = new Date(today.getFullYear() + 1, m - 1, d);
    return Math.round((next - today) / 86400000);
  }
  const inDays = n => n === 0 ? 'heute 🎉' : n === 1 ? 'morgen' : `in ${n} Tagen`;

  // ---------- UI-Helfer ----------
  const view = document.getElementById('view');
  const titleEl = document.getElementById('title');
  const backBtn = document.getElementById('backBtn');
  const dialog = document.getElementById('dialog');
  const dialogForm = document.getElementById('dialogForm');

  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600);
  }

  /** Einfacher Formular-Dialog. fields: [{name,label,type,value,options,placeholder}] */
  function formDialog({ title, text, fields = [], ok = 'Speichern', danger }) {
    return new Promise(resolve => {
      dialogForm.innerHTML = `
        <h3>${esc(title)}</h3>
        ${text ? `<p class="muted">${text}</p>` : ''}
        ${fields.map(f => `
          <label for="f_${f.name}">${esc(f.label)}</label>
          ${f.type === 'select'
            ? `<select id="f_${f.name}" name="${f.name}">${f.options.map(o => `<option value="${esc(o.value)}" ${o.value === f.value ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`
            : f.type === 'textarea'
              ? `<textarea id="f_${f.name}" name="${f.name}" placeholder="${esc(f.placeholder || '')}">${esc(f.value || '')}</textarea>`
              : `<input id="f_${f.name}" name="${f.name}" type="${f.type || 'text'}" value="${esc(f.value || '')}" placeholder="${esc(f.placeholder || '')}" ${f.required ? 'required' : ''}>`}
        `).join('')}
        <div class="actions">
          <button class="btn ${danger ? 'danger' : ''}" value="ok">${esc(ok)}</button>
          <button class="btn secondary" value="cancel" formnovalidate>Abbrechen</button>
        </div>`;
      dialog.onclose = () => {
        if (dialog.returnValue !== 'ok') return resolve(null);
        const data = {};
        fields.forEach(f => { data[f.name] = dialogForm.elements[f.name].value.trim(); });
        resolve(data);
      };
      dialog.returnValue = '';
      dialog.showModal();
      const first = dialogForm.querySelector('input, textarea');
      if (first) setTimeout(() => first.focus(), 50);
    });
  }

  // ---------- Navigation ----------
  let route = { name: 'home' };
  let pendingCandidates = null;
  const navStack = [];

  function go(name, params = {}, push = true) {
    if (push && route.name !== name) navStack.push(route);
    route = { name, ...params };
    document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === (TAB_OF[name] || name)));
    render();
    window.scrollTo(0, 0);
  }
  const TAB_OF = { person: 'home', review: 'import' };
  backBtn.onclick = () => { const prev = navStack.pop() || { name: 'home' }; go(prev.name, prev, false); };
  document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { navStack.length = 0; go(b.dataset.tab, {}, false); });

  function render() {
    backBtn.hidden = !['person', 'review'].includes(route.name);
    ({ home: renderHome, person: renderPerson, ideas: renderIdeas, import: renderImport, review: renderReview, settings: renderSettings })[route.name]();
  }

  // ---------- Personen ----------
  function renderHome() {
    titleEl.textContent = 'Geschenke-Gedächtnis';
    const upcoming = state.persons
      .map(p => ({ p, d: daysUntilBirthday(p.birthday) }))
      .filter(x => x.d !== null && x.d <= 30).sort((a, b) => a.d - b.d);
    const sorted = [...state.persons].sort((a, b) => a.name.localeCompare(b.name, 'de'));

    view.innerHTML = `
      ${upcoming.map(({ p, d }) => {
        const open = ideasOf(p.id).filter(i => i.status !== 'given').length;
        return `<button class="row card banner" data-person="${p.id}">
          <div class="avatar">🎂</div>
          <div class="grow"><div class="title">${esc(p.name)} hat ${inDays(d)} Geburtstag</div>
          <div class="sub">${open ? `${open} Idee${open > 1 ? 'n' : ''} gesammelt – schau rein!` : 'Noch keine Idee – Zeit zum Überlegen.'}</div></div>
        </button>`;
      }).join('')}
      <h2>Deine Liebsten</h2>
      ${sorted.length ? `<div class="list">${sorted.map(p => {
        const ideas = ideasOf(p.id); const open = ideas.filter(i => i.status !== 'given').length;
        const d = daysUntilBirthday(p.birthday);
        return `<button class="row" data-person="${p.id}">
          <div class="avatar">${esc(initials(p.name))}</div>
          <div class="grow"><div class="title">${esc(p.name)}</div>
            <div class="sub">${d !== null ? `🎂 ${inDays(d)}` : 'Kein Geburtstag eingetragen'}</div></div>
          ${open ? `<span class="badge">${open} 💡</span>` : ''}
        </button>`;
      }).join('')}</div>` : `
        <div class="empty"><div class="big">🎁</div>
          <p>Noch niemand hier.<br>Leg eine Person an oder lass dir Ideen aus einem Chat vorschlagen.</p></div>`}
      <div class="actions">
        <button class="btn" id="addPerson">+ Person</button>
        <button class="btn secondary" id="toImport">💬 Chat durchsuchen</button>
      </div>`;
    view.querySelectorAll('[data-person]').forEach(b => b.onclick = () => go('person', { id: b.dataset.person }));
    view.querySelector('#addPerson').onclick = () => editPerson();
    view.querySelector('#toImport').onclick = () => go('import');
  }

  async function editPerson(p) {
    const data = await formDialog({
      title: p ? 'Person bearbeiten' : 'Neue Person',
      fields: [
        { name: 'name', label: 'Name', value: p?.name, required: true, placeholder: 'z. B. Anna' },
        { name: 'birthday', label: 'Geburtstag (optional)', type: 'date', value: p?.birthday },
        { name: 'aliases', label: 'Andere Namen im Chat (optional, mit Komma)', value: (p?.aliases || []).join(', '), placeholder: 'z. B. Mama, Anni 🌸' },
      ],
    });
    if (!data || !data.name) return null;
    const aliases = data.aliases.split(',').map(s => s.trim()).filter(Boolean);
    if (p) Object.assign(p, { name: data.name, birthday: data.birthday || null, aliases });
    else { p = { id: uid(), name: data.name, birthday: data.birthday || null, aliases }; state.persons.push(p); }
    save(); render();
    return p;
  }

  function renderPerson() {
    const p = personById(route.id);
    if (!p) return go('home', {}, false);
    titleEl.textContent = p.name;
    const ideas = ideasOf(p.id).sort((a, b) => (a.status === 'given') - (b.status === 'given') || b.createdAt - a.createdAt);
    const d = daysUntilBirthday(p.birthday);
    view.innerHTML = `
      <div class="card row">
        <div class="avatar">${esc(initials(p.name))}</div>
        <div class="grow"><div class="title">${esc(p.name)}</div>
          <div class="sub">${p.birthday ? `🎂 ${fmtDate(p.birthday)} · ${inDays(d)}` : 'Kein Geburtstag eingetragen'}
          ${p.aliases?.length ? `<br>Im Chat auch: ${esc(p.aliases.join(', '))}` : ''}</div></div>
        <button class="btn secondary small" id="editP">Bearbeiten</button>
      </div>
      <h2>Ideen</h2>
      ${ideas.length ? ideas.map(i => ideaCard(i)).join('') : `<div class="empty"><div class="big">💡</div><p>Noch keine Ideen für ${esc(p.name)}.</p></div>`}
      <div class="actions"><button class="btn" id="addIdea">+ Idee</button></div>
      <div class="actions"><button class="btn danger small" id="delP">Person löschen</button></div>`;
    bindIdeaCards();
    view.querySelector('#editP').onclick = () => editPerson(p);
    view.querySelector('#addIdea').onclick = () => editIdea(null, p.id);
    view.querySelector('#delP').onclick = async () => {
      const ok = await formDialog({ title: `${p.name} löschen?`, text: 'Alle Ideen für diese Person werden mitgelöscht.', ok: 'Löschen', danger: true });
      if (!ok) return;
      state.persons = state.persons.filter(x => x.id !== p.id);
      state.ideas = state.ideas.filter(i => i.personId !== p.id);
      save(); toast('Gelöscht'); go('home', {}, false);
    };
  }

  // ---------- Ideen ----------
  function ideaCard(i, showPerson) {
    const st = i.status || 'idea';
    const person = personById(i.personId);
    return `<div class="card idea ${st}">
      <button class="status" data-toggle="${i.id}" title="Status: ${STATUS[st].label} (tippen zum Ändern)" aria-label="Status ${STATUS[st].label}">${STATUS[st].icon}</button>
      <div class="grow">
        <div class="title">${esc(i.title)}</div>
        <div class="sub">${showPerson && person ? `für ${esc(person.name)} · ` : ''}${STATUS[st].label}${i.source === 'chat' ? ' · aus Chat' : ''}${i.date ? ' · ' + fmtDate(i.date) : ''}</div>
        ${i.note ? `<div class="quote">${linkify(i.note)}</div>` : ''}
      </div>
      <button class="btn secondary small" data-edit="${i.id}">✎</button>
    </div>`;
  }
  function bindIdeaCards() {
    view.querySelectorAll('[data-toggle]').forEach(b => b.onclick = () => {
      const i = state.ideas.find(x => x.id === b.dataset.toggle);
      i.status = NEXT_STATUS[i.status || 'idea']; save(); render();
      toast(`Status: ${STATUS[i.status].label}`);
    });
    view.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => editIdea(state.ideas.find(x => x.id === b.dataset.edit)));
  }

  async function editIdea(idea, personId) {
    if (!state.persons.length) { toast('Leg zuerst eine Person an'); return editPerson(); }
    const data = await formDialog({
      title: idea ? 'Idee bearbeiten' : 'Neue Idee',
      fields: [
        { name: 'title', label: 'Was?', value: idea?.title, required: true, placeholder: 'z. B. Kaffeemühle' },
        { name: 'personId', label: 'Für wen?', type: 'select', value: idea?.personId || personId, options: state.persons.map(p => ({ value: p.id, label: p.name })) },
        { name: 'status', label: 'Status', type: 'select', value: idea?.status || 'idea', options: Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label })) },
        { name: 'note', label: 'Notiz / Link / Chat-Zitat', type: 'textarea', value: idea?.note },
      ],
    });
    if (!data || !data.title) return;
    if (idea) Object.assign(idea, data);
    else state.ideas.push({ id: uid(), ...data, source: 'manual', date: null, createdAt: Date.now() });
    save(); render();
  }

  let ideaFilter = 'open';
  function renderIdeas() {
    titleEl.textContent = 'Alle Ideen';
    const filters = { open: 'Offen', bought: 'Gekauft', given: 'Verschenkt', all: 'Alle' };
    const list = state.ideas.filter(i => ideaFilter === 'all' || (ideaFilter === 'open' ? i.status !== 'given' : i.status === ideaFilter))
      .sort((a, b) => b.createdAt - a.createdAt);
    view.innerHTML = `
      <div class="filters">${Object.entries(filters).map(([k, l]) => `<button class="chip ${k === ideaFilter ? 'active' : ''}" data-f="${k}">${l}</button>`).join('')}</div>
      ${list.length ? list.map(i => ideaCard(i, true)).join('') : `<div class="empty"><div class="big">💡</div><p>Hier ist noch nichts.</p></div>`}
      <div class="actions"><button class="btn" id="addIdea">+ Idee</button></div>
      <p class="muted">Tipp: Tippe auf den Kreis, um eine Idee als <b>gekauft</b> 🛍️ und danach als <b>verschenkt</b> ✓ zu markieren.</p>`;
    view.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { ideaFilter = b.dataset.f; render(); });
    view.querySelector('#addIdea').onclick = () => editIdea();
    bindIdeaCards();
  }

  // ---------- Chat-Import ----------
  let importDraft = '';
  function renderImport() {
    titleEl.textContent = 'Wünsche aus Chats finden';
    const s = state.settings;
    view.innerHTML = `
      <div class="card privacy"><span>🔒</span><div>
        <div class="title">Bleibt auf deinem Gerät</div>
        <div class="muted">Die App liest nur Chats, die <b>du selbst</b> hier hineingibst. Sie werden lokal durchsucht, nichts wird hochgeladen oder gespeichert – nur die Ideen, die du übernimmst.</div>
      </div></div>

      <h2>So geht's</h2>
      <div class="card"><ol class="steps">
        <li><b>WhatsApp:</b> Chat öffnen → Name antippen (iPhone) bzw. ⋮ → Mehr (Android) → <b>Chat exportieren</b> → „Ohne Medien“.</li>
        <li><b>Android:</b> Als Ziel direkt „Geschenke“ wählen (wenn die App installiert ist) – fertig.<br>
            <b>iPhone:</b> „In Dateien sichern“, dann hier unten die Datei wählen.</li>
        <li><b>Telegram:</b> Desktop → Chat exportieren → Format JSON.</li>
        <li>Oder einfach einzelne Nachrichten kopieren und unten einfügen.</li>
      </ol></div>

      <h2>Chat einlesen</h2>
      <div class="card">
        <label for="file">Export-Datei (.txt, .zip oder .json)</label>
        <input type="file" id="file" accept=".txt,.zip,.json,text/plain,application/zip,application/json" multiple>
        <label for="paste">…oder Text einfügen</label>
        <textarea id="paste" placeholder="20.11.26, 18:45 - Anna: Ich wünsche mir so sehr eine neue Kaffeemühle!">${esc(importDraft)}</textarea>
        <label for="shots">📸 …oder Screenshots vom Chat</label>
        <input type="file" id="shots" accept="image/*" multiple>
        <div id="shotOpts" hidden>
          <label for="shotPerson">Mit wem ist der Chat auf den Screenshots?</label>
          <select id="shotPerson">
            <option value="">Später zuordnen</option>
            ${state.persons.map(p => `<option value="${esc(p.name)}">${esc(p.name)}</option>`).join('')}
          </select>
          <label class="check"><input type="checkbox" id="skipRight" checked>
            <span>Meine eigenen Nachrichten (Blasen rechts) überspringen</span></label>
          <p class="muted">Die Texterkennung läuft auf deinem Gerät. Das erste Mal dauert sie etwas länger.</p>
        </div>
        <label for="myName">Dein eigener Name im Chat</label>
        <input id="myName" value="${esc(s.myNames.join(', '))}" placeholder="z. B. Jana (deine eigenen Nachrichten werden übersprungen)">
        <label class="check"><input type="checkbox" id="consent" ${s.consent ? 'checked' : ''}>
          <span>Ich erlaube der App, die von mir ausgewählten Chats lokal auf Wünsche zu durchsuchen.</span></label>
        <button class="btn block" id="scan">🔍 Wünsche finden</button>
      </div>`;
    const paste = view.querySelector('#paste');
    paste.oninput = () => { importDraft = paste.value; };
    const shots = view.querySelector('#shots');
    shots.onchange = () => { view.querySelector('#shotOpts').hidden = !shots.files.length; };
    view.querySelector('#scan').onclick = async () => {
      const consent = view.querySelector('#consent').checked;
      if (!consent) return toast('Bitte erst die Erlaubnis bestätigen ☝️');
      s.consent = true;
      s.myNames = view.querySelector('#myName').value.split(',').map(x => x.trim()).filter(Boolean);
      save();
      const texts = [];
      const scanBtn = view.querySelector('#scan');
      const files = [...view.querySelector('#file').files, ...shots.files];
      const shotSender = view.querySelector('#shotPerson')?.value || '';
      const skipRight = view.querySelector('#skipRight')?.checked ?? true;
      scanBtn.disabled = true;
      try {
        for (const f of files) {
          try { texts.push(await readSource(f, { sender: shotSender, skipRight, progress: t => { scanBtn.textContent = t; } })); }
          catch (e) { console.error(e); toast(`${f.name}: ${e.message}`); }
        }
      } finally { scanBtn.disabled = false; scanBtn.textContent = '🔍 Wünsche finden'; }
      if (paste.value.trim()) texts.push({ text: paste.value, name: 'Eingefügter Text' });
      if (!texts.length) return toast('Wähle eine Datei, Screenshots oder füge Text ein');
      scanTexts(texts);
    };
  }

  async function readFile(file) {
    const buf = await file.arrayBuffer();
    const head = new Uint8Array(buf.slice(0, 4));
    if (head[0] === 0x50 && head[1] === 0x4b) return D.readZipText(buf);
    return new TextDecoder().decode(buf);
  }

  const isImage = f => /^image\//.test(f.type) || /\.(png|jpe?g|webp|heic|gif|bmp)$/i.test(f.name || '');

  /** Datei → {text,name} oder {messages,name} (Screenshots) */
  async function readSource(file, opts = {}) {
    if (!isImage(file)) return { text: await readFile(file), name: file.name };
    const messages = await ocrScreenshot(file, opts.progress, opts.index);
    return {
      name: file.name,
      messages: messages
        .filter(m => !(opts.skipRight && m.side === 'right'))
        .map(m => ({ sender: opts.sender || '', date: null, text: m.text })),
    };
  }

  // ---------- Texterkennung (Tesseract.js, lokal im Ordner vendor/) ----------
  let ocrWorker = null;
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = Object.assign(document.createElement('script'), { src, onload: res, onerror: () => rej(new Error('Texterkennung konnte nicht geladen werden')) });
      document.head.appendChild(s);
    });
  }
  let ocrProgress = () => {};
  async function getOcr() {
    if (ocrWorker) return ocrWorker;
    if (!window.Tesseract) await loadScript('vendor/tesseract/tesseract.min.js');
    const abs = p => new URL(p, location.href).href;
    ocrWorker = await window.Tesseract.createWorker('deu', 1, {
      workerPath: abs('vendor/tesseract/worker.min.js'),
      corePath: abs('vendor/tesseract/core'),
      langPath: abs('vendor/tesseract/lang'),
      gzip: true,
      logger: m => ocrProgress(m),
    });
    return ocrWorker;
  }

  /** Bild vorbereiten: Graustufen, dunkles Design invertieren, kleine Bilder vergrößern */
  async function prepareImage(file) {
    const bmp = await createImageBitmap(file);
    const scale = bmp.width < 900 ? 2 : 1;
    const c = document.createElement('canvas');
    c.width = bmp.width * scale; c.height = bmp.height * scale;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const d = img.data; let sum = 0;
    for (let i = 0; i < d.length; i += 4) { const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; d[i] = d[i + 1] = d[i + 2] = g; sum += g; }
    if (sum / (d.length / 4) < 110) for (let i = 0; i < d.length; i += 4) d[i] = d[i + 1] = d[i + 2] = 255 - d[i];
    ctx.putImageData(img, 0, 0);
    return c;
  }

  async function ocrScreenshot(file, progress = () => {}) {
    progress('⏳ Texterkennung wird geladen…');
    ocrProgress = m => {
      if (m.status === 'recognizing text') progress(`📸 Lese ${file.name.slice(0, 18)}… ${Math.round(m.progress * 100)} %`);
    };
    const worker = await getOcr();
    const canvas = await prepareImage(file);
    const { data } = await worker.recognize(canvas);
    const lines = data.lines && data.lines.length ? data.lines
      : (data.text || '').split('\n').map((text, i) => ({ text, confidence: 90, bbox: { x0: 0, y0: i * 40, x1: canvas.width, y1: i * 40 + 30 } }));
    return D.linesToMessages(lines, canvas.width);
  }

  function chatNameFrom(fileName) {
    const m = (fileName || '').match(/(?:WhatsApp[- ]Chat (?:mit|with) )(.+?)\.(?:txt|zip)$/i);
    return m ? m[1].trim() : '';
  }

  function scanTexts(texts) {
    let total = 0;
    const candidates = [];
    for (const src of texts) {
      const { text, name } = src;
      const msgs = src.messages || D.parseChat(text, name);
      total += msgs.length;
      const fallbackSender = chatNameFrom(name);
      for (const w of D.findWishes(msgs, state.settings.myNames)) {
        const sender = w.sender || fallbackSender;
        const h = hash(sender + '|' + w.text);
        if (candidates.some(c => c.key === h)) continue; // z. B. überlappende Screenshots
        candidates.push({
          key: h, sender, item: w.item, text: w.text, date: w.date, score: w.score,
          include: w.score >= 3 && !state.seen.includes(h),
          already: state.seen.includes(h),
          personId: findPersonByName(sender)?.id || 'new',
        });
      }
    }
    pendingCandidates = { candidates, total };
    importDraft = '';
    go('review');
  }

  function renderReview() {
    titleEl.textContent = 'Gefundene Wünsche';
    if (!pendingCandidates) return go('import', {}, false);
    const { candidates, total } = pendingCandidates;
    const personOptions = c => [
      ...state.persons.map(p => `<option value="${p.id}" ${c.personId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`),
      `<option value="new" ${c.personId === 'new' ? 'selected' : ''}>+ Neue Person${c.sender ? `: ${esc(c.sender)}` : ''}</option>`,
    ].join('');

    view.innerHTML = `
      <p class="muted">${total} Nachrichten durchsucht · <b>${candidates.length}</b> mögliche Wünsche gefunden.
      Hake an, was du übernehmen willst – du kannst Text und Person anpassen.</p>
      ${candidates.length ? candidates.map((c, idx) => `
        <div class="card candidate ${c.include ? '' : 'off'}" data-idx="${idx}">
          <label class="check" style="margin:0"><input type="checkbox" data-inc ${c.include ? 'checked' : ''}>
            <span><b>${esc(c.sender || 'Unbekannt')}</b> <span class="muted">${c.date ? fmtDate(c.date) : ''}
            ${c.score >= 4 ? '· sehr wahrscheinlich' : c.score >= 3 ? '· wahrscheinlich' : '· vielleicht'}
            ${c.already ? '· schon mal übernommen' : ''}</span></span></label>
          <div class="quote">${linkify(c.text.length > 300 ? c.text.slice(0, 300) + '…' : c.text)}</div>
          <div class="grid">
            <input data-item value="${esc(c.item)}" aria-label="Geschenkidee">
            <select data-person aria-label="Für wen">${personOptions(c)}</select>
          </div>
        </div>`).join('') : `<div class="empty"><div class="big">🤷</div><p>Keine Wünsche gefunden.<br>Tipp: Prüfe, ob dein eigener Name richtig eingetragen ist.</p></div>`}
      <div class="actions">
        ${candidates.length ? `<button class="btn" id="accept">Ausgewählte übernehmen</button>` : ''}
        <button class="btn secondary" id="again">Anderen Chat</button>
      </div>`;

    view.querySelectorAll('.candidate').forEach(el => {
      const c = candidates[el.dataset.idx];
      el.querySelector('[data-inc]').onchange = e => { c.include = e.target.checked; el.classList.toggle('off', !c.include); };
      el.querySelector('[data-item]').oninput = e => { c.item = e.target.value; };
      el.querySelector('[data-person]').onchange = e => { c.personId = e.target.value; };
    });
    view.querySelector('#again').onclick = () => go('import', {}, false);
    const acc = view.querySelector('#accept');
    if (acc) acc.onclick = acceptCandidates;
  }

  async function acceptCandidates() {
    const chosen = pendingCandidates.candidates.filter(c => c.include && c.item.trim());
    if (!chosen.length) return toast('Nichts ausgewählt');
    const created = {};
    for (const c of chosen) {
      let pid = c.personId;
      if (pid === 'new') {
        const key = (c.sender || '').toLowerCase();
        if (created[key]) pid = created[key];
        else {
          let p = findPersonByName(c.sender);
          if (!p) {
            const name = c.sender || (await formDialog({ title: 'Für wen ist diese Idee?', text: esc(c.item), fields: [{ name: 'name', label: 'Name', required: true }] }))?.name;
            if (!name) continue;
            p = { id: uid(), name, birthday: null, aliases: [] };
            state.persons.push(p);
          }
          pid = created[key] = p.id;
        }
      }
      state.ideas.push({ id: uid(), personId: pid, title: c.item.trim(), status: 'idea', note: c.text, source: 'chat', date: c.date, createdAt: Date.now() });
      if (!state.seen.includes(c.key)) state.seen.push(c.key);
    }
    state.seen = state.seen.slice(-5000);
    save();
    pendingCandidates = null;
    toast(`${chosen.length} Idee${chosen.length > 1 ? 'n' : ''} gespeichert 🎁`);
    navStack.length = 0;
    go('home', {}, false);
  }

  // ---------- Einstellungen ----------
  function renderSettings() {
    titleEl.textContent = 'Mehr';
    view.innerHTML = `
      <h2>App aufs Handy</h2>
      <div class="card"><p><b>Android (Chrome):</b> Menü ⋮ → „App installieren“. Danach taucht „Geschenke“ beim Teilen von WhatsApp-Chats auf.</p>
        <p style="margin:0"><b>iPhone (Safari):</b> Teilen-Symbol → „Zum Home-Bildschirm“.</p></div>
      <h2>Datensicherung</h2>
      <div class="card">
        <p class="muted">Deine Daten liegen nur in diesem Browser. Sichere sie ab und zu als Datei.</p>
        <div class="actions" style="margin-top:0">
          <button class="btn secondary" id="export">⬇️ Sichern</button>
          <label class="btn secondary" style="margin:0">⬆️ Wiederherstellen<input type="file" id="restore" accept=".json" hidden></label>
        </div>
      </div>
      <h2>Datenschutz</h2>
      <div class="card"><p class="muted">Keine Konten, keine Server, kein Tracking. Chats werden nur durchsucht, wenn du sie selbst auswählst, und danach sofort verworfen. Gespeichert werden nur übernommene Ideen inkl. der zugehörigen Nachricht.</p>
        <div class="actions"><button class="btn secondary small" id="revoke">Erlaubnis zurückziehen</button>
        <button class="btn danger small" id="wipe">Alle Daten löschen</button></div></div>
      <p class="muted" style="text-align:center">${state.persons.length} Personen · ${state.ideas.length} Ideen</p>`;

    view.querySelector('#export').onclick = () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `geschenke-backup-${new Date().toISOString().slice(0, 10)}.json` });
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    view.querySelector('#restore').onchange = async e => {
      try {
        const data = JSON.parse(await e.target.files[0].text());
        if (!Array.isArray(data.persons) || !Array.isArray(data.ideas)) throw new Error();
        state = Object.assign(blank(), data); save(); toast('Wiederhergestellt'); render();
      } catch { toast('Diese Datei ist keine gültige Sicherung'); }
    };
    view.querySelector('#revoke').onclick = () => { state.settings.consent = false; save(); toast('Erlaubnis zurückgezogen'); };
    view.querySelector('#wipe').onclick = async () => {
      const ok = await formDialog({ title: 'Wirklich alles löschen?', text: 'Alle Personen und Ideen werden unwiderruflich entfernt.', ok: 'Alles löschen', danger: true });
      if (!ok) return;
      state = blank(); save(); toast('Alles gelöscht'); render();
    };
  }

  // ---------- Geteilte Inhalte (Android Share Target) ----------
  async function checkSharedInbox() {
    if (!new URLSearchParams(location.search).has('shared') || !('caches' in window)) return false;
    window.history.replaceState(null, '', location.pathname);
    const inbox = await caches.open('share-inbox');
    const texts = [];
    for (const req of await inbox.keys()) {
      if (!/\/file-\d+$/.test(new URL(req.url).pathname)) continue;
      const res = await inbox.match(req);
      const name = decodeURIComponent(res.headers.get('x-file-name') || 'chat.txt');
      const blob = await res.blob();
      try { texts.push(await readSource(new File([blob], name, { type: blob.type }), { skipRight: true, progress: toast })); }
      catch (e) { toast(e.message); }
    }
    const textRes = await inbox.match('text');
    if (textRes) texts.push({ text: await textRes.text(), name: 'Geteilter Text' });
    await caches.delete('share-inbox');
    if (!texts.length) return false;
    if (!state.settings.consent) {
      const ok = await formDialog({ title: 'Chat durchsuchen?', text: 'Du hast einen Chat mit der App geteilt. Darf sie ihn lokal auf deinem Gerät nach Geschenkwünschen durchsuchen? Es wird nichts hochgeladen.', ok: 'Ja, erlauben' });
      if (!ok) return false;
      state.settings.consent = true; save();
    }
    scanTexts(texts);
    return true;
  }

  // ---------- Start ----------
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  checkSharedInbox().then(handled => { if (!handled) render(); });
})();
