const assert = require('assert');
const D = require('../detector.js');

const android = `20.11.26, 18:45 - Anna: Ich wünsche mir so sehr eine neue Kaffeemühle!
20.11.26, 18:46 - Ich: Notiert 😄
20.11.26, 18:47 - Ben: Hab heute nichts vor
20.11.26, 18:48 - Ben: Den Rucksack will ich unbedingt haben https://www.amazon.de/dp/B0TEST
weiter in neuer Zeile
21.11.26, 09:00 - Anna: Ich wünsche dir einen schönen Tag
21.11.26, 09:01 - Anna: <Medien ausgeschlossen>
21.11.26, 09:02 - Carla: Mein Fahrradschloss ist schon wieder kaputt
21.11.26, 09:03 - Carla: Ich wünsch mir nichts dieses Jahr`;
const msgs = D.parseChat(android);
assert.strictEqual(msgs.length, 7, 'android count ' + msgs.length);
assert.ok(msgs[3].text.includes('weiter in neuer Zeile'));
const w = D.findWishes(msgs, ['Ich']);
console.log(w.map(x => `${x.sender}: ${x.item} (${x.score})`));
assert.strictEqual(w.length, 3);
assert.ok(w.some(x => x.sender === 'Anna' && /Kaffeemühle/.test(x.item)));
assert.ok(w.some(x => x.sender === 'Ben' && x.link && x.item === 'Rucksack'));
assert.ok(w.some(x => x.sender === 'Carla' && /Fahrradschloss/.test(x.item)));

const ios = `[20.11.26, 18:45:12] Anna: Hätte so gerne mal ein Wochenende in Wien
‎[20.11.26, 18:46:00] Ben: ‎Bild weggelassen
[20.11.26, 18:47:00] Ben: Ich träume schon lange von einem Kajak.`;
const m2 = D.parseChat(ios);
assert.strictEqual(m2.length, 2);
const w2 = D.findWishes(m2, []);
console.log(w2.map(x => `${x.sender}: ${x.item}`));
assert.strictEqual(w2.length, 2);
assert.strictEqual(w2.find(x => x.sender === 'Ben').item, 'Kajak');

const tg = JSON.stringify({ messages: [{ type: 'message', from: 'Dora', date: '2026-11-01T10:00:00', text: ['Das wäre so toll: ', { type: 'bold', text: 'Lego Botanik' }] }] });
const w3 = D.findWishes(D.parseChat(tg), []);
assert.strictEqual(w3.length, 1); assert.strictEqual(w3[0].sender, 'Dora');

const plain = D.parseChat('Mama meinte: ich bräuchte mal dringend neue Hausschuhe\nheute Regen');
assert.strictEqual(D.findWishes(plain, []).length, 1);
console.log('Alle Tests bestanden ✓');
