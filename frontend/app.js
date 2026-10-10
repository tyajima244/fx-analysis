const LC = LightweightCharts;
let chart, rsiChart, candle, series = {}, allData = [];
let syncing = false;
let rangeMode = 'day';

const opts = {
  layout: { background: { color: '#0d1117' }, textColor: '#9aa7b4' },
  grid: { vertLines: { color: '#18212c' }, horzLines: { color: '#18212c' } },
  rightPriceScale: { borderColor: '#27303b' },
  timeScale: { borderColor: '#27303b', timeVisible: true, secondsVisible: false },
  crosshair: { mode: LC.CrosshairMode.Normal }
};

function line(ch) {
  return ch.addLineSeries({ lineWidth: 1, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false });
}

function pad(n) { return String(n).padStart(2, '0'); }
function serverDateParts(ts) {
  const d = new Date(ts * 1000);
  return { y:d.getUTCFullYear(), m:d.getUTCMonth()+1, d:d.getUTCDate(), hh:d.getUTCHours(), mm:d.getUTCMinutes() };
}
function serverDateString(ts) {
  const p = serverDateParts(ts);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}
function serverDateTime(ts) {
  const p = serverDateParts(ts);
  return `${p.y}/${pad(p.m)}/${pad(p.d)} ${pad(p.hh)}:${pad(p.mm)}`;
}

function make() {
  document.querySelector('#chart').innerHTML = '';
  document.querySelector('#rsi').innerHTML = '';
  chart = LC.createChart(document.querySelector('#chart'), { ...opts, height: 610 });
  rsiChart = LC.createChart(document.querySelector('#rsi'), { ...opts, height: 180 });
  candle = chart.addCandlestickSeries({ upColor:'#26a69a', downColor:'#ef5350', wickUpColor:'#26a69a', wickDownColor:'#ef5350', borderVisible:false });
  series = { sma20:line(chart), sma75:line(chart), ema20:line(chart), bb2u:line(chart), bb2l:line(chart), bb3u:line(chart), bb3l:line(chart), rsi:line(rsiChart) };

  chart.timeScale().subscribeVisibleLogicalRangeChange(r => {
    if (!syncing && r) { syncing = true; rsiChart.timeScale().setVisibleLogicalRange(r); syncing = false; }
  });
  rsiChart.timeScale().subscribeVisibleLogicalRangeChange(r => {
    if (!syncing && r) { syncing = true; chart.timeScale().setVisibleLogicalRange(r); syncing = false; }
  });

  chart.subscribeCrosshairMove(p => {
    if (!p.time) return;
    const d = p.seriesData.get(candle);
    if (!d) return;
    const row = allData.find(x => x.time === p.time);
    const rangePips = (d.high - d.low) * 100;
    const bodyPips = Math.abs(d.close - d.open) * 100;
    const upperWick = (d.high - Math.max(d.open,d.close)) * 100;
    const lowerWick = (Math.min(d.open,d.close) - d.low) * 100;
    const f = v => v == null ? '—' : Number(v).toFixed(3);
    const rsi = row?.rsi14 == null ? '—' : Number(row.rsi14).toFixed(1);
    const bbWidth = row?.bb3_upper != null && row?.bb3_lower != null ? ((row.bb3_upper-row.bb3_lower)*100).toFixed(1) : '—';
    document.querySelector('#ohlc').innerHTML =
      `<b>${serverDateTime(p.time)} (MT5 server)</b>　O ${d.open.toFixed(3)}　H ${d.high.toFixed(3)}　L ${d.low.toFixed(3)}　C ${d.close.toFixed(3)}<br>`+
      `値幅 ${rangePips.toFixed(1)}p　実体 ${bodyPips.toFixed(1)}p　上ヒゲ ${upperWick.toFixed(1)}p　下ヒゲ ${lowerWick.toFixed(1)}p　`+
      `SMA20 ${f(row?.sma20)}　EMA20 ${f(row?.ema20)}　+2σ ${f(row?.bb2_upper)}　-2σ ${f(row?.bb2_lower)}　+3σ ${f(row?.bb3_upper)}　-3σ ${f(row?.bb3_lower)}　BB3σ幅 ${bbWidth}p　RSI ${rsi}`;
  });
}

const map = key => allData.filter(x => x[key] != null).map(x => ({ time:x.time, value:x[key] }));
function applyAllData() {
  candle.setData(allData.map(x => ({ time:x.time, open:x.open, high:x.high, low:x.low, close:x.close })));
  series.sma20.setData(map('sma20')); series.sma75.setData(map('sma75')); series.ema20.setData(map('ema20'));
  series.bb2u.setData(map('bb2_upper')); series.bb2l.setData(map('bb2_lower'));
  series.bb3u.setData(map('bb3_upper')); series.bb3l.setData(map('bb3_lower')); series.rsi.setData(map('rsi14'));
  toggle();
}
function toggle() {
  const q = k => document.querySelector(`[data-ind="${k}"]`).checked;
  series.sma20.applyOptions({visible:q('sma20')}); series.sma75.applyOptions({visible:q('sma75')}); series.ema20.applyOptions({visible:q('ema20')});
  series.bb2u.applyOptions({visible:q('bb2')}); series.bb2l.applyOptions({visible:q('bb2')});
  series.bb3u.applyOptions({visible:q('bb3')}); series.bb3l.applyOptions({visible:q('bb3')}); series.rsi.applyOptions({visible:q('rsi')});
  document.querySelector('#rsiWrap').style.display = q('rsi') ? 'block' : 'none';
}

function bounds() {
  if (!allData.length) return null;
  if (rangeMode === 'all') return [allData[0].time, allData.at(-1).time];
  let v = document.querySelector('#datePick').value || serverDateString(allData.at(-1).time);
  const [y,m,d] = v.split('-').map(Number);
  let start, end;
  // UTCを使うことで、CSVに書かれたMT5サーバー時刻をブラウザのJSTへ変換しない。
  if (rangeMode === 'day') { start = Date.UTC(y,m-1,d)/1000; end = Date.UTC(y,m-1,d+1)/1000 - 1; }
  else if (rangeMode === 'month') { start = Date.UTC(y,m-1,1)/1000; end = Date.UTC(y,m,1)/1000 - 1; }
  else { start = Date.UTC(y,0,1)/1000; end = Date.UTC(y+1,0,1)/1000 - 1; }
  return [start,end];
}
function showSelectedRange() {
  const b = bounds(); if (!b) return;
  const inRange = allData.filter(x => x.time >= b[0] && x.time <= b[1]);
  if (rangeMode === 'all') { chart.timeScale().fitContent(); rsiChart.timeScale().fitContent(); }
  else { chart.timeScale().setVisibleRange({from:b[0],to:b[1]}); rsiChart.timeScale().setVisibleRange({from:b[0],to:b[1]}); }
  const first = inRange.length ? serverDateTime(inRange[0].time) : '—';
  const last = inRange.length ? serverDateTime(inRange.at(-1).time) : '—';
  document.querySelector('#periodInfo').textContent = `選択範囲: ${first} ～ ${last} / ${inRange.length.toLocaleString()} bars（全データは保持）`;
}
function recommendedTf(mode) { return mode==='day'?null:mode==='month'?'M15':mode==='year'?'H4':mode==='all'?'D1':null; }
async function load() {
  const tf = document.querySelector('#tf').value;
  document.querySelector('#status').textContent = `${tf} 読込中`;
  const r = await fetch(`data/${tf}.json`);
  if (!r.ok) throw new Error(`${tf}.json を読み込めません (${r.status})`);
  allData = await r.json();
  if (!document.querySelector('#datePick').value && allData.length) document.querySelector('#datePick').value = serverDateString(allData.at(-1).time);
  make(); applyAllData(); showSelectedRange();
  document.querySelector('#status').textContent = `${tf} / 全${allData.length.toLocaleString()} bars`;
}
async function setRange(mode) {
  rangeMode = mode;
  document.querySelectorAll('[data-range]').forEach(b => b.classList.toggle('active', b.dataset.range===mode));
  document.querySelector('#dateLabel').style.display = mode==='all' ? 'none' : 'inline-flex';
  const rec = recommendedTf(mode), sel = document.querySelector('#tf');
  if (rec && sel.value !== rec) { sel.value = rec; await load(); } else showSelectedRange();
}

document.querySelector('#tf').addEventListener('change', load);
document.querySelector('#datePick').addEventListener('change', showSelectedRange);
document.querySelectorAll('[data-range]').forEach(b => b.addEventListener('click', () => setRange(b.dataset.range)));
document.querySelector('#fitBtn').addEventListener('click', () => { chart.timeScale().fitContent(); rsiChart.timeScale().fitContent(); });
document.querySelectorAll('[data-ind]').forEach(x => x.addEventListener('change', toggle));
window.addEventListener('resize', () => { chart?.applyOptions({width:document.querySelector('#chart').clientWidth}); rsiChart?.applyOptions({width:document.querySelector('#rsi').clientWidth}); });
load().catch(e => { document.querySelector('#status').textContent = `ERROR: ${e.message}`; console.error(e); });
