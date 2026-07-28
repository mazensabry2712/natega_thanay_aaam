// RESULTS_RAW (loaded from data.js) is a big tab/newline delimited string:
// seat \t name \t total_degree \t status_code
// STATUS_CODES maps status_code -> status text

const input = document.getElementById('searchInput');
const resultsEl = document.getElementById('results');
const countEl = document.getElementById('countText');

const MAX_DISPLAY = 30;
const SCAN_CAP = 500; // stop scanning once we have this many matches, for performance

// ----- Normalization: makes the filter tolerant of Arabic diacritics,
// letter variants (أ/إ/آ/ا, ة/ه, ى/ي...), Arabic-Indic/Persian digits,
// accented Latin characters (é, ñ, ü...), and case — so search stays
// accurate no matter how the user types or which language/script they use. -----
function normalize(str){
  if (!str) return '';
  let s = String(str);

  // Arabic-Indic (٠-٩) and Persian (۰-۹) digits -> Western digits
  s = s.replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
       .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0));

  // Strip Arabic diacritics (tashkeel) and tatweel (kashida)
  s = s.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '');

  // Normalize common Arabic letter variants so spelling differences don't matter
  s = s
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي');

  // Decompose accented Latin/other characters and drop the accent marks
  // (covers French, Spanish, German, etc.)
  s = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

  // Case-insensitive for any script that has case, collapse extra whitespace
  s = s.toLowerCase().replace(/\s+/g, ' ').trim();

  return s;
}

// ----- Parse the raw data once at startup -----
let RESULTS_DATA = [];
(function parseData(){
  const lines = RESULTS_RAW.split('\n');
  const data = new Array(lines.length);
  let n = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const tab1 = line.indexOf('\t');
    const tab2 = line.indexOf('\t', tab1 + 1);
    const tab3 = line.indexOf('\t', tab2 + 1);
    if (tab1 === -1 || tab2 === -1 || tab3 === -1) continue;
    const seat = line.slice(0, tab1);
    const name = line.slice(tab1 + 1, tab2);
    const degree = line.slice(tab2 + 1, tab3);
    const statusCode = line.charCodeAt(tab3 + 1) - 48; // single digit code
    // pre-normalize seat & name once at load time so per-keystroke search stays fast
    data[n++] = [seat, name, degree, statusCode, normalize(seat), normalize(name)];
  }
  data.length = n;
  RESULTS_DATA = data;
})();

const PASS_STATUS = 'ناجح دور أول';
const SECOND_ROUND_STATUS = 'دور ثان';

function badgeInfoFor(statusCode){
  const text = STATUS_CODES[statusCode] || '';
  if (text === PASS_STATUS) return { cls: 'badge-pass', text };
  if (text === SECOND_ROUND_STATUS) return { cls: 'badge-warn', text };
  return { cls: 'badge-fail', text };
}

function renderEmptyState(){
  resultsEl.innerHTML = `
    <div class="empty-state">
      اكتب رقم الجلوس أو اسم الطالب فوق (كامل أو جزء منه) وهيظهرلك المجموع والنتيجة أول ما تبدأ تكتب.
    </div>`;
  countEl.textContent = '';
}

function renderNoMatch(query){
  resultsEl.innerHTML = `<div class="no-match">مفيش نتيجة مطابقة لـ "${escapeHtml(query)}"</div>`;
  countEl.textContent = '';
}

function escapeHtml(str){
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const TOTAL_DEGREE = 320;

function percentageFor(degree){
  const num = parseFloat(degree);
  if (isNaN(num)) return '-';
  const pct = (num / TOTAL_DEGREE) * 100;
  // Trim trailing .0 but keep one decimal when needed (e.g. 90.6%)
  const rounded = Math.round(pct * 10) / 10;
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

function rowToTr(row){
  const [seat, name, degree, statusCode] = row;
  const { cls, text } = badgeInfoFor(statusCode);
  const longTextClass = text.length > 8 ? ' long-text' : '';
  const degreeText = degree === '' ? '-' : degree;
  const percentageText = degree === '' ? '-' : percentageFor(degree);

  return `
    <tr>
      <td class="seat-cell" data-label="رقم الجلوس">${escapeHtml(seat)}</td>
      <td class="school-cell" data-label="الاسم">${escapeHtml(name)}</td>
      <td class="dir-cell" data-label="المجموع">${escapeHtml(degreeText)}</td>
      <td class="pct-cell" data-label="النسبة">${escapeHtml(percentageText)}</td>
      <td class="result-cell" data-label="النتيجة"><span class="result-badge ${cls}${longTextClass}">${escapeHtml(text)}</span></td>
    </tr>`;
}

function renderTable(matches, query){
  countEl.textContent = `تم العثور على ${matches.length} نتيجة` +
    (matches.length > MAX_DISPLAY ? ` — بيتم عرض أول ${MAX_DISPLAY}` : '');

  const rows = matches.slice(0, MAX_DISPLAY).map(rowToTr).join('');

  resultsEl.innerHTML = `
    <table class="results-table">
      <colgroup>
        <col class="col-seat">
        <col class="col-school">
        <col class="col-dir">
        <col class="col-pct">
        <col class="col-result">
      </colgroup>
      <thead>
        <tr>
          <th>رقم الجلوس</th>
          <th>الاسم</th>
          <th>المجموع</th>
          <th>النسبة</th>
          <th class="center">النتيجة</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function findMatches(query){
  const matches = [];

  for (let i = 0; i < RESULTS_DATA.length; i++) {
    const row = RESULTS_DATA[i];
    // check both seat (normalized) and name (normalized) — whichever matches
    if (row[4].indexOf(query) !== -1 || row[5].indexOf(query) !== -1) {
      matches.push(row);
      if (matches.length >= SCAN_CAP) break;
    }
  }

  return matches;
}

function handleSearch(){
  const rawQuery = input.value.trim();
  const query = normalize(rawQuery);

  if (!query) {
    renderEmptyState();
    return;
  }

  const matches = findMatches(query);

  if (matches.length === 0) {
    renderNoMatch(rawQuery);
    return;
  }

  renderTable(matches, rawQuery);
}

input.addEventListener('input', handleSearch);
renderEmptyState();
