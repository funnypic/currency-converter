const API = 'https://api.frankfurter.app';

// DOM refs
const fromCurrencyEl = document.getElementById('from-currency');
const toCurrencyEl = document.getElementById('to-currency');
const fromAmountEl = document.getElementById('from-amount');
const toAmountEl = document.getElementById('to-amount');
const swapBtn = document.getElementById('swap-btn');
const rateTextEl = document.getElementById('rate-text');
const addFavBtn = document.getElementById('add-favorite-btn');
const lastUpdatedEl = document.getElementById('last-updated');
const favoritesList = document.getElementById('favorites-list');
const chartLoading = document.getElementById('chart-loading');
const chartTitleEl = document.getElementById('chart-title');

let currentRate = null;
let rateChart = null;
let currentPeriod = 7;

// Popular currencies shown first
const POPULAR = ['USD', 'KRW', 'EUR', 'JPY', 'GBP', 'CNY', 'CAD', 'AUD', 'CHF', 'HKD'];

// ── Currencies ──────────────────────────────────────────────────────────────
async function loadCurrencies() {
  const res = await fetch(`${API}/currencies`);
  const data = await res.json();

  // Sort: popular first, then alphabetical
  const all = Object.entries(data); // [[code, name], ...]
  const popular = POPULAR.filter(c => data[c]).map(c => [c, data[c]]);
  const rest = all.filter(([c]) => !POPULAR.includes(c)).sort((a, b) => a[0].localeCompare(b[0]));
  const sorted = [...popular, ...rest];

  [fromCurrencyEl, toCurrencyEl].forEach((sel, idx) => {
    sorted.forEach(([code, name]) => {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = `${code} — ${name}`;
      sel.appendChild(opt);
    });
  });

  fromCurrencyEl.value = 'USD';
  toCurrencyEl.value = 'KRW';

  convert();
  loadChart();
}

// ── Conversion ───────────────────────────────────────────────────────────────
async function convert() {
  const from = fromCurrencyEl.value;
  const to = toCurrencyEl.value;
  const amount = parseFloat(fromAmountEl.value) || 0;

  if (from === to) {
    currentRate = 1;
    toAmountEl.textContent = amount.toLocaleString('ko-KR', { maximumFractionDigits: 4 });
    rateTextEl.textContent = `1 ${from} = 1 ${to}`;
    return;
  }

  try {
    const res = await fetch(`${API}/latest?from=${from}&to=${to}`);
    const data = await res.json();
    currentRate = data.rates[to];
    const converted = amount * currentRate;

    toAmountEl.textContent = converted.toLocaleString('ko-KR', { maximumFractionDigits: 4 });
    rateTextEl.textContent = `1 ${from} = ${currentRate.toLocaleString('ko-KR', { maximumFractionDigits: 6 })} ${to}`;
    lastUpdatedEl.textContent = `마지막 업데이트: ${data.date}`;
  } catch {
    toAmountEl.textContent = '오류';
    rateTextEl.textContent = 'API 연결 실패';
  }
}

// ── Chart ────────────────────────────────────────────────────────────────────
async function loadChart() {
  const from = fromCurrencyEl.value;
  const to = toCurrencyEl.value;

  chartLoading.classList.remove('hidden');
  chartTitleEl.textContent = `${from} → ${to} 환율 추이`;

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - currentPeriod);

  const fmt = d => d.toISOString().split('T')[0];

  try {
    const url = from === to
      ? null
      : `${API}/${fmt(startDate)}..${fmt(endDate)}?from=${from}&to=${to}`;

    if (!url) {
      chartLoading.textContent = '같은 통화는 차트를 표시할 수 없습니다.';
      return;
    }

    const res = await fetch(url);
    const data = await res.json();

    const labels = Object.keys(data.rates).sort();
    const values = labels.map(d => data.rates[d][to]);

    renderChart(labels, values, from, to);
  } catch {
    chartLoading.textContent = '차트 데이터를 불러올 수 없습니다.';
  } finally {
    chartLoading.classList.add('hidden');
  }
}

function renderChart(labels, values, from, to) {
  const ctx = document.getElementById('rate-chart').getContext('2d');

  if (rateChart) rateChart.destroy();

  rateChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: `${from}/${to}`,
        data: values,
        borderColor: '#4299e1',
        backgroundColor: 'rgba(66, 153, 225, 0.1)',
        borderWidth: 2,
        pointRadius: labels.length > 60 ? 0 : 3,
        pointHoverRadius: 5,
        fill: true,
        tension: 0.3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.parsed.y.toLocaleString('ko-KR', { maximumFractionDigits: 6 })} ${to}`,
          },
        },
      },
      scales: {
        x: {
          ticks: {
            maxTicksLimit: 8,
            font: { size: 11 },
          },
          grid: { display: false },
        },
        y: {
          ticks: {
            font: { size: 11 },
            callback: v => v.toLocaleString('ko-KR', { maximumFractionDigits: 2 }),
          },
        },
      },
    },
  });
}

// ── Favorites ────────────────────────────────────────────────────────────────
function loadFavorites() {
  return JSON.parse(localStorage.getItem('fav_pairs') || '[]');
}

function saveFavorites(favs) {
  localStorage.setItem('fav_pairs', JSON.stringify(favs));
}

function renderFavorites() {
  const favs = loadFavorites();
  favoritesList.innerHTML = '';

  if (favs.length === 0) {
    favoritesList.innerHTML = '<li class="empty-msg">즐겨찾기가 없습니다.</li>';
    return;
  }

  favs.forEach(({ from, to }) => {
    const li = document.createElement('li');
    li.className = 'fav-item';

    const label = document.createElement('span');
    label.className = 'fav-label';
    label.textContent = `${from} → ${to}`;

    const delBtn = document.createElement('button');
    delBtn.className = 'fav-delete';
    delBtn.textContent = '✕';
    delBtn.title = '삭제';

    li.appendChild(label);
    li.appendChild(delBtn);

    // Click to apply
    label.addEventListener('click', () => {
      fromCurrencyEl.value = from;
      toCurrencyEl.value = to;
      convert();
      loadChart();
    });

    // Delete
    delBtn.addEventListener('click', e => {
      e.stopPropagation();
      const updated = loadFavorites().filter(f => !(f.from === from && f.to === to));
      saveFavorites(updated);
      renderFavorites();
    });

    favoritesList.appendChild(li);
  });
}

function addFavorite() {
  const from = fromCurrencyEl.value;
  const to = toCurrencyEl.value;
  const favs = loadFavorites();

  if (favs.some(f => f.from === from && f.to === to)) {
    alert(`${from} → ${to} 는 이미 즐겨찾기에 있습니다.`);
    return;
  }

  favs.push({ from, to });
  saveFavorites(favs);
  renderFavorites();
}

// ── Event Listeners ──────────────────────────────────────────────────────────
fromCurrencyEl.addEventListener('change', () => { convert(); loadChart(); });
toCurrencyEl.addEventListener('change', () => { convert(); loadChart(); });
fromAmountEl.addEventListener('input', convert);

swapBtn.addEventListener('click', () => {
  const tmp = fromCurrencyEl.value;
  fromCurrencyEl.value = toCurrencyEl.value;
  toCurrencyEl.value = tmp;
  convert();
  loadChart();
});

addFavBtn.addEventListener('click', addFavorite);

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentPeriod = parseInt(tab.dataset.period, 10);
    loadChart();
  });
});

// ── S&P 500 ──────────────────────────────────────────────────────────────────
let snpChart = null;
let currentSnpRange = '5d';

async function loadSNP(range = currentSnpRange) {
  currentSnpRange = range;
  const loadingEl = document.getElementById('snp-loading');
  loadingEl.textContent = '불러오는 중...';
  loadingEl.classList.remove('hidden');

  const intervalMap = { '5d': '1d', '1mo': '1d', '3mo': '1wk', '1y': '1wk' };
  const interval = intervalMap[range] || '1d';
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?interval=${interval}&range=${range}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('fetch failed');
    const data = await res.json();
    const result = data.chart.result[0];
    const meta = result.meta;
    const closes = result.indicators.quote[0].close;
    const timestamps = result.timestamp;

    const labels = timestamps.map(ts => {
      const d = new Date(ts * 1000);
      return range === '1y' || range === '3mo'
        ? d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
        : d.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
    });
    const values = closes.map(v => v ? parseFloat(v.toFixed(2)) : null);

    const price = meta.regularMarketPrice;
    const prevClose = meta.previousClose || meta.chartPreviousClose;
    const change = price - prevClose;
    const changePct = (change / prevClose) * 100;
    const isUp = change >= 0;

    const priceEl = document.getElementById('snp-price');
    const changeEl = document.getElementById('snp-change');
    priceEl.textContent = price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    changeEl.textContent = `${isUp ? '+' : ''}${change.toFixed(2)} (${isUp ? '+' : ''}${changePct.toFixed(2)}%)`;
    changeEl.className = `snp-change ${isUp ? 'up' : 'down'}`;

    renderSNPChart(labels, values, isUp);
  } catch {
    loadingEl.textContent = 'S&P 500 데이터를 불러올 수 없습니다.';
    return;
  }

  loadingEl.classList.add('hidden');
}

function renderSNPChart(labels, values, isUp) {
  const ctx = document.getElementById('snp-chart').getContext('2d');
  if (snpChart) snpChart.destroy();

  const color = isUp ? '#48bb78' : '#fc8181';
  const bgColor = isUp ? 'rgba(72,187,120,0.1)' : 'rgba(252,129,129,0.1)';

  snpChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'S&P 500',
        data: values,
        borderColor: color,
        backgroundColor: bgColor,
        borderWidth: 2,
        pointRadius: labels.length > 60 ? 0 : 2,
        pointHoverRadius: 5,
        fill: true,
        tension: 0.3,
        spanGaps: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `$${ctx.parsed.y.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          },
        },
      },
      scales: {
        x: { ticks: { maxTicksLimit: 8, font: { size: 11 } }, grid: { display: false } },
        y: { ticks: { font: { size: 11 }, callback: v => `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}` } },
      },
    },
  });
}

document.querySelectorAll('.snp-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.snp-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    loadSNP(tab.dataset.range);
  });
});

// ── Init ─────────────────────────────────────────────────────────────────────
loadCurrencies();
renderFavorites();
loadSNP();
