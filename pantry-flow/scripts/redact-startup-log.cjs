const fs = require('node:fs');
const path = require('node:path');

// Redaction runs in linear time (KAN-27): labels and URL userinfo are found by
// scanning instead of one large backtracking regex.
// A label's words may be joined by one ' ', '_' or '-', or by nothing.
const SECRET_LABELS = [['anon', 'key'], ['service', 'role'], ['service', 'role', 'key'], ['publishable'],
  ['publishable', 'key'], ['secret'], ['secret', 'key'], ['api', 'key'], ['authorization'], ['password'],
  ['access', 'token'], ['refresh', 'token']];
const SEPARATORS = ':=|';
const JOINS = ' _-';
const LINE_END = new RegExp('[' + String.fromCharCode(13, 0x2028, 0x2029) + ']');
const isSpace = ch => /\s/.test(ch);
const isLetter = ch => /[a-z]/i.test(ch);
const isSchemeChar = ch => /[a-z0-9+.-]/i.test(ch);
const isUserinfoEnd = ch => /[\s/@]/.test(ch);

// True when words[0..last] (ASCII, case-insensitive) end exactly at index end.
function wordsEndAt(text, words, last, end) {
  const word = words[last];
  const start = end - word.length;
  if (start < 0) return false;
  for (let i = 0; i < word.length; i++) {
    const ch = text[start + i];
    if (ch !== word[i] && ch !== word[i].toUpperCase()) return false;
  }
  if (last === 0) return true;
  if (start > 0 && JOINS.includes(text[start - 1]) && wordsEndAt(text, words, last - 1, start - 1)) return true;
  return wordsEndAt(text, words, last - 1, start);
}
const labelEndsAt = (text, end) => SECRET_LABELS.some(words => wordsEndAt(text, words, words.length - 1, end));

// "<label> : value" keeps the label and separator and redacts the rest of the line.
function redactLabels(line) {
  for (let sep = 0; sep < line.length; sep++) {
    if (!SEPARATORS.includes(line[sep])) continue;
    let end = sep;
    while (end > 0 && isSpace(line[end - 1])) end--;
    if (!labelEndsAt(line, end)) continue;
    let value = sep + 1;
    while (value < line.length && isSpace(line[value])) value++;
    const rest = line.slice(value);
    const stop = rest.search(LINE_END);
    const kept = line.slice(0, value) + '[value redacted]';
    return stop < 0 ? kept : kept + redactLabels(rest.slice(stop));
  }
  return line;
}

// scheme://userinfo@ keeps the scheme and replaces the userinfo.
function redactUserinfo(line) {
  let out = '';
  let from = 0;
  for (let at = line.indexOf('://'); at >= 0; at = line.indexOf('://', at + 1)) {
    let start = at;
    while (start > from && isSchemeChar(line[start - 1])) start--;
    while (start < at && !isLetter(line[start])) start++;
    let end = at + 3;
    while (end < line.length && !isUserinfoEnd(line[end])) end++;
    if (start < at && end > at + 3 && line[end] === '@') {
      out += line.slice(from, at + 3) + '[credentials redacted]@';
      from = end + 1;
      at = end;
    }
  }
  return out + line.slice(from);
}

function redactStartupLog(text) {
  return text.replace(/\x1b\[[0-9;]*m/g, '').split(/\r?\n/).map(line => redactLabels(redactUserinfo(line))
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[JWT redacted]')
    .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, '[key redacted]')).join('\n');
}

module.exports = { redactStartupLog };
if (require.main === module) {
  const file = path.resolve(__dirname, '..', 'db-start.log');
  const output = path.resolve(__dirname, '..', 'db-start.sanitized.log');
  if (fs.existsSync(file)) fs.writeFileSync(output, redactStartupLog(fs.readFileSync(file, 'utf8')));
}
