// Erzeugt bookmarklet.txt (die Zeile, die als Lesezeichen-URL eingefügt wird).
// Aufruf: node build.js   (benötigt terser: npm i terser)
const fs = require('fs'), path = require('path');
const { minify } = require(process.env.TERSER_PATH || 'terser');
(async () => {
  const src = fs.readFileSync(path.join(__dirname, 'autopilot.js'), 'utf8');
  const out = await minify(src, { compress: { passes: 2 }, mangle: true, format: { comments: false } });
  const url = 'javascript:' + encodeURIComponent(out.code).replace(/%20/g, ' ')
    .replace(/%2C/g, ',').replace(/%3B/g, ';').replace(/%3D/g, '=').replace(/%3A/g, ':')
    .replace(/%2F/g, '/').replace(/%3F/g, '?').replace(/%2B/g, '+').replace(/%26/g, '&')
    .replace(/%40/g, '@').replace(/%24/g, '$');
  fs.writeFileSync(path.join(__dirname, 'bookmarklet.txt'), url + '\n');
  console.log('bookmarklet.txt:', url.length, 'Zeichen');
})();
