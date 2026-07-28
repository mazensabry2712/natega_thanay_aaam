// RESULTS_RAW (loaded from data.js) is a big tab/newline delimited string:
// seat \t name \t total_degree \t status_code
// STATUS_CODES maps status_code -> status text

const input = document.getElementById('searchInput');
const resultsEl = document.getElementById('results');
const countEl = document.getElementById('countText');

const MAX_DISPLAY = 30;
const SCAN_CAP = 500; // stop scanning once we have this many matches, for performance

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
    data[n++] = [seat, name, degree, statusCode];
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

function rowToTr(row){
  const [seat, name, degree, statusCode] = row;
  const { cls, text } = badgeInfoFor(statusCode);
  const longTextClass = text.length > 8 ? ' long-text' : '';
  const degreeText = degree === '' ? '-' : degree;

  return `
    <tr>
      <td class="seat-cell" data-label="رقم الجلوس">${escapeHtml(seat)}</td>
      <td class="school-cell" data-label="الاسم">${escapeHtml(name)}</td>
      <td class="dir-cell" data-label="المجموع">${escapeHtml(degreeText)}</td>
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
        <col class="col-result">
      </colgroup>
      <thead>
        <tr>
          <th>رقم الجلوس</th>
          <th>الاسم</th>
          <th>المجموع</th>
          <th class="center">النتيجة</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function findMatches(query){
  const isNumericQuery = /^\d+$/.test(query);
  const matches = [];

  for (let i = 0; i < RESULTS_DATA.length; i++) {
    const row = RESULTS_DATA[i];
    const haystack = isNumericQuery ? row[0] : row[1]; // seat or name
    if (haystack.indexOf(query) !== -1) {
      matches.push(row);
      if (matches.length >= SCAN_CAP) break;
    }
  }

  return matches;
}

function handleSearch(){
  const query = input.value.trim();

  if (!query) {
    renderEmptyState();
    return;
  }

  const matches = findMatches(query);

  if (matches.length === 0) {
    renderNoMatch(query);
    return;
  }

  renderTable(matches, query);
}

input.addEventListener('input', handleSearch);
renderEmptyState();
