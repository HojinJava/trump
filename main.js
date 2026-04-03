// main.js — Trump Index frontend
const INDEX_URL = './index.json';

// Cache for lazily loaded event data
const eventCache = {};

async function init() {
  try {
    const index = await fetch(INDEX_URL).then(r => r.json());
    renderEventList(index.events || []);
  } catch (e) {
    document.getElementById('app').innerHTML = `<p class="loading">오류: ${e.message}</p>`;
  }
}

function renderEventList(events) {
  const app = document.getElementById('app');
  if (!events.length) {
    app.innerHTML = '<p class="loading">데이터 없음</p>';
    return;
  }

  // Group by date
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

  // Accordion toggle
  document.querySelectorAll('.toggle-header').forEach(header => {
    header.addEventListener('click', async () => {
      const body = header.nextElementSibling;
      const arrow = header.querySelector('.toggle-arrow');
      const isOpen = body.classList.contains('open');

      body.classList.toggle('open');
      arrow.classList.toggle('open');

      if (!isOpen) {
        const eventId = header.dataset.id;
        await loadEventData(eventId);
      }
    });
  });
}

async function loadEventData(id) {
  // Avoid double-loading
  if (eventCache[id]) {
    renderEventDetail(id, eventCache[id]);
    initChart(id, eventCache[id]);
    return;
  }

  const detailEl = document.getElementById(`detail-${id}`);
  if (detailEl) detailEl.innerHTML = '<p class="loading" style="padding:20px 0">로딩 중...</p>';

  try {
    const event = await fetch(`./data/${id}/event.json`).then(r => r.json());
    eventCache[id] = event;
    renderEventDetail(id, event);
    initChart(id, event);
    bindVolTabs(id, event);
  } catch (e) {
    const el = document.getElementById(`detail-${id}`);
    if (el) el.innerHTML = `<p class="loading" style="padding:20px 0">데이터 로드 실패: ${e.message}</p>`;
  }
}

function renderDateGroup(date, events) {
  return `
    <div class="date-group">
      <div class="date-label">${formatDate(date)}</div>
      ${events.map(renderEventSummary).join('')}
    </div>`;
}

// Render event row from lightweight index data
function renderEventSummary(event) {
  const score = event.trump_risk_score ?? 0;
  const riskClass = score >= 70 ? 'risk-high' : score >= 40 ? 'risk-mid' : 'risk-low';
  const riskLabel = score >= 70 ? 'HIGH' : score >= 40 ? 'MID' : 'LOW';

  return `
    <div class="event-toggle">
      <div class="toggle-header" data-id="${escHtml(event.id)}">
        <span class="toggle-arrow">▶</span>
        <span class="toggle-title">${escHtml(event.title)}</span>
        <span class="risk-badge ${riskClass}">${riskLabel} ${score}</span>
      </div>
      <div class="toggle-body">
        <div id="detail-${escHtml(event.id)}"></div>
      </div>
    </div>`;
}

// Render full event detail after lazy load
function renderEventDetail(id, event) {
  const detailEl = document.getElementById(`detail-${id}`);
  if (!detailEl) return;

  const volItems = event.top_volatility || [];
  const assets = ['전체', ...new Set(volItems.map(v => v.asset))];

  detailEl.innerHTML = `
    ${renderIndices(event.indices)}
    <div class="chart-wrap">
      <canvas id="chart-${escHtml(id)}"></canvas>
    </div>
    <div class="vol-tabs" data-event="${escHtml(id)}">
      ${assets.map((a, i) => `<button class="vol-tab${i === 0 ? ' active' : ''}" data-asset="${escHtml(a)}">${a === '전체' ? '전체' : a.toUpperCase()}</button>`).join('')}
    </div>
    <ul class="volatility-list" id="vol-list-${escHtml(id)}">
      ${renderVolItems(volItems, '전체')}
    </ul>`;
}

function bindVolTabs(id, event) {
  const tabGroup = document.querySelector(`.vol-tabs[data-event="${id}"]`);
  if (!tabGroup) return;

  tabGroup.addEventListener('click', e => {
    const btn = e.target.closest('.vol-tab');
    if (!btn) return;
    tabGroup.querySelectorAll('.vol-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const asset = btn.dataset.asset;
    const list = document.getElementById(`vol-list-${id}`);
    if (list) list.innerHTML = renderVolItems(event.top_volatility || [], asset);
  });
}

function renderIndices(indices) {
  if (!indices) return '';

  const keywords = indices.keywords || [];
  const keywordHtml = keywords.length
    ? `<div class="index-keywords">${keywords.map(k => `<span class="keyword-tag">${escHtml(k)}</span>`).join('')}</div>`
    : '<span class="index-value">-</span>';

  const items = [
    { label: '감정 온도',    value: `<span class="index-value">${indices.rage ?? '-'}</span>` },
    { label: '무역 공격성',  value: `<span class="index-value">${indices.trade_war ?? '-'}</span>` },
    { label: '혼돈 지수',   value: `<span class="index-value">${indices.chaos ?? '-'}</span>` },
    { label: '시장 자랑',   value: `<span class="index-value">${indices.market_brag ?? '-'}</span>` },
    { label: '주요 타깃',   value: `<span class="index-value" style="font-size:1rem">${escHtml(indices.primary_target || 'N/A')}</span>` },
    { label: '키워드',      value: keywordHtml },
  ];

  return `<div class="indices-grid">
    ${items.map(i => `
      <div class="index-card">
        <div class="index-label">${i.label}</div>
        ${i.value}
      </div>`).join('')}
  </div>`;
}

function renderVolItems(items, asset) {
  const filtered = asset === '전체' ? items : items.filter(v => v.asset === asset);
  const reranked = filtered.map((item, i) => ({ ...item, displayRank: i + 1 }));
  return reranked.map(renderVolItem).join('');
}

function renderVolItem(item) {
  const pct = item.market_moves?.[item.asset] ?? 0;
  const pctClass = pct < -0.1 ? 'vol-change-neg' : pct > 0.1 ? 'vol-change-pos' : 'vol-change-neu';
  const pctStr = pct >= 0 ? `+${pct.toFixed(2)}%` : `${pct.toFixed(2)}%`;
  const originLink = item.youtube_url
    ? `<a class="vol-source-link" href="${escHtml(item.youtube_url)}" target="_blank">[원문]</a>` : '';

  return `
    <li class="vol-item">
      <div class="vol-rank">#${item.displayRank ?? item.rank}</div>
      <div class="vol-content">
        <div class="vol-meta">
          <span class="vol-asset">${escHtml(item.asset.toUpperCase())}</span>
          <span class="${pctClass}">${pctStr}</span>
          <span class="vol-sigma">σ${(item.window_vol ?? 0).toFixed(2)}%</span>
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
  const assets = ['nasdaq', 'oil', 'gold'];
  const colors = { nasdaq: '#1d4ed8', oil: '#d97706', gold: '#16a34a' };

  const allTimes = [...new Set(
    assets.flatMap(a => (candles[a] || []).map(c => c.time))
  )].sort();

  if (!allTimes.length) return;

  const datasets = assets
    .filter(a => candles[a]?.length)
    .map(asset => {
      const map = Object.fromEntries((candles[asset] || []).map(c => [c.time, c.close]));
      const first = candles[asset]?.[0]?.open || 1;
      return {
        label: asset.toUpperCase(),
        data: allTimes.map(t => map[t] != null ? ((map[t] - first) / first * 100) : null),
        borderColor: colors[asset] || '#6b7280',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.1,
        spanGaps: true,
      };
    });

  new Chart(canvas, {
    type: 'line',
    data: { labels: allTimes.map(t => t.slice(11, 16)), datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#6b7280',
            font: { size: 11, family: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
            boxWidth: 16,
            padding: 16,
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#6b7280', maxTicksLimit: 8, font: { size: 10 } },
          grid: { color: '#f3f4f6' },
          border: { color: '#e5e7eb' },
        },
        y: {
          ticks: {
            color: '#6b7280',
            font: { size: 10 },
            callback: v => v.toFixed(1) + '%',
          },
          grid: { color: '#f3f4f6' },
          border: { color: '#e5e7eb' },
        },
      },
    },
  });
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

init();
