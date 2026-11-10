'use strict';
const assert = require('assert');
const { main } = require('./run');
const { VARIANTS, parseBirthday, daysUntil, findDue, buildMessage } = require('./birthdays');

let failed = 0;
const queue = [];
const test = (name, fn) => queue.push({ name, fn });
const d = (year, month, day) => ({ year, month, day });
const HEADER = ['', 'First Name', 'Last Name', 'Role', 'Birthday', 'Status'];
const row = (first, last, bday, status = 'Active') => ['', first, last, 'Member', bday, status];

test('parses month/day, with or without a year', () => {
  assert.deepStrictEqual(parseBirthday('12/16'), { month: 12, day: 16 });
  assert.deepStrictEqual(parseBirthday(' 3/7/1999 '), { month: 3, day: 7 });
  assert.deepStrictEqual(parseBirthday('2/29'), { month: 2, day: 29 });
});

test('rejects blanks, words and impossible dates', () => {
  ['', null, undefined, 'March 3', '13/1', '0/5', '4/31', '2/30', '6/0'].forEach((v) => assert.strictEqual(parseBirthday(v), null, String(v)));
});

test('counts days, including across the new year', () => {
  assert.strictEqual(daysUntil(d(2026, 10, 20), { month: 10, day: 20 }), 0);
  assert.strictEqual(daysUntil(d(2026, 10, 20), { month: 10, day: 27 }), 7);
  assert.strictEqual(daysUntil(d(2026, 12, 28), { month: 1, day: 4 }), 7);
  assert.strictEqual(daysUntil(d(2026, 10, 20), { month: 10, day: 19 }), 364);
});

test('a Feb 29 birthday is celebrated on Feb 28 in a non-leap year, Feb 29 in a leap year', () => {
  assert.strictEqual(daysUntil(d(2027, 2, 28), { month: 2, day: 29 }), 0);
  assert.strictEqual(daysUntil(d(2027, 2, 21), { month: 2, day: 29 }), 7);
  assert.strictEqual(daysUntil(d(2028, 2, 29), { month: 2, day: 29 }), 0);
  assert.strictEqual(daysUntil(d(2028, 2, 28), { month: 2, day: 29 }), 1);
});

test('finds today, three-day and one-week birthdays among Active members only', () => {
  const rows = [HEADER, row('Ada', 'Test', '10/20'), row('Ben', 'Sample', '10/27'), row('Cy', 'Demo', '10/21'),
    row('Gil', 'Soon', '10/23'), row('Hap', 'Five', '10/25'),
    row('Dee', 'Gone', '10/20', 'Inactive'), row('Eli', 'Blank', ''), row('Fay', 'Typo', 'soon')];
  const due = findDue(rows, d(2026, 10, 20));
  assert.deepStrictEqual(due.today, ['Ada Test']);
  assert.deepStrictEqual(due.soon, ['Gil Soon']);
  assert.deepStrictEqual(due.week, ['Ben Sample']);
  assert.strictEqual(due.skipped, 2);
});

test('finds columns by header name, in any order', () => {
  const rows = [['Status', 'Birthday', 'First Name'], ['Active', '1/4', 'Gus']];
  assert.deepStrictEqual(findDue(rows, d(2026, 12, 28)).week, ['Gus']);
});

test('a Sheet without the needed columns fails loudly', () => {
  assert.throws(() => findDue([['First Name', 'Status'], ['Hal', 'Active']], d(2026, 1, 1)), /Birthday/);
});

test('says nothing on a quiet day', () => {
  assert.strictEqual(buildMessage({ week: [], today: [] }, d(2026, 10, 20)), null);
});

const at = (i) => () => (i + 0.5) / VARIANTS.length; // picks variant i
const EMOJI = /\p{Extended_Pictographic}/gu;
const MIXED = { week: ['Ben Sample', 'Cy Demo'], soon: ['Gil Soon'], today: ['Ada Test'] };

test('there are ten variants', () => {
  assert.strictEqual(VARIANTS.length, 10);
});

test('every variant follows the minutes-post shape, with two emojis', () => {
  VARIANTS.forEach((_, i) => {
    const msg = buildMessage(MIXED, d(2026, 10, 20), { test: true, pick: at(i) });
    const lines = msg.split('\n');
    assert.ok(lines[0].startsWith('*Yakkety here!*'), i + ' opener');
    assert.ok(lines[0].includes('(TEST)'), i + ' test tag');
    assert.ok(msg.includes('\u2022 Ada Test'), i + ' today bullet');
    assert.ok(msg.includes('\u2022 Ben Sample (Oct 27)') && msg.includes('\u2022 Cy Demo (Oct 27)'), i + ' week bullets');
    assert.ok(msg.includes('\u2022 Gil Soon (Oct 23)'), i + ' three-day bullet');
    assert.ok(msg.indexOf('Ada Test') < msg.indexOf('Gil Soon') && msg.indexOf('Gil Soon') < msg.indexOf('Ben Sample'), i + ' today, then three days, then a week');
    assert.strictEqual((msg.match(EMOJI) || []).length, 2, i + ' two emojis');
    assert.strictEqual((lines[0].match(EMOJI) || []).length, 1, i + ' one in the opener');
    assert.strictEqual((lines[lines.length - 1].match(EMOJI) || []).length, 1, i + ' one in the closer');
    assert.ok(lines[0].endsWith(':'), i + ' first section line shares the opener line');
    assert.strictEqual(lines[lines.length - 2], '', i + ' blank line before the closer');
    lines.filter((l) => l && !l.startsWith('\u2022') && l !== lines[0] && l !== lines[lines.length - 1])
      .forEach((l) => assert.ok(l.endsWith(':'), i + ' section line leads into bullets: ' + l));
  });
});

test('one week-out birthday reads as three short lines plus the closer', () => {
  const v = VARIANTS[8];
  assert.strictEqual(buildMessage({ week: ['Ben Sample'], today: [] }, d(2026, 11, 5), { pick: at(8) }),
    '*Yakkety here!* ' + v.open + ' ' + v.week[0] + '\n\u2022 Ben Sample (Nov 12)\n\n' + v.closeWeek);
});

test('every variant reads right for one person and for several, today and next week', () => {
  VARIANTS.forEach((_, i) => {
    [{ week: [], today: ['A One'] }, { week: [], today: ['A One', 'B Two'] }, { week: ['A One'], today: [] }, { week: ['A One', 'B Two'], today: [] },
      { week: [], soon: ['A One'], today: [] }, { week: [], soon: ['A One', 'B Two'], today: [] }]
      .forEach((due) => {
        const msg = buildMessage(due, d(2026, 10, 20), { pick: at(i) });
        assert.ok(msg.includes('\u2022 A One'), i);
        assert.ok(!msg.includes('TEST'), i);
        assert.ok(!msg.includes('undefined'), i);
      });
  });
});

test('different picks give different messages, and the pick is random by default', () => {
  const texts = new Set(VARIANTS.map((_, i) => buildMessage(MIXED, d(2026, 10, 20), { pick: at(i) })));
  assert.strictEqual(texts.size, 10);
  const seen = new Set();
  for (let n = 0; n < 200; n += 1) seen.add(buildMessage(MIXED, d(2026, 10, 20)));
  assert.ok(seen.size > 5);
  assert.ok(buildMessage(MIXED, d(2026, 10, 20), { pick: () => 0.9999999 }));
});

test('only week-ahead people get the closing line for next week, not today', () => {
  VARIANTS.forEach((v, i) => {
    assert.ok(buildMessage({ week: ['A One'], today: [] }, d(2026, 10, 20), { pick: at(i) }).endsWith(v.closeWeek));
    assert.ok(buildMessage({ week: [], today: ['A One'] }, d(2026, 10, 20), { pick: at(i) }).endsWith(v.closeToday));
    assert.ok(buildMessage({ week: ['B Two'], soon: ['A One'], today: [] }, d(2026, 10, 20), { pick: at(i) }).endsWith(v.closeSoon));
    assert.ok(!/week/i.test(v.soon.join(' ') + v.closeSoon), i + ' three-day lines never say week');
  });
});

test('a sample dry run touches no Sheet, key or network', async () => {
  const realFetch = global.fetch;
  global.fetch = () => { throw new Error('network used'); };
  try {
    assert.strictEqual(await main({ SAMPLE: 'true', DRY_RUN: 'true' }), 'dry');
  } finally { global.fetch = realFetch; }
});

test('a real sample needs a token and never counts as a real post', async () => {
  await assert.rejects(() => main({ SAMPLE: 'true', DRY_RUN: 'false' }), /GH_TOKEN/);
  const calls = [];
  const realFetch = global.fetch;
  global.fetch = async (url, opts) => { calls.push({ url, body: JSON.parse(opts.body) }); return { status: 204 }; };
  try {
    assert.strictEqual(await main({ SAMPLE: 'true', DRY_RUN: 'false', GH_TOKEN: 'x', SPACE: 'it' }), 'sample');
  } finally { global.fetch = realFetch; }
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].body.inputs.source, 'yac-birthdays');
  assert.strictEqual(calls[0].body.inputs.space, 'it');
  assert.ok(calls[0].body.inputs.text.includes('(TEST)') && calls[0].body.inputs.text.includes('Ada Test'));
});

(async () => {
  for (const { name, fn } of queue) {
    try { await fn(); console.log('PASS ' + name); } catch (e) { failed += 1; console.log('FAIL ' + name + '\n  ' + e.message); }
  }
  console.log('\n' + (queue.length - failed) + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
