/*
 * Snow Rider 3D – Autopilot (Lesezeichen / Bookmarklet)
 *
 * Funktionsweise:
 *  1. Findet das WebGL-Canvas des Spiels (auch in einem iframe derselben Domain).
 *     Liegt das Spiel in einem fremden iframe, bietet es an, die Spielseite direkt
 *     zu öffnen – dort tippt man das Lesezeichen einfach noch einmal an.
 *  2. Hängt sich in requestAnimationFrame ein und liest direkt nach jedem
 *     gerenderten Bild ein paar Pixelzeilen vor dem Schlitten aus.
 *  3. Teilt das Bild in Spalten, bewertet jede Spalte nach "Nicht-Schnee"-Pixeln
 *     (Bäume, Steine, Geschenke, Schatten …) und lenkt per simulierten
 *     Pfeiltasten in die freieste Spalte. Die Kamera folgt dem Schlitten, also
 *     ist der Schlitten immer in der Bildmitte.
 *
 * Noch einmal antippen = Panel ein-/ausblenden.
 */
(function () {
  'use strict';

  /* ---------- Spiel finden ---------- */
  function findCanvas(doc) {
    var best = null, bestArea = 0;
    var list = doc.querySelectorAll('canvas');
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.id === 'srb-overlay') continue;
      var a = c.clientWidth * c.clientHeight;
      if (a > bestArea) { bestArea = a; best = c; }
    }
    return best;
  }

  function locate(win, depth) {
    var doc;
    try { doc = win.document; doc.body; } catch (e) { return null; }
    var c = findCanvas(doc);
    if (c && c.clientWidth > 150) return { win: win, doc: doc, canvas: c };
    if (depth > 3) return null;
    var frames = doc.querySelectorAll('iframe');
    for (var i = 0; i < frames.length; i++) {
      var r = null;
      try { r = locate(frames[i].contentWindow, depth + 1); } catch (e) {}
      if (r) return r;
    }
    return null;
  }

  var found = locate(window, 0);

  if (!found) {
    var frames = document.querySelectorAll('iframe'), big = null, area = 0;
    for (var i = 0; i < frames.length; i++) {
      var f = frames[i], a = f.clientWidth * f.clientHeight;
      if (f.src && a > area) { area = a; big = f; }
    }
    if (big) {
      if (confirm('Snow Rider Autopilot:\n\nDas Spiel läuft in einem fremden Rahmen, auf den ein Lesezeichen nicht zugreifen darf.\n\nSoll die Spielseite direkt geöffnet werden? Danach das Lesezeichen dort noch einmal antippen.')) {
        location.href = big.src;
      }
    } else {
      alert('Snow Rider Autopilot: Kein Spiel gefunden. Starte das Spiel zuerst (auf Play tippen) und tippe dann noch einmal auf das Lesezeichen.');
    }
    return;
  }

  var W = found.win, D = found.doc, canvas = found.canvas;

  /* Bereits aktiv? -> Panel ein-/ausblenden */
  if (W.__srb) { W.__srb.togglePanel(); return; }

  /* ---------- Einstellungen ---------- */
  var S = {
    on: true,
    top: 0.50,      // obere Kante des Suchbereichs (Anteil der Höhe)
    bottom: 0.90,   // untere Kante des Suchbereichs
    rows: 8,        // ausgewertete Pixelzeilen
    cols: 31,       // Spalten
    width: 5,       // Breite des Schlittens in Spalten (Glättung)
    dark: 120,      // dunkler als das = Hindernis
    sat: 0.30,      // farbiger als das = Hindernis
    center: 0.6,    // wie stark die Mitte bevorzugt wird
    dead: 1,        // Totzone in Spalten
    keys: 'arrows', // 'arrows' oder 'ad'
    debug: true
  };
  try { var saved = JSON.parse(W.localStorage.getItem('srb-settings') || 'null'); if (saved) for (var k in saved) if (k in S) S[k] = saved[k]; } catch (e) {}
  function save() { try { W.localStorage.setItem('srb-settings', JSON.stringify(S)); } catch (e) {} }

  /* ---------- Tasten simulieren ---------- */
  var KEYS = {
    arrows: { L: ['ArrowLeft', 'ArrowLeft', 37], R: ['ArrowRight', 'ArrowRight', 39] },
    ad: { L: ['a', 'KeyA', 65], R: ['d', 'KeyD', 68] }
  };
  var held = { L: false, R: false };

  function fire(type, def) {
    var ev;
    try {
      ev = new W.KeyboardEvent(type, { key: def[0], code: def[1], keyCode: def[2], which: def[2], bubbles: true, cancelable: true });
    } catch (e) { ev = D.createEvent('Event'); ev.initEvent(type, true, true); ev.key = def[0]; ev.code = def[1]; }
    try { Object.defineProperty(ev, 'keyCode', { get: function () { return def[2]; } }); } catch (e) {}
    try { Object.defineProperty(ev, 'which', { get: function () { return def[2]; } }); } catch (e) {}
    try { Object.defineProperty(ev, 'charCode', { get: function () { return 0; } }); } catch (e) {}
    canvas.dispatchEvent(ev); // blubbert zu document und window hoch
  }
  function setKey(side, down) {
    if (held[side] === down) return;
    held[side] = down;
    fire(down ? 'keydown' : 'keyup', KEYS[S.keys][side]);
  }
  function release() { setKey('L', false); setKey('R', false); }

  /* ---------- Pixel lesen ---------- */
  var gl = null;
  function getGL() {
    if (gl) return gl;
    try { gl = canvas.getContext('webgl2'); } catch (e) {}
    if (!gl) try { gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl'); } catch (e) {}
    return gl;
  }
  var tmp2d = null;

  // liefert Array von Zeilen (jede Uint8Array RGBA, Breite w) – Zeile 0 = oben
  function readRows(w, h, ys) {
    var g = getGL(), out = [];
    if (g && g.readPixels) {
      var is2 = typeof W.WebGL2RenderingContext !== 'undefined' && g instanceof W.WebGL2RenderingContext;
      var fbT = is2 ? g.READ_FRAMEBUFFER : g.FRAMEBUFFER;
      var prevFb = g.getParameter(is2 ? g.READ_FRAMEBUFFER_BINDING : g.FRAMEBUFFER_BINDING);
      var prevPack = is2 ? g.getParameter(g.PIXEL_PACK_BUFFER_BINDING) : null;
      var prevAlign = g.getParameter(g.PACK_ALIGNMENT);
      if (prevFb) g.bindFramebuffer(fbT, null);
      if (prevPack) g.bindBuffer(g.PIXEL_PACK_BUFFER, null);
      g.pixelStorei(g.PACK_ALIGNMENT, 4);
      for (var i = 0; i < ys.length; i++) {
        var row = new Uint8Array(w * 4);
        g.readPixels(0, h - 1 - ys[i], w, 1, g.RGBA, g.UNSIGNED_BYTE, row);
        out.push(row);
      }
      g.pixelStorei(g.PACK_ALIGNMENT, prevAlign);
      if (prevPack) g.bindBuffer(g.PIXEL_PACK_BUFFER, prevPack);
      if (prevFb) g.bindFramebuffer(fbT, prevFb);
      return out;
    }
    // 2D-Canvas oder Fallback
    if (!tmp2d) tmp2d = D.createElement('canvas').getContext('2d');
    tmp2d.canvas.width = w; tmp2d.canvas.height = 1;
    for (var j = 0; j < ys.length; j++) {
      tmp2d.drawImage(canvas, 0, ys[j], w, 1, 0, 0, w, 1);
      out.push(tmp2d.getImageData(0, 0, w, 1).data);
    }
    return out;
  }

  function isObstacle(r, g, b) {
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    var sat = mx === 0 ? 0 : (mx - mn) / mx;
    return mx < S.dark || sat > S.sat;
  }

  /* ---------- Entscheidung ---------- */
  var last = { scores: [], target: 0, center: 0, blank: false, dir: 0 };
  var blankFrames = 0;

  function think() {
    var w = canvas.width, h = canvas.height;
    if (!w || !h) return;
    var n = Math.max(5, S.cols | 0), rows = Math.max(1, S.rows | 0);
    var y0 = Math.floor(h * S.top), y1 = Math.floor(h * S.bottom);
    var ys = [];
    for (var i = 0; i < rows; i++) ys.push(Math.min(h - 1, Math.floor(y0 + (y1 - y0) * (rows === 1 ? 0.5 : i / (rows - 1)))));

    var data;
    try { data = readRows(w, h, ys); } catch (e) { last.blank = true; return; }

    var score = new Array(n), sum = 0;
    for (var c = 0; c < n; c++) score[c] = 0;
    for (var ri = 0; ri < data.length; ri++) {
      var row = data[ri];
      var weight = 0.5 + ri / data.length; // nähere Zeilen (unten) zählen mehr
      for (var x = 0; x < w; x += 2) {
        var p = x * 4;
        sum += row[p] + row[p + 1] + row[p + 2];
        if (isObstacle(row[p], row[p + 1], row[p + 2])) score[Math.min(n - 1, Math.floor(x / w * n))] += weight;
      }
    }
    // komplett schwarz = Pixel nicht lesbar
    if (sum === 0) { blankFrames++; last.blank = blankFrames > 30; return; }
    blankFrames = 0; last.blank = false;

    var perCol = (w / n / 2) * data.length;
    for (c = 0; c < n; c++) score[c] /= perCol; // 0..~1.5

    // auf Schlittenbreite glätten
    var half = Math.max(0, (S.width | 0) >> 1), sm = new Array(n);
    for (c = 0; c < n; c++) {
      var m = 0;
      for (var d = -half; d <= half; d++) { var cc = Math.min(n - 1, Math.max(0, c + d)); m = Math.max(m, score[cc]); }
      sm[c] = m;
    }

    var mid = (n - 1) / 2, best = Math.round(mid), bestV = Infinity;
    for (c = 0; c < n; c++) {
      var v = sm[c] + S.center * Math.abs(c - mid) / n;
      // Hysterese: Richtungswechsel nur, wenn deutlich besser (verhindert Zappeln)
      if (last.dir && (c - mid) * last.dir < -S.dead) v += 0.08;
      if (v < bestV) { bestV = v; best = c; }
    }

    var off = best - mid, dir = 0;
    if (Math.abs(off) > S.dead) dir = off < 0 ? -1 : 1;
    // Mitte frei? Dann geradeaus fahren
    if (sm[Math.round(mid)] < 0.04) dir = 0;

    last.scores = sm; last.target = best; last.center = mid; last.dir = dir;
    last.y0 = y0; last.y1 = y1;

    if (!S.on) { release(); return; }
    setKey('L', dir < 0);
    setKey('R', dir > 0);
  }

  /* ---------- Debug-Overlay ---------- */
  var ov = D.createElement('canvas');
  ov.id = 'srb-overlay';
  ov.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483646;';
  D.body.appendChild(ov);
  var octx = ov.getContext('2d');

  function draw() {
    var r = canvas.getBoundingClientRect();
    ov.style.left = r.left + 'px'; ov.style.top = r.top + 'px';
    ov.style.width = r.width + 'px'; ov.style.height = r.height + 'px';
    if (ov.width !== Math.round(r.width) || ov.height !== Math.round(r.height)) { ov.width = Math.round(r.width); ov.height = Math.round(r.height); }
    octx.clearRect(0, 0, ov.width, ov.height);
    if (!S.debug) return;
    var Wd = ov.width, Hd = ov.height, n = last.scores.length;
    var a = Hd * S.top, b = Hd * S.bottom;
    octx.strokeStyle = 'rgba(0,160,255,.9)'; octx.lineWidth = 2;
    octx.strokeRect(1, a, Wd - 2, b - a);
    if (last.blank) {
      octx.fillStyle = 'rgba(200,0,0,.8)'; octx.fillRect(0, a, Wd, 24);
      octx.fillStyle = '#fff'; octx.font = '14px sans-serif';
      octx.fillText('Bild nicht lesbar – Spiel neu laden und Lesezeichen sofort antippen', 8, a + 17);
      return;
    }
    for (var c = 0; c < n; c++) {
      var v = Math.min(1, last.scores[c]);
      octx.fillStyle = 'rgba(' + Math.round(255 * v) + ',' + Math.round(255 * (1 - v)) + ',0,.55)';
      octx.fillRect(c * Wd / n, b, Wd / n - 1, -Math.max(3, v * (b - a)));
    }
    var tx = (last.target + 0.5) * Wd / n;
    octx.fillStyle = '#00e0ff';
    octx.beginPath(); octx.moveTo(tx, b + 4); octx.lineTo(tx - 9, b + 20); octx.lineTo(tx + 9, b + 20); octx.fill();
    octx.fillStyle = '#fff'; octx.font = 'bold 22px sans-serif'; octx.textAlign = 'center';
    octx.fillText(last.dir < 0 ? '◀' : last.dir > 0 ? '▶' : '▲', Wd / 2, a - 8);
    octx.textAlign = 'left';
  }

  /* ---------- In die Render-Schleife einhängen ---------- */
  var origRAF = W.requestAnimationFrame;
  var lastFrameT = -1, frames = 0, gotHook = false;
  function afterFrame(t) {
    if (t === lastFrameT) return; // mehrere Callbacks pro Bild -> nur einmal
    lastFrameT = t; gotHook = true;
    // Auswertung muss im selben Task laufen, solange der Bildpuffer noch gültig ist
    try { think(); } catch (e) {}
    if ((frames++ & 1) === 0) try { draw(); } catch (e) {}
  }
  W.requestAnimationFrame = function (cb) {
    return origRAF.call(W, function (t) {
      try { cb(t); } finally { if (running) afterFrame(t); }
    });
  };
  var running = true;

  // Fallback, falls das Spiel nie requestAnimationFrame aufruft
  var fallbackTimer = W.setInterval(function () {
    if (!gotHook) { try { think(); draw(); } catch (e) {} }
  }, 50);

  /* ---------- Panel ---------- */
  var panel = D.createElement('div');
  panel.id = 'srb-panel';
  panel.style.cssText = 'position:fixed;top:10px;right:10px;z-index:2147483647;background:rgba(15,20,30,.92);color:#fff;font:13px/1.35 -apple-system,system-ui,sans-serif;padding:10px 12px;border-radius:12px;width:230px;box-shadow:0 4px 18px rgba(0,0,0,.4);-webkit-user-select:none;user-select:none;';
  function slider(key, label, min, max, step) {
    return '<label style="display:block;margin:6px 0 0">' + label + ': <b data-v="' + key + '">' + S[key] + '</b>' +
      '<input data-k="' + key + '" type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + S[key] + '" style="width:100%"></label>';
  }
  panel.innerHTML =
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
    '<b style="flex:1">🏂 Autopilot</b>' +
    '<button data-a="min" style="background:#334;color:#fff;border:0;border-radius:6px;padding:4px 8px">–</button>' +
    '<button data-a="quit" style="background:#633;color:#fff;border:0;border-radius:6px;padding:4px 8px">✕</button></div>' +
    '<div data-body>' +
    '<button data-a="toggle" style="width:100%;border:0;border-radius:8px;padding:9px;font-weight:bold;font-size:15px"></button>' +
    slider('top', 'Suchbereich oben', 0.2, 0.9, 0.01) +
    slider('bottom', 'Suchbereich unten', 0.3, 1, 0.01) +
    slider('dark', 'Dunkel-Schwelle', 40, 230, 5) +
    slider('sat', 'Farb-Schwelle', 0.05, 0.8, 0.01) +
    slider('width', 'Schlittenbreite', 1, 9, 2) +
    slider('center', 'Mitte bevorzugen', 0, 3, 0.1) +
    '<label style="display:block;margin-top:8px"><input data-c="debug" type="checkbox"' + (S.debug ? ' checked' : '') + '> Debug-Anzeige</label>' +
    '<label style="display:block;margin-top:4px">Tasten: <select data-s="keys"><option value="arrows">Pfeiltasten</option><option value="ad">A / D</option></select></label>' +
    '<div style="margin-top:6px;opacity:.7;font-size:11px">Rote Balken = Hindernis. Blaues Dreieck = Ziel.</div>' +
    '</div>';
  D.body.appendChild(panel);

  var body = panel.querySelector('[data-body]');
  var tbtn = panel.querySelector('[data-a=toggle]');
  function paintToggle() {
    tbtn.textContent = S.on ? 'AN – fährt selbst' : 'AUS';
    tbtn.style.background = S.on ? '#2a8' : '#666';
    tbtn.style.color = '#fff';
  }
  paintToggle();
  panel.querySelector('[data-s=keys]').value = S.keys;

  panel.addEventListener('input', function (e) {
    var t = e.target, k = t.getAttribute('data-k');
    if (k) { S[k] = parseFloat(t.value); panel.querySelector('[data-v=' + k + ']').textContent = S[k]; save(); }
  });
  panel.addEventListener('change', function (e) {
    var t = e.target;
    if (t.getAttribute('data-c')) { S[t.getAttribute('data-c')] = t.checked; save(); }
    if (t.getAttribute('data-s')) { release(); S[t.getAttribute('data-s')] = t.value; save(); }
  });
  panel.addEventListener('click', function (e) {
    var a = e.target.getAttribute && e.target.getAttribute('data-a');
    if (a === 'toggle') { S.on = !S.on; if (!S.on) release(); paintToggle(); save(); }
    if (a === 'min') body.style.display = body.style.display === 'none' ? '' : 'none';
    if (a === 'quit') quit();
    // Fokus zurück aufs Spiel, damit die Tasten ankommen
    try { canvas.focus(); } catch (er) {}
  });
  // Klicks im Panel nicht an das Spiel weitergeben
  ['mousedown', 'touchstart', 'pointerdown', 'keydown'].forEach(function (ev) {
    panel.addEventListener(ev, function (e) { e.stopPropagation(); }, false);
  });

  // Taste P schaltet Autopilot an/aus
  function onKey(e) {
    if (e.isTrusted && (e.key === 'p' || e.key === 'P')) { S.on = !S.on; if (!S.on) release(); paintToggle(); save(); }
  }
  W.addEventListener('keydown', onKey, true);

  function quit() {
    running = false; release();
    W.requestAnimationFrame = origRAF;
    W.clearInterval(fallbackTimer);
    W.removeEventListener('keydown', onKey, true);
    panel.remove(); ov.remove();
    delete W.__srb;
  }

  W.__srb = {
    togglePanel: function () { panel.style.display = panel.style.display === 'none' ? '' : 'none'; },
    quit: quit,
    settings: S
  };

  try { canvas.setAttribute('tabindex', canvas.getAttribute('tabindex') || '0'); canvas.focus(); } catch (e) {}
})();
