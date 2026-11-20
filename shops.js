/*
 * Geschenke-Gedächtnis – passende Shops/Websites zu einer Idee vorschlagen.
 * Es werden nur Such-Links gebaut; nichts wird automatisch abgerufen.
 */
(function (root) {
  'use strict';

  const q = s => encodeURIComponent(s);
  const google = (query, site) => `https://www.google.com/search?q=${q(query + (site ? ' site:' + site : ''))}`;

  // [Name, Kategorie-Regex, URL-Bauer]
  const CATEGORY_SHOPS = [
    ['Thalia', /\b(buch|bücher|roman|krimi|thriller|comic|manga|hörbuch|kochbuch|bildband|kalender)\b/i, s => `https://www.thalia.de/suche?sq=${q(s)}`],
    ['Booking.com', /\b(wochenende|reise|urlaub|trip|städtereise|hotel|kurztrip|übernachtung|städtetrip)\b/i, (s, ctx) => `https://www.booking.com/searchresults.de.html?ss=${q(ctx.city || s)}`, true],
    ['Eventim', /\b(konzert|ticket|tickets|musical|festival|theater|show|tour|comedy)\b/i, s => `https://www.eventim.de/search/?searchterm=${q(s.replace(/\b(tickets?|karten?|konzert)\b/gi, '').trim() || s)}`, true],
    ['mydays', /\b(erlebnis|wellness|spa|massage|kurs|workshop|fallschirm|ballon|dinner|fahrt|tauchen|klettern|escape)\b/i, s => google(s, 'mydays.de'), true],
    ['Zalando', /\b(pullover|pulli|hoodie|jacke|mantel|schuhe?|sneaker|stiefel|kleid|hose|jeans|shirt|bluse|mütze|schal|handschuhe|tasche|rucksack|gürtel|socken)\b/i, s => `https://www.zalando.de/katalog/?q=${q(s)}`],
    ['Etsy', /\b(personalisiert|handgemacht|selbstgemacht|gravur|schmuck|kette|armband|ohrringe?|ring|foto|poster|tasse|unikat)\b/i, s => `https://www.etsy.com/de/search?q=${q(s)}`],
    ['MediaMarkt', /\b(kopfhörer|handy|smartphone|lautsprecher|box|kamera|konsole|ps5|playstation|xbox|switch|tablet|ipad|laptop|smartwatch|fernseher|tv|controller|airpods|e-reader|kindle)\b/i, s => `https://www.mediamarkt.de/de/search.html?query=${q(s)}`],
    ['myToys', /\b(lego|playmobil|spielzeug|puppe|kuscheltier|plüsch|puzzle|brettspiel|spiel)\b/i, s => google(s, 'mytoys.de')],
    ['Fleurop', /\b(blumen|strauß|rosen|pflanze|orchidee)\b/i, s => `https://www.fleurop.de/`],
  ];

  const ALWAYS = [
    ['Amazon', s => `https://www.amazon.de/s?k=${q(s)}`],
    ['idealo', s => `https://www.idealo.de/preisvergleich/MainSearchProductCategory.html?q=${q(s)}`],
    ['eBay', s => `https://www.ebay.de/sch/i.html?_nkw=${q(s)}`],
    ['Google Shopping', s => `https://www.google.com/search?tbm=shop&q=${q(s)}`],
  ];

  const COLORS = /\b(rot|rote|blau|blaue|grün|grüne|schwarz|schwarze|weiß|weiße|rosa|pink|gelb|gelbe|lila|grau|graue|beige|braun|braune|gold|silber|türkis|orange|bunt)\b/i;
  const SIZE = /\b(?:größe|gr\.)\s*([0-9]{2,3}|xxs|xs|s|m|l|xl|xxl)\b/i;
  const FILLER = /\b(neue[nrs]?|neu|so|mal|endlich|richtig|schöne[nrs]?|tolle[nrs]?|coole[nrs]?|eine?[nmrs]?|der|die|das|den|dem)\b/gi;

  /** Suchbegriff aus Titel (+ Farbe/Größe aus der Notiz) */
  function buildQuery(idea) {
    if (idea.search && idea.search.trim()) return idea.search.trim();
    let s = String(idea.title || '').replace(/https?:\/\/\S+/g, '').replace(FILLER, ' ').replace(/\s+/g, ' ').trim();
    const note = String(idea.note || '');
    const color = note.match(COLORS);
    if (color && !new RegExp('\\b' + color[1] + '\\b', 'i').test(s)) s += ' ' + color[1].toLowerCase().replace(/e$/, '');
    const size = note.match(SIZE);
    if (size) s += ' ' + size[1].toUpperCase();
    return s || String(idea.title || '').trim();
  }

  function savedLinks(idea) {
    const urls = String(idea.note || '').match(/https?:\/\/[^\s<>"')]+/g) || [];
    return [...new Set(urls)].slice(0, 2).map(url => {
      let host = url; try { host = new URL(url).hostname.replace(/^www\./, ''); } catch (e) { /* ungültig */ }
      return { name: `★ ${host}`, url, saved: true };
    });
  }

  /** Liefert [{name, url, saved?}] – höchstens 6 Einträge */
  function suggestShops(idea) {
    const query = buildQuery(idea);
    if (!query) return [];
    const text = `${idea.title || ''} ${idea.note || ''} ${idea.search || ''}`;
    const city = (text.match(/\bin\s+([A-ZÄÖÜ][\wäöüß-]{2,})/) || [])[1];
    const ctx = { city };

    const out = savedLinks(idea);
    let experience = false;
    for (const [name, re, build, isExperience] of CATEGORY_SHOPS) {
      if (re.test(text)) { out.push({ name, url: build(query, ctx) }); experience = experience || !!isExperience; }
    }
    const rest = experience ? [['Google', s => google(s)]] : ALWAYS;
    for (const [name, build] of rest) {
      if (out.length >= 6) break;
      out.push({ name, url: build(query, ctx) });
    }
    return out.slice(0, 6);
  }

  const api = { suggestShops, buildQuery };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GiftShops = api;
})(typeof self !== 'undefined' ? self : this);
