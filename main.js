// web/main.js
const DATA_URL = './data.json';

async function init() {
  const res = await fetch(DATA_URL);
  const data = await res.json();
  render(data.events);
}

function render(events) {
  const app = document.getElementById('app');
  if (!events.length) {
    app.innerHTML = '<p class="loading">데이터 없음</p>';
    return;
  }

  const byDate = {};
  for (const e of events) {
    const date = e.broadcast_at.slice(0, 10);
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(e);
  }

  app.innerHTML = Object.entries(byDate)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, evts]) => renderDateGroup(date, evts))
    .join('');

  document.querySelectorAll('.toggle-header').forEach(header => {
    header.addEventListener('click', () => {
      const body = header.nextElementSibling;
      const arrow = header.querySelector('.toggle-arrow');
      body.classList.toggle('open');
      arrow.classList.toggle('open');

      if (body.classList.contains('open')) {
        const eventId = header.dataset.id;
        const event = events.find(e => e.id === eventId);
        initChart(eventId, event);
      }
    });
  });
}

function renderDateGroup(date, events) {
  return `
    <div class="date-group">
      <div class="date-label">${formatDate(date)}</div>
      ${events.map(renderEvent).join('')}
    </div>`;
}

function renderEvent(event) {
  const score = event.indices?.trump_risk_score ?? 0;
  const riskClass = score >= 70 ? 'risk-high' : score >= 40 ? 'risk-mid' : 'risk-low';
  const riskLabel = score >= 70 ? 'HIGH' : score >= 40 ? 'MID' : 'LOW';

  return `
    <div class="event-toggle">
      <div class="toggle-header" data-id="${event.id}">
        <span class="toggle-arrow">▶</span>
        <span class="toggle-title">${escHtml(event.title)}</span>
        <span class="risk-badge ${riskClass}">${riskLabel} ${score}</span>
      </div>
      <div class="toggle-body">
        ${renderIndices(event.indices)}
        <div class="chart-wrap">
          <canvas id="chart-${event.id}"></canvas>
        </div>
        <ul class="volatility-list">
          ${(event.top_volatility || []).map(renderVolItem).join('')}
        </ul>
      </div>
    </div>`;
}

function renderIndices(indices) {
  if (!indices) return '';
  const items = [
    { label: '🌡️ 감정 온도', value: indices.rage ?? '-' },
    { label: '⚔️ 무역 공격성', value: indices.trade_war ?? '-' },
    { label: '🎲 혼돈 지수', value: indices.chaos ?? '-' },
    { label: '💰 시장 자랑', value: indices.market_brag ?? '-' },
    { label: '🎯 타깃', value: escHtml(indices.primary_target || 'N/A') },
    { label: '🔑 키워드', value: (indices.keywords || []).join(', ') },
  ];
  return `<div class="indices-grid">
    ${items.map(i => `
      <div class="index-card">
        <div class="index-label">${i.label}</div>
        <div class="index-value">${i.value}</div>
      </div>`).join('')}
  </div>`;
}

function renderVolItem(item) {
  const pct = item.market_moves?.[item.asset] ?? 0;
  const pctClass = pct < -0.1 ? 'vol-change-neg' : pct > 0.1 ? 'vol-change-pos' : 'vol-change-neu';
  const pctStr = pct >= 0 ? `+${pct.toFixed(2)}%` : `${pct.toFixed(2)}%`;
  const originLink = item.youtube_url
    ? `<a class="vol-source-link" href="${item.youtube_url}" target="_blank">[원문]</a>` : '';

  return `
    <li class="vol-item">
      <div class="vol-rank">#${item.rank}</div>
      <div class="vol-content">
        <div class="vol-meta">
          <span class="vol-asset">${item.asset.toUpperCase()}</span>
          <span class="${pctClass}">${pctStr}</span>
          <span style="color:#666">σ${item.volatility.toFixed(2)}%</span>
        </div>
        <div class="vol-text">
          "${escHtml(item.transcript_segment || '')}"${originLink}
        </div>
      </div>
    </li>`;
}

function initChart(eventId, event) {
  const canvas = document.getElementById(`chart-${eventId}`);
  if (!canvas || canvas._chartInit) return;
  canvas._chartInit = true;

  const candles = event.market_candles || {};
  const assets = ['nasdaq', 'btc', 'gold'];
  const colors = { nasdaq: '#4499ff', btc: '#ffaa00', gold: '#ffdd44' };

  const allTimes = [...new Set(
    assets.flatMap(a => (candles[a] || []).map(c => c.time))
  )].sort();

  if (!allTimes.length) return;

  const datasets = assets.map(asset => {
    const map = Object.fromEntries((candles[asset] || []).map(c => [c.time, c.close]));
    const first = candles[asset]?.[0]?.open || 1;
    return {
      label: asset.toUpperCase(),
      data: allTimes.map(t => map[t] ? ((map[t] - first) / first * 100) : null),
      borderColor: colors[asset],
      borderWidth: 1.5,
      pointRadius: 0,
      tension: 0.1,
      spanGaps: true,
    };
  });

  new Chart(canvas, {
    type: 'line',
    data: { labels: allTimes.map(t => t.slice(11, 16)), datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#888', font: { size: 10 } } } },
      scales: {
        x: { ticks: { color: '#555', maxTicksLimit: 8, font: { size: 9 } }, grid: { color: '#1e1e1e' } },
        y: { ticks: { color: '#555', font: { size: 9 },
                      callback: v => v.toFixed(1) + '%' }, grid: { color: '#1e1e1e' } },
      },
    },
  });
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

init().catch(e => {
  document.getElementById('app').innerHTML = `<p class="loading">오류: ${e.message}</p>`;
});
