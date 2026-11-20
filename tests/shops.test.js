const assert = require('assert');
const { suggestShops, buildQuery } = require('../shops.js');
const show = i => console.log(buildQuery(i).padEnd(28), '→', suggestShops(i).map(s => s.name).join(', '));

show({ title: 'Neue Kaffeemühle', note: 'Ich wünsche mir so sehr eine neue Kaffeemühle' });
show({ title: 'Wochenende in Wien', note: '' });
show({ title: 'Rucksack', note: 'Den Rucksack will ich https://www.amazon.de/dp/B0TEST in grün' });
show({ title: 'Pullover', note: 'am liebsten blau, Größe M' });
show({ title: 'Kopfhörer', note: '' });
show({ title: 'Neues Buch von Sebastian Fitzek', note: '' });
show({ title: 'Taylor Swift Konzert Tickets', note: '' });

assert.strictEqual(buildQuery({ title: 'Neue Kaffeemühle' }), 'Kaffeemühle');
assert.strictEqual(buildQuery({ title: 'Pullover', note: 'am liebsten blau, Größe M' }), 'Pullover blau M');
assert.strictEqual(buildQuery({ title: 'X', search: 'eigener Begriff' }), 'eigener Begriff');
const wien = suggestShops({ title: 'Wochenende in Wien' });
assert.ok(wien[0].name === 'Booking.com' && wien[0].url.includes('ss=Wien'));
const ruck = suggestShops({ title: 'Rucksack', note: 'https://www.amazon.de/dp/B0TEST' });
assert.ok(ruck[0].saved && ruck[0].url === 'https://www.amazon.de/dp/B0TEST');
assert.ok(ruck.some(s => s.name === 'Zalando'));
assert.ok(suggestShops({ title: 'Kopfhörer' }).some(s => s.name === 'MediaMarkt'));
assert.ok(suggestShops({ title: 'a' }).length <= 6);
console.log('Shop-Tests bestanden ✓');
