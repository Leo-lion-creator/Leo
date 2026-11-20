/*
 * Geschenke-Gedächtnis – Chat-Parser und Wunsch-Erkennung.
 * Läuft komplett lokal im Browser (und in Node für Tests).
 */
(function (root) {
  'use strict';

  const INVISIBLE = /[‎‏‪-‮﻿]/g;

  // WhatsApp Android:  20.11.26, 18:45 - Anna: Text
  const RE_ANDROID = /^(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}),?\s+(\d{1,2}:\d{2})(?::\d{2})?(?:\s?[AaPp]\.?[Mm]\.?)?\s+[-–]\s+([^:]{1,60}?):\s([\s\S]*)$/;
  // WhatsApp iOS:      [20.11.26, 18:45:12] Anna: Text
  const RE_IOS = /^\[(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}),?\s+(\d{1,2}:\d{2})(?::\d{2})?(?:\s?[AaPp]\.?[Mm]\.?)?\]\s+([^:]{1,60}?):\s([\s\S]*)$/;

  const SKIP_MESSAGES = [
    /medien ausgeschlossen/i, /media omitted/i, /nachricht wurde gelöscht/i,
    /message was deleted/i, /ende-zu-ende-verschlüsselt/i, /end-to-end encrypted/i,
    /^<anhang:/i, /^‎?(bild|video|audio|sticker|gif) weggelassen/i, /omitted$/i,
  ];

  function parseDate(str) {
    if (!str) return null;
    const m = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
    if (!m) return null;
    let [, d, mo, y] = m;
    y = y.length === 2 ? 2000 + Number(y) : Number(y);
    const date = new Date(y, Number(mo) - 1, Number(d));
    return isNaN(date) ? null : date.toISOString().slice(0, 10);
  }

  /** Erkennt das Format und liefert [{sender, date, text}] */
  function parseChat(raw, fileName) {
    raw = String(raw || '');
    const trimmed = raw.trim();

    // Telegram JSON-Export
    if (trimmed.startsWith('{') && /"messages"\s*:/.test(trimmed)) {
      try { return parseTelegram(JSON.parse(trimmed)); } catch (e) { /* weiter als Text */ }
    }

    const lines = raw.replace(/\r\n?/g, '\n').split('\n');
    const messages = [];
    let current = null;
    let matched = 0;

    for (let line of lines) {
      line = line.replace(INVISIBLE, '');
      const m = line.match(RE_IOS) || line.match(RE_ANDROID);
      if (m) {
        matched++;
        current = { date: parseDate(m[1]), sender: m[3].trim(), text: m[4] };
        messages.push(current);
      } else if (current && line.trim()) {
        current.text += '\n' + line;
      }
    }

    // Kein bekanntes Format → jede Zeile / jeder Absatz eine Nachricht, Absender unbekannt
    if (matched === 0) {
      return trimmed.split(/\n+/).map(t => t.trim()).filter(Boolean)
        .map(text => ({ sender: '', date: null, text }));
    }

    return messages.filter(msg => !SKIP_MESSAGES.some(re => re.test(msg.text.trim())));
  }

  function parseTelegram(data) {
    const list = Array.isArray(data.messages) ? data.messages : [];
    return list.filter(m => m.type === 'message').map(m => {
      const text = Array.isArray(m.text)
        ? m.text.map(p => (typeof p === 'string' ? p : p.text || '')).join('')
        : String(m.text || '');
      return { sender: m.from || '', date: (m.date || '').slice(0, 10) || null, text };
    }).filter(m => m.text.trim());
  }

  // ---------- Wunsch-Erkennung ----------

  // [Regex, Punkte]. Gruppe 1 (falls vorhanden) = das gewünschte Ding.
  const PATTERNS = [
    [/\bich\s+wünsch(?:e)?\s+mir\s+(?:so\s+sehr\s+|schon\s+lange\s+|zum\s+\w+\s+)?(.+)/i, 5],
    [/\bwünsch(?:e)?\s+(?:ich\s+)?mir\s+(?:so\s+sehr\s+|schon\s+lange\s+)?(.+)/i, 4],
    [/\bauf\s+meine(?:r|n)?\s+wunschliste\b(.*)/i, 5],
    [/\bhätte?\s+(?:ich\s+)?(?:so\s+|total\s+|voll\s+|echt\s+)?gern(?:e)?\s+(.+)/i, 4],
    [/\b(?:das|den|die|diese[nrs]?)\s+([\wäöüß-]{3,30}(?:\s+[\wäöüß-]{3,30})?)\s+(?:will|möchte|brauche?)\s+ich\s+(?:auch\s+)?(?:unbedingt|so\s+gerne?|haben)/i, 5],
    [/\b(?:das|den|die|so\s+(?:ein|eine|einen))\s+(?:will|möchte)\s+ich\s+(?:auch\s+)?(?:haben|unbedingt)?(.*)/i, 4],
    [/\bich\s+(?:will|möchte)\s+(?:so\s+gerne?|unbedingt|endlich|schon\s+lange)\s+(.+)/i, 4],
    [/\bich\s+(?:bräuchte|brauche)\s+(?:mal\s+|dringend\s+|unbedingt\s+|echt\s+|endlich\s+)+(.+)/i, 3],
    [/\bich\s+bräuchte\s+(.+)/i, 2],
    [/\b(?:das|der|die|so\s+(?:ein|eine|einen)\s+\w+)\s+wäre\s+(?:so\s+|echt\s+|mega\s+|voll\s+)?(?:toll|cool|schön|ein\s+traum|genial|perfekt)(.*)/i, 3],
    [/\bich\s+träume?\s+(?:schon\s+lange\s+)?(?:von|davon)\s+(.+)/i, 4],
    [/\bverliebt\s+in\s+(?:diese[nmrs]?|das|den|die)\s+(.+)/i, 3],
    [/\b(?:mein|meine)\s+(.{2,40}?)\s+(?:ist|sind)\s+(?:total\s+|komplett\s+|schon\s+wieder\s+)?(?:kaputt|hinüber|durch|im\s+eimer)/i, 2],
    // Englisch
    [/\bi\s+(?:really\s+)?(?:want|wish\s+i\s+had|would\s+love|'d\s+love)\s+(?:a\s+|an\s+|some\s+|to\s+have\s+)?(.+)/i, 3],
    [/\bon\s+my\s+wish\s*list\b(.*)/i, 5],
  ];

  const NEGATIONS = [
    /\b(?:wünsch(?:e)?\s+mir\s+nichts|brauche?\s+nichts|will\s+nichts|möchte\s+nichts|nicht\s+(?:so\s+)?gern|keine?n?\s+lust)\b/i,
    /\bwünsch(?:e)?\s+(?:dir|euch|ihnen|allen)\b/i,
    /\b(?:i\s+don't\s+want|i\s+do\s+not\s+want)\b/i,
  ];

  const SHOP_LINK = /https?:\/\/(?:www\.)?(?:amazon\.|amzn\.|etsy\.com|ebay\.|zalando\.|otto\.de|ikea\.|thalia\.de|galaxus\.|mediamarkt\.|saturn\.|idealo\.|tchibo\.|douglas\.)\S*/i;

  function cleanItem(s) {
    if (!s) return '';
    s = s.replace(/https?:\/\/\S+/g, '').split(/[.!?\n]|\s(?:aber|weil|denn|oder so)\s/i)[0];
    s = s.replace(/^\s*(?:,|:|-)\s*/, '').replace(/^(?:(?:mal|auch|so|ein|eine|einen|einem|einer|eines)\s+)+/i, '').replace(/\s+(?:haben|kaufen|holen|bekommen)\s*$/i, '');
    s = s.replace(/[😀-🙏🌀-🗿🚀-🛿🤀-🧿❤️✨]+/gu, '').trim();
    s = s.charAt(0).toUpperCase() + s.slice(1);
    if (s.length > 70) s = s.slice(0, 67).replace(/\s+\S*$/, '') + '…';
    return s;
  }

  /** Liefert null oder {score, item} für eine Nachricht */
  function detectWish(text) {
    if (!text) return null;
    const t = text.replace(INVISIBLE, '');
    if (NEGATIONS.some(re => re.test(t))) return null;

    let best = null;
    for (const [re, points] of PATTERNS) {
      const m = t.match(re);
      if (m && (!best || points > best.score)) {
        best = { score: points, item: cleanItem(m[1] || '') };
      }
    }
    const link = t.match(SHOP_LINK);
    if (link) {
      if (best) best.score += 2;
      else best = { score: 2, item: '' };
      best.link = link[0];
    }
    if (!best || best.score < 2) return null;
    if (!best.item) best.item = cleanItem(t) || 'Geschenkidee';
    return best;
  }

  /** Durchsucht Nachrichten, überspringt eigene Namen */
  function findWishes(messages, myNames) {
    const mine = (myNames || []).map(n => n.trim().toLowerCase()).filter(Boolean);
    const out = [];
    for (const msg of messages) {
      if (msg.sender && mine.includes(msg.sender.trim().toLowerCase())) continue;
      const hit = detectWish(msg.text);
      if (hit) out.push({ ...hit, sender: msg.sender, date: msg.date, text: msg.text.trim() });
    }
    return out.sort((a, b) => b.score - a.score);
  }

  // ---------- ZIP (WhatsApp-Export auf dem iPhone) ----------
  async function readZipText(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    const view = new DataView(arrayBuffer);
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
      if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('Keine gültige ZIP-Datei');
    const count = view.getUint16(eocd + 10, true);
    let p = view.getUint32(eocd + 16, true);
    const entries = [];
    const dec = new TextDecoder();
    for (let i = 0; i < count; i++) {
      if (view.getUint32(p, true) !== 0x02014b50) break;
      const method = view.getUint16(p + 10, true);
      const compSize = view.getUint32(p + 20, true);
      const nameLen = view.getUint16(p + 28, true);
      const extraLen = view.getUint16(p + 30, true);
      const commentLen = view.getUint16(p + 32, true);
      const localOff = view.getUint32(p + 42, true);
      const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
      entries.push({ name, method, compSize, localOff });
      p += 46 + nameLen + extraLen + commentLen;
    }
    const txt = entries.filter(e => /\.(txt|json)$/i.test(e.name) && !e.name.startsWith('__MACOSX'));
    const entry = txt.find(e => /_chat\.txt$/i.test(e.name)) || txt[0];
    if (!entry) throw new Error('Keine Chat-Textdatei im ZIP gefunden');
    const lo = entry.localOff;
    const start = lo + 30 + view.getUint16(lo + 26, true) + view.getUint16(lo + 28, true);
    const data = bytes.subarray(start, start + entry.compSize);
    if (entry.method === 0) return dec.decode(data);
    if (entry.method !== 8) throw new Error('Unbekannte ZIP-Kompression');
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return await new Response(stream).text();
  }

  const api = { parseChat, detectWish, findWishes, readZipText, cleanItem };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GiftDetector = api;
})(typeof self !== 'undefined' ? self : this);
