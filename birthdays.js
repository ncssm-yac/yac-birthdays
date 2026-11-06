'use strict';
// Pure date logic and message text. No network, no secrets.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "12/16" or "12/16/1999" -> { month: 12, day: 16 }; anything else -> null.
// The year, if present, is ignored.
function parseBirthday(raw) {
  const m = /^\s*(\d{1,2})\s*[/-]\s*(\d{1,2})(?:\s*[/-]\s*\d{2,4})?\s*$/.exec(String(raw || ''));
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (month < 1 || month > 12 || day < 1) return null;
  const longest = new Date(Date.UTC(2024, month, 0)).getUTCDate(); // 2024 is a leap year
  return day > longest ? null : { month, day };
}

const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

// Where a birthday falls in a given year. Feb 29 is kept on Feb 28 in non-leap years.
function onYear(b, year) {
  const day = b.month === 2 && b.day === 29 && !isLeap(year) ? 28 : b.day;
  return Date.UTC(year, b.month - 1, day);
}

// Whole days from `today` ({year, month, day}) to the next occurrence of b (0 = today).
function daysUntil(today, b) {
  const t = Date.UTC(today.year, today.month - 1, today.day);
  let next = onYear(b, today.year);
  if (next < t) next = onYear(b, today.year + 1);
  return Math.round((next - t) / 86400000);
}

// Today's date in New York as {year, month, day}.
function todayInNewYork(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: 'numeric', day: 'numeric' })
    .formatToParts(now);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

// Rows are arrays; the first row is the header. Columns are found by name, so
// reordering the Sheet doesn't break the run. Only Active members with a
// readable birthday count.
function findDue(rows, today) {
  const header = (rows[0] || []).map((h) => String(h || '').trim().toLowerCase());
  const col = (name) => header.indexOf(name);
  const iFirst = col('first name');
  const iLast = col('last name');
  const iBirthday = col('birthday');
  const iStatus = col('status');
  if (iFirst < 0 || iBirthday < 0 || iStatus < 0) {
    throw new Error('The Sheet needs First Name, Birthday and Status columns.');
  }
  const out = { week: [], today: [], skipped: 0, considered: 0 };
  rows.slice(1).forEach((r) => {
    if (String(r[iStatus] || '').trim().toLowerCase() !== 'active') return;
    const first = String(r[iFirst] || '').trim();
    if (!first) return;
    out.considered += 1;
    const b = parseBirthday(r[iBirthday]);
    if (!b) { out.skipped += 1; return; }
    const name = iLast >= 0 && String(r[iLast] || '').trim() ? first + ' ' + String(r[iLast]).trim() : first;
    const d = daysUntil(today, b);
    if (d === 0) out.today.push(name);
    else if (d === 7) out.week.push(name);
  });
  out.week.sort();
  out.today.sort();
  return out;
}

const label = (today, plusDays) => {
  const t = new Date(Date.UTC(today.year, today.month - 1, today.day + plusDays));
  return MONTHS[t.getUTCMonth()] + ' ' + t.getUTCDate();
};

// Ten wordings, one picked at random per post so the messages don't all read
// the same. Same shape as Yakkety's meeting-minutes posts: "*Yakkety here!*"
// opener and first section line, one bullet per person, a blank line, then a closing line. Goofy, with two emojis per
// post: one ending the opener, one ending the closer. Section lines end in a
// colon and lead straight into the bullets. Each section has
// [one person, several people]; closers say "them", which fits either.
const VARIANTS = [
  { open: 'Stop the herd! 🦬',
    today: ['There\'s a birthday today:', 'There are birthdays today:'],
    week: ['Galloping in one week from now:', 'Galloping in one week from now:'],
    closeToday: 'A quick "happy birthday" would be yak-tastic! 🎂', closeWeek: 'Plenty of time to plan something yak-tastic! 🎈' },
  { open: 'Hold onto your horns! 🐂',
    today: ['One of the herd is officially a year shaggier today:', 'Some of the herd are officially a year shaggier today:'],
    week: ['A year shaggier in one week:', 'A year shaggier in one week:'],
    closeToday: 'Go wish them a happy birthday! 🎉', closeWeek: 'Pop it on your calendar! 🗓️' },
  { open: 'Yak-breaking news! 📣',
    today: ['Celebrating today:', 'Celebrating today:'],
    week: ['Celebrating one week from today:', 'Celebrating one week from today:'],
    closeToday: 'Send some birthday love their way! 💌', closeWeek: 'Start warming up those birthday wishes! 💌' },
  { open: 'Birthday radar is beeping! 📡',
    today: ['Direct hit, it\'s today:', 'Direct hits, they\'re today:'],
    week: ['Incoming in 7 days:', 'Incoming in 7 days:'],
    closeToday: 'A cheer or a card would land perfectly. 🎯', closeWeek: 'Plenty of time to plan a perfect landing. 🎯' },
  { open: 'The yak report is in! 🌟',
    today: ['Today\'s birthday star:', 'Today\'s birthday stars:'],
    week: ['Next week\'s birthday star:', 'Next week\'s birthday stars:'],
    closeToday: 'Spread the yak love! 💛', closeWeek: 'Spread the yak love early! 💛' },
  { open: 'Grab your party hooves! 🎉',
    today: ['It\'s birthday time for:', 'It\'s birthday time for:'],
    week: ['Party countdown (one week to go):', 'Party countdown (one week to go):'],
    closeToday: 'Drop them a happy birthday! 🥳', closeWeek: 'Start practicing your party moves! 🕺' },
  { open: 'Fresh from the pasture! 🌾',
    today: ['A birthday has arrived:', 'Birthdays have arrived:'],
    week: ['A birthday is grazing closer, one week to go:', 'Birthdays are grazing closer, one week to go:'],
    closeToday: 'Be the first to say happy birthday! 🎁', closeWeek: 'A whole week to get the wishes ready! 🎁' },
  { open: 'Ring the cowbell! 🔔',
    today: ['The birthday bell rings today for:', 'The birthday bells ring today for:'],
    week: ['The birthday bell rings in one week for:', 'The birthday bells ring in one week for:'],
    closeToday: 'Give them a big herd hello! 👋', closeWeek: 'Get your cheers warmed up, herd! 📣' },
  { open: 'Shaggy greetings, herd! 👋',
    today: ['Today is the big day for:', 'Today is the big day for:'],
    week: ['The big day is one week away for:', 'The big day is one week away for:'],
    closeToday: 'Send some birthday magic their way! ✨', closeWeek: 'Time to gather the birthday magic! ✨' },
  { open: 'Roll out the hay bales! 🥳',
    today: ['Birthday alert for today:', 'Birthday alerts for today:'],
    week: ['Birthday alert for next week:', 'Birthday alerts for next week:'],
    closeToday: 'A happy birthday goes a long way! 🎂', closeWeek: 'A little planning goes a long way! 🗓️' }
];

// `pick` returns a number in [0, 1); pass a stub in tests. Returns null when
// there is nothing to say.
function buildMessage(due, today, { test = false, pick = Math.random } = {}) {
  if (!due.week.length && !due.today.length) return null;
  const v = VARIANTS[Math.min(VARIANTS.length - 1, Math.floor(pick() * VARIANTS.length))];
  const plural = (names) => (names.length === 1 ? 0 : 1);
  // The first section line shares the opener's line; a second section and the
  // closer each get a blank line before them (owner's preference, Nov 6, 2026).
  const sections = [];
  if (due.today.length) sections.push([v.today[plural(due.today)], ...due.today.map((n) => '\u2022 ' + n)]);
  if (due.week.length) sections.push([v.week[plural(due.week)], ...due.week.map((n) => '\u2022 ' + n + ' (' + label(today, 7) + ')')]);
  const opener = '*Yakkety here!* ' + v.open + (test ? ' _(TEST)_' : '');
  const lines = [];
  sections.forEach(([head, ...bullets], i) => {
    if (i === 0) lines.push(opener + ' ' + head);
    else lines.push('', head);
    lines.push(...bullets);
  });
  lines.push('', due.today.length ? v.closeToday : v.closeWeek);
  return lines.join('\n');
}

module.exports = { VARIANTS, parseBirthday, daysUntil, todayInNewYork, findDue, buildMessage };
