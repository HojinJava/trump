// main.js — Trump Index frontend
const INDEX_URL   = './index.json';
const TICKERS_URL = './tickers.json';

// 티커 설정 (tickers.json에서 로드 — REST /tickers 엔드포인트 역할)
let TICKERS = {};

// Cache for lazily loaded event data
const eventCache = {};

async function init() {
  try {
    const [index, tickerData] = await Promise.all([
      fetch(INDEX_URL).then(r => r.json()),
      fetch(TICKERS_URL).then(r => r.json()),
    ]);
    TICKERS = tickerData.tickers || {};
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
        <span class="toggle-title">${escHtml(event.title_ko || event.title)}</span>
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
  // tickers.json 키 순서 기준, 실제 데이터에 있는 자산만 탭으로 노출
  const presentAssets = new Set(volItems.map(v => v.asset));
  const orderedAssets = Object.keys(TICKERS).filter(k => presentAssets.has(k));
  const tabs = ['전체', ...orderedAssets];

  detailEl.innerHTML = `
    ${renderIndices(event.indices)}
    ${renderSummary(event)}
    <div class="chart-wrap">
      <canvas id="chart-${escHtml(id)}"></canvas>
    </div>
    <div class="vol-tabs" data-event="${escHtml(id)}">
      ${tabs.map((a, i) => {
        const label = a === '전체' ? '전체' : (TICKERS[a]?.label || a.toUpperCase());
        return `<button class="vol-tab${i === 0 ? ' active' : ''}" data-asset="${escHtml(a)}">${label}</button>`;
      }).join('')}
    </div>
    <ul class="volatility-list" id="vol-list-${escHtml(id)}">
      ${renderVolItems(volItems, '전체', id)}
    </ul>`;
  // vol-item hover → chart highlight (차트 초기화 후 바인딩)
  requestAnimationFrame(() => bindVolItemHovers(id));
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
    if (list) {
      list.innerHTML = renderVolItems(event.top_volatility || [], asset, id);
      bindVolItemHovers(id);
    }
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

function renderVolItems(items, asset, eventId) {
  if (asset === '전체') {
    // 전체: 전 티커 평균 절대변동률 기준 정렬 후 겹치는 시간 구간 제거
    const scored = items.map(item => {
      const moves = Object.values(item.market_moves || {});
      const avg = moves.length ? moves.reduce((s, v) => s + Math.abs(v), 0) / moves.length : 0;
      return { ...item, _avgMove: avg };
    }).sort((a, b) => b._avgMove - a._avgMove);

    // 시간 구간 겹침 제거 (높은 점수 우선 유지)
    const deduped = [];
    for (const item of scored) {
      const s = new Date(item.time).getTime();
      const e = new Date(item.end_time || item.time).getTime();
      const overlaps = deduped.some(d => {
        const ds = new Date(d.time).getTime();
        const de = new Date(d.end_time || d.time).getTime();
        return s <= de && e >= ds;
      });
      if (!overlaps) deduped.push(item);
    }
    return deduped.map((item, i) => renderVolItemGlobal(item, i + 1, eventId)).join('');
  }
  const filtered = items.filter(v => v.asset === asset);
  return filtered.map((item, i) => renderVolItem({ ...item, displayRank: i + 1 }, eventId)).join('');
}

function renderVolItem(item, eventId) {
  const pct = item.market_moves?.[item.asset] ?? 0;
  const pctClass = pct < -0.1 ? 'vol-change-neg' : pct > 0.1 ? 'vol-change-pos' : 'vol-change-neu';
  const pctStr = pct >= 0 ? `+${pct.toFixed(2)}%` : `${pct.toFixed(2)}%`;

  // YouTube 링크: 시간 아이콘 + 해당 구간 보기
  const ytLink = item.youtube_url
    ? `<a class="vol-yt-link" href="${escHtml(item.youtube_url)}" target="_blank"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> 해당 구간 보기 <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-1px"><path d="M23 7s-.3-2-1.2-2.8c-1.1-1.2-2.4-1.2-3-1.3C16.3 2.8 12 2.8 12 2.8s-4.3 0-6.8.1c-.6.1-1.9.1-3 1.3C1.3 5 1 7 1 7S.8 9.2.8 11.5v2.1C.8 16 1 18 1 18s.3 2 1.2 2.8c1.1 1.2 2.6 1.1 3.3 1.2C7.6 22.1 12 22 12 22s4.3 0 6.8-.2c.6-.1 1.9-.1 3-1.3.9-.8 1.2-2.8 1.2-2.8s.2-2.2.2-4.4v-2.1C23.2 9.2 23 7 23 7zM9.7 15.5V8.3l8.1 3.6-8.1 3.6z"/></svg></a>`
    : '';

  // 발언 텍스트: 한국어 우선, 원문은 접기로 숨김
  const ko = item.transcript_segment_ko;
  const en = item.transcript_segment;
  let textHtml = '';
  if (ko) {
    textHtml = `<div class="vol-text-ko">"${escHtml(ko)}"</div>`;
    if (en) textHtml += `<details class="vol-original"><summary>원문 보기</summary><div class="vol-text-en">${escHtml(en)}</div></details>`;
  } else if (en) {
    textHtml = `<details class="vol-original" open><summary>원문 보기</summary><div class="vol-text-en">"${escHtml(en)}"</div></details>`;
  }

  const zoneStart = (item.time || '').slice(11, 16);
  const zoneEnd   = (item.end_time || item.time || '').slice(11, 16);
  const timeRange = zoneStart
    ? `<span class="vol-timerange">${zoneStart !== zoneEnd ? `${zoneStart} ~ ${zoneEnd}` : zoneStart} KST</span>`
    : '';

  return `
    <li class="vol-item" data-event-id="${escHtml(eventId || '')}" data-time="${escHtml(item.time || '')}" data-end-time="${escHtml(item.end_time || item.time || '')}">
      <div class="vol-rank">#${item.displayRank ?? item.rank}</div>
      <div class="vol-content">
        <div class="vol-meta">
          <span class="vol-asset">${escHtml(TICKERS[item.asset]?.label || item.asset.toUpperCase())}</span>
          <span class="${pctClass}">${pctStr}</span>
          ${timeRange}
          ${ytLink}
        </div>
        ${textHtml}
      </div>
    </li>`;
}

function renderVolItemGlobal(item, rank, eventId) {
  // 전체 탭: market_moves의 모든 티커를 tickers.json 순서로 표시
  const moves = item.market_moves || {};
  const tickerBadges = Object.keys(TICKERS)
    .filter(k => k in moves)
    .map(k => {
      const pct = moves[k];
      const pctClass = pct < -0.1 ? 'vol-change-neg' : pct > 0.1 ? 'vol-change-pos' : 'vol-change-neu';
      const pctStr = pct >= 0 ? `+${pct.toFixed(2)}%` : `${pct.toFixed(2)}%`;
      return `<span class="vol-asset">${escHtml(TICKERS[k].label)}</span><span class="${pctClass}" style="font-size:0.8rem">${pctStr}</span>`;
    }).join(' ');

  const ytLink = item.youtube_url
    ? `<a class="vol-yt-link" href="${escHtml(item.youtube_url)}" target="_blank"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> 해당 구간 보기 <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-1px"><path d="M23 7s-.3-2-1.2-2.8c-1.1-1.2-2.4-1.2-3-1.3C16.3 2.8 12 2.8 12 2.8s-4.3 0-6.8.1c-.6.1-1.9.1-3 1.3C1.3 5 1 7 1 7S.8 9.2.8 11.5v2.1C.8 16 1 18 1 18s.3 2 1.2 2.8c1.1 1.2 2.6 1.1 3.3 1.2C7.6 22.1 12 22 12 22s4.3 0 6.8-.2c.6-.1 1.9-.1 3-1.3.9-.8 1.2-2.8 1.2-2.8s.2-2.2.2-4.4v-2.1C23.2 9.2 23 7 23 7zM9.7 15.5V8.3l8.1 3.6-8.1 3.6z"/></svg></a>`
    : '';

  const ko = item.transcript_segment_ko;
  const en = item.transcript_segment;
  let textHtml = '';
  if (ko) {
    textHtml = `<div class="vol-text-ko">"${escHtml(ko)}"</div>`;
    if (en) textHtml += `<details class="vol-original"><summary>원문 보기</summary><div class="vol-text-en">${escHtml(en)}</div></details>`;
  } else if (en) {
    textHtml = `<details class="vol-original" open><summary>원문 보기</summary><div class="vol-text-en">"${escHtml(en)}"</div></details>`;
  }

  const zoneStart = (item.time || '').slice(11, 16);
  const zoneEnd   = (item.end_time || item.time || '').slice(11, 16);
  const timeRange = zoneStart
    ? `<span class="vol-timerange">${zoneStart !== zoneEnd ? `${zoneStart} ~ ${zoneEnd}` : zoneStart} KST</span>`
    : '';

  return `
    <li class="vol-item" data-event-id="${escHtml(eventId || '')}" data-time="${escHtml(item.time || '')}" data-end-time="${escHtml(item.end_time || item.time || '')}">
      <div class="vol-rank">#${rank}</div>
      <div class="vol-content">
        <div class="vol-meta" style="flex-wrap:wrap;gap:6px">
          ${tickerBadges}
          ${timeRange}
          ${ytLink}
        </div>
        ${textHtml}
      </div>
    </li>`;
}

function bindVolItemHovers(id) {
  const canvas = document.getElementById(`chart-${id}`);
  if (!canvas) return;
  document.querySelectorAll(`#vol-list-${id} .vol-item`).forEach(el => {
    el.addEventListener('mouseenter', () => {
      if (!canvas._chart) return;
      const allTimes = canvas._allTimes || [];
      const startTime = el.dataset.time || '';
      const endTime   = el.dataset.endTime || startTime;
      const startIdx = allTimes.findIndex(t => t.slice(0, 16) === startTime.slice(0, 16));
      const endIdx   = [...allTimes].reverse().findIndex(t => t.slice(0, 16) === endTime.slice(0, 16));
      if (startIdx < 0) return;
      const resolvedEndIdx = endIdx < 0 ? startIdx : allTimes.length - 1 - endIdx;
      canvas._hoverZone = { startIdx, endIdx: resolvedEndIdx };
      canvas._chart.update('none');
    });
    el.addEventListener('mouseleave', () => {
      if (!canvas._chart) return;
      canvas._hoverZone = null;
      canvas._chart.update('none');
    });
  });
}

function initChart(eventId, event) {
  const canvas = document.getElementById(`chart-${eventId}`);
  if (!canvas || canvas._chartInit) return;
  canvas._chartInit = true;

  // chart_data: 파이프라인 사전 연산 (times, step_min, series)
  const chartData = event.chart_data || {};
  const allTimes  = chartData.times   || [];
  const stepMin   = chartData.step_min || 10;
  const series    = chartData.series   || {};

  if (!allTimes.length) return;

  // tickers.json 키 순서로 자산 정렬 (없는 자산은 뒤에)
  const allSeriesAssets = Object.keys(series);
  const assets = [
    ...Object.keys(TICKERS).filter(k => allSeriesAssets.includes(k)),
    ...allSeriesAssets.filter(k => !TICKERS[k]),
  ];

  const datasets = assets.map(asset => ({
    label: TICKERS[asset]?.label || asset.toUpperCase(),
    data: series[asset],
    borderColor: TICKERS[asset]?.color || '#6b7280',
    backgroundColor: TICKERS[asset]?.color || '#6b7280',
    borderWidth: 2,
    pointRadius: 0,
    pointHoverRadius: 0,
    tension: 0.1,
    spanGaps: true,
  }));

  const zoneHighlightPlugin = {
    id: 'zoneHighlight',
    afterDatasetsDraw(chart) {
      const zone = chart._hoverZone;
      if (!zone) return;
      const { startIdx, endIdx } = zone;
      const ctx    = chart.ctx;
      const xStart = chart.scales.x.getPixelForValue(startIdx);
      const xEnd   = chart.scales.x.getPixelForValue(endIdx);
      const top    = chart.chartArea.top;
      const bottom = chart.chartArea.bottom;
      ctx.save();
      // 구간 음영
      ctx.fillStyle = 'rgba(99, 102, 241, 0.10)';
      ctx.fillRect(xStart, top, Math.max(xEnd - xStart, 1), bottom - top);
      // 시작선
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(xStart, top);
      ctx.lineTo(xStart, bottom);
      ctx.stroke();
      // 종료선 (시작과 다를 때만)
      if (endIdx !== startIdx) {
        ctx.beginPath();
        ctx.moveTo(xEnd, top);
        ctx.lineTo(xEnd, bottom);
        ctx.stroke();
      }
      ctx.restore();
    },
  };

  const crosshairPlugin = {
    id: 'crosshair',
    afterDraw(chart) {
      const active = chart.tooltip?._active;
      if (!active || !active.length) return;
      const ctx = chart.ctx;
      const x = active[0].element.x;
      const top = chart.chartArea.top;
      const bottom = chart.chartArea.bottom;
      ctx.save();
      ctx.strokeStyle = 'rgba(107, 114, 128, 0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
      ctx.restore();
    },
  };

  const chart = new Chart(canvas, {
    type: 'line',
    data: { labels: allTimes.map(t => t.slice(11, 16)), datasets },
    plugins: [zoneHighlightPlugin, crosshairPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: {
            color: '#6b7280',
            font: { size: 11, family: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
            boxWidth: 16,
            padding: 16,
          }
        },
        tooltip: {
          callbacks: {
            title: items => allTimes[items[0].dataIndex].slice(11, 16) + ' KST',
            label: item => {
              const v = item.parsed.y;
              if (v == null) return null;
              const sign = v >= 0 ? '+' : '';
              return `${item.dataset.label}  ${sign}${v.toFixed(2)}%`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: '#6b7280',
            font: { size: 10 },
            maxTicksLimit: 100,
            autoSkip: false,
            callback: (_, idx) => {
              const hhmm = allTimes[idx]?.slice(11, 16);
              if (!hhmm) return null;
              const [h, m] = hhmm.split(':').map(Number);
              return (h * 60 + m) % stepMin === 0 ? hhmm : null;
            },
          },
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

  canvas._chart    = chart;
  canvas._allTimes = allTimes;
  canvas._hoverZone = null;
  bindVolItemHovers(eventId);
}

function renderSummary(event) {
  const s = event.speech_summary;
  if (!s) return '';

  const points = (s.key_points || [])
    .map(p => `<li>${escHtml(p)}</li>`).join('');

  const pc = s.price_changes || {};
  const priceRows = Object.entries(pc).map(([asset, v]) => {
    const cls = v.change_pct > 0 ? 'vol-change-pos' : v.change_pct < 0 ? 'vol-change-neg' : 'vol-change-neu';
    const sign = v.change_pct > 0 ? '+' : '';
    return `
      <div class="price-change-row">
        <span class="price-asset">${TICKERS[asset]?.label || asset.toUpperCase()}</span>
        <span class="price-range">${escHtml(v.pre_time_kst)} KST → ${escHtml(v.post_time_kst)} KST</span>
        <span class="${cls} price-pct">${sign}${v.change_pct.toFixed(2)}%</span>
      </div>`;
  }).join('');

  return `
    <div class="summary-card">
      <div class="summary-header">
        <span class="summary-label">연설 요약</span>
        <span class="summary-meta">${escHtml(s.broadcast_start_kst || '')} · ${s.transcript_duration_min ?? '?'}분</span>
      </div>
      ${s.full_summary ? `<p class="summary-full">${escHtml(s.full_summary)}</p>` : ''}
      <ul class="summary-points">${points}</ul>
      ${priceRows ? `<div class="summary-price-section"><div class="summary-price-title">발언 전후 주가 변동</div>${priceRows}</div>` : ''}
      ${s.market_impact_summary ? `<div class="summary-impact">${escHtml(s.market_impact_summary)}</div>` : ''}
    </div>`;
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
