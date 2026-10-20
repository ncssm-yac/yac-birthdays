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
// opener, one bullet per person, a closing line. Goofy, but light on emojis
// (at most one per line). Each section has [one person, several people].
const VARIANTS = [
  { open: '\u{1F9AC}', today: ['Stop the herd, it\'s a birthday today! \u{1F382}', 'Stop the herd, we have birthdays today! \u{1F382}'],
    week: ['A birthday is galloping our way in one week! \u{1F43E}', 'Birthdays are galloping our way in one week! \u{1F43E}'],
    closeToday: 'A quick cheer would be yak-tastic!', closeWeek: 'Time to start planning some yak-tastic wishes!' },
  { open: 'Hold onto your horns!', today: ['Someone in the herd is a year shaggier today \u{1F389}', 'Some of the herd are a year shaggier today \u{1F389}'],
    week: ['Next week, one of us gets even more fabulous.', 'Next week, a few of us get even more fabulous.'],
    closeToday: 'Go say happy birthday!', closeWeek: 'Mark your calendars, herd.' },
  { open: 'Moo-ving news (okay, yak-ing news)!', today: ['It\'s a birthday today! \u{1F973}', 'It\'s a double (or more) birthday day! \u{1F973}'],
    week: ['One week until the party starts:', 'One week until the parties start:'],
    closeToday: 'Please shower them with good wishes.', closeWeek: 'Start warming up those good wishes.' },
  { open: 'Birthday radar is beeping! \u{1F4E1}', today: ['Direct hit, it\'s today:', 'Direct hits, they\'re all today:'],
    week: ['Incoming in 7 days:', 'Incoming in 7 days:'],
    closeToday: 'A cheer or a card would land perfectly.', closeWeek: 'Plenty of time to plan something sweet.' },
  { open: 'The yak report is in!', today: ['Today we celebrate \u{1F382}', 'Today we celebrate \u{1F382}'],
    week: ['Coming up next week:', 'Coming up next week:'],
    closeToday: 'Spread the yak love!', closeWeek: 'Spread the yak love early!' },
  { open: '\u{1F389} Grab your party hooves!', today: ['It\'s birthday time, right now, today:', 'It\'s birthday time, right now, today:'],
    week: ['The party calendar says one week out:', 'The party calendar says one week out:'],
    closeToday: 'Cake wishes are accepted in Chat.', closeWeek: 'Start thinking about cake wishes.' },
  { open: 'Fresh from the pasture:', today: ['A birthday has arrived! \u{1F381}', 'Birthdays have arrived! \u{1F381}'],
    week: ['A birthday is grazing closer, one week to go:', 'Birthdays are grazing closer, one week to go:'],
    closeToday: 'Be the first to say happy birthday!', closeWeek: 'You have a whole week to get the wishes ready.' },
  { open: 'Ding dong, the yak is here!', today: ['The birthday bell rings today \u{1F514}', 'The birthday bells ring today \u{1F514}'],
    week: ['The bell will ring in a week for:', 'The bells will ring in a week for:'],
    closeToday: 'Give them a big herd hello.', closeWeek: 'Get your cheers ready, herd.' },
  { open: 'Yak attack of good news! \u{1F4E3}', today: ['Today is their big day:', 'Today is their big day:'],
    week: ['Their big day is one week away:', 'Their big days are one week away:'],
    closeToday: 'Send some birthday magic their way.', closeWeek: 'Time to gather the birthday magic.' },
  { open: 'Roll out the hay bales! \u{1F973}', today: ['Birthday alert, it\'s today:', 'Birthday alerts, they\'re today:'],
    week: ['Birthday alert for next week:', 'Birthday alerts for next week:'],
    closeToday: 'A happy birthday goes a long way.', closeWeek: 'A little planning goes a long way.' }
];

// `pick` returns a number in [0, 1); pass a stub in tests. Returns null when
// there is nothing to say.
function buildMessage(due, today, { test = false, pick = Math.random } = {}) {
  if (!due.week.length && !due.today.length) return null;
  const v = VARIANTS[Math.min(VARIANTS.length - 1, Math.floor(pick() * VARIANTS.length))];
  const plural = (names) => (names.length === 1 ? 0 : 1);
  const lines = ['*Yakkety here!* ' + v.open + (test ? ' _(TEST)_' : '')];
  if (due.today.length) {
    lines.push(v.today[plural(due.today)]);
    due.today.forEach((n) => lines.push('\u2022 ' + n));
  }
  if (due.week.length) {
    lines.push(v.week[plural(due.week)]);
    due.week.forEach((n) => lines.push('\u2022 ' + n + ' (' + label(today, 7) + ')'));
  }
  lines.push(due.today.length ? v.closeToday : v.closeWeek);
  return lines.join('\n');
}

module.exports = { VARIANTS, parseBirthday, daysUntil, todayInNewYork, findDue, buildMessage };
