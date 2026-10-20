'use strict';
const assert = require('assert');
const { parseBirthday, daysUntil, findDue, buildMessage } = require('./birthdays');

let failed = 0;
function test(name, fn) {
  try { fn(); console.log('PASS ' + name); } catch (e) { failed += 1; console.log('FAIL ' + name + '\n  ' + e.message); }
}
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

test('finds today and one-week birthdays among Active members only', () => {
  const rows = [HEADER, row('Ada', 'Test', '10/20'), row('Ben', 'Sample', '10/27'), row('Cy', 'Demo', '10/21'),
    row('Dee', 'Gone', '10/20', 'Inactive'), row('Eli', 'Blank', ''), row('Fay', 'Typo', 'soon')];
  const due = findDue(rows, d(2026, 10, 20));
  assert.deepStrictEqual(due.today, ['Ada Test']);
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

test('message follows the minutes-post shape: opener, one bullet per person, closer', () => {
  const msg = buildMessage({ week: ['Ben Sample', 'Cy Demo'], today: ['Ada Test'] }, d(2026, 10, 20), { test: true });
  assert.ok(msg.startsWith('*Yakkety here!*'));
  assert.ok(msg.includes('(TEST)'));
  assert.ok(msg.includes('birthday TODAY'));
  assert.ok(msg.includes('\u2022 \u{1F388} Ada Test'));
  assert.ok(msg.includes('\u2022 \u{1F389} Ben Sample (Oct 27)'));
  assert.ok(msg.includes('\u2022 \u{1F389} Cy Demo (Oct 27)'));
  assert.ok(!buildMessage({ week: ['Ben Sample'], today: [] }, d(2026, 10, 20)).includes('TEST'));
});

test('wording agrees with how many people there are', () => {
  assert.ok(buildMessage({ week: [], today: ['A One'] }, d(2026, 10, 20)).includes('a birthday TODAY'));
  assert.ok(buildMessage({ week: [], today: ['A One', 'B Two'] }, d(2026, 10, 20)).includes('birthdays TODAY'));
  assert.ok(buildMessage({ week: ['A One'], today: [] }, d(2026, 10, 20)).includes('a birthday is galloping'));
  assert.ok(buildMessage({ week: ['A One', 'B Two'], today: [] }, d(2026, 10, 20)).includes('birthdays are galloping'));
});

process.exit(failed ? 1 : 0);
