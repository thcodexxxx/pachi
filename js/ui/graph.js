// ui/graph.js — スランプグラフ（差玉推移）をCanvasで描画

const Graph = {
  canvas: null,
  ctx: null,
  historyCanvas: null,
  historyCtx: null,

  init() {
    this.canvas = document.getElementById('slump-graph');
    this.ctx = this.canvas.getContext('2d');
    this.historyCanvas = document.getElementById('hit-history-graph');
    this.historyCtx = this.historyCanvas.getContext('2d');
  },

  // Retina対応：CSS表示サイズに対して実ピクセルを合わせ、{w, h}(CSSピクセル単位)を返す
  _prepareCanvas(canvas, ctx) {
    const cssWidth = canvas.clientWidth || 600;
    const cssHeight = canvas.clientHeight || 200;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(cssWidth * dpr) || canvas.height !== Math.round(cssHeight * dpr)) {
      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssHeight * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    return { w: cssWidth, h: cssHeight };
  },

  render(session) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const { w, h } = this._prepareCanvas(this.canvas, ctx);

    const history = (session && session.diffBallsHistory) || [{ spin: 0, diff: 0 }];
    const padding = { top: 14, right: 14, bottom: 20, left: 46 };
    const plotW = w - padding.left - padding.right;
    const plotH = h - padding.top - padding.bottom;

    const maxSpin = Math.max(1, history[history.length - 1].spin);
    let minDiff = 0;
    let maxDiff = 0;
    for (const p of history) {
      if (p.diff < minDiff) minDiff = p.diff;
      if (p.diff > maxDiff) maxDiff = p.diff;
    }
    // 上下に少し余白を持たせる
    const range = Math.max(1, maxDiff - minDiff);
    minDiff -= range * 0.08;
    maxDiff += range * 0.08;

    const xOf = (spin) => padding.left + (spin / maxSpin) * plotW;
    const yOf = (diff) => padding.top + (1 - (diff - minDiff) / (maxDiff - minDiff)) * plotH;

    // ゼロライン
    ctx.strokeStyle = '#2a3240';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const zeroY = yOf(0);
    ctx.moveTo(padding.left, zeroY);
    ctx.lineTo(w - padding.right, zeroY);
    ctx.stroke();

    // Y軸ラベル
    ctx.fillStyle = '#8892a4';
    ctx.font = '10px Consolas, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(maxDiff).toLocaleString('ja-JP'), padding.left - 6, padding.top + 8);
    ctx.fillText(Math.round(minDiff).toLocaleString('ja-JP'), padding.left - 6, h - padding.bottom);
    ctx.fillText('0', padding.left - 6, zeroY + 3);

    // 折れ線
    ctx.strokeStyle = '#4fb2ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    history.forEach((p, i) => {
      const x = xOf(p.spin);
      const y = yOf(p.diff);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 大当りマーカー
    const markers = (session && session.winMarkers) || [];
    ctx.fillStyle = '#ff3355';
    markers.forEach((m) => {
      // diffBallsHistory は spin=0から1回転ごとに1件ずつ積まれるため、
      // history[spin] で直接該当ポイントを引ける。
      const point = history[m.spin] && history[m.spin].spin === m.spin ? history[m.spin] : history.find((p) => p.spin === m.spin);
      if (!point) return;
      const x = xOf(point.spin);
      const y = yOf(point.diff);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // X軸ラベル
    ctx.fillStyle = '#8892a4';
    ctx.textAlign = 'left';
    ctx.fillText('0', padding.left, h - 4);
    ctx.textAlign = 'right';
    ctx.fillText(maxSpin.toLocaleString('ja-JP') + '回転', w - padding.right, h - 4);
  },

  // 大当り履歴（通常時から何回転で当たったか／何連チャンしたか）を棒グラフで描画
  renderHistory(session) {
    if (!this.historyCtx) return;
    const ctx = this.historyCtx;
    const { w, h } = this._prepareCanvas(this.historyCanvas, ctx);

    const history = (session && session.hitHistory) || [];
    // ラベル用に上部を2行分（連チャンバッジ＋回転数）確保し、棒グラフの高さには影響させない
    const padding = { top: 34, right: 10, bottom: 20, left: 10 };
    const plotW = w - padding.left - padding.right;
    const plotH = h - padding.top - padding.bottom;

    if (history.length === 0) {
      ctx.fillStyle = '#8892a4';
      ctx.font = '12px Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('まだ大当り履歴がありません', w / 2, h / 2);
      return;
    }

    // 直近N件だけ表示（多すぎると1本あたりが細くなりすぎるため）
    const MAX_BARS = 20;
    const shown = history.slice(-MAX_BARS);
    const maxSpinsToHit = Math.max(1, ...shown.map((s) => s.spinsToHit));

    const barGap = 6;
    const barWidth = Math.max(6, (plotW - barGap * (shown.length - 1)) / shown.length);

    ctx.textAlign = 'center';
    shown.forEach((spree, i) => {
      const x = padding.left + i * (barWidth + barGap);
      const barH = Math.max(2, (spree.spinsToHit / maxSpinsToHit) * plotH);
      const y = padding.top + (plotH - barH);
      const isChain = spree.chainCount >= 2;

      ctx.fillStyle = isChain ? '#ffb23f' : '#4fb2ff';
      ctx.fillRect(x, y, barWidth, barH);

      // ラベルは棒の高さに関わらず固定の2行（連チャンバッジ／回転数）に描画し、
      // 背の高い棒でも文字同士が重ならないようにする
      const centerX = x + barWidth / 2;
      if (isChain) {
        ctx.fillStyle = '#ff3355';
        ctx.font = 'bold 10px Consolas, monospace';
        ctx.fillText(spree.chainCount + '連', centerX, 12);
      }
      ctx.fillStyle = '#c8d0dc';
      ctx.font = '9px Consolas, monospace';
      ctx.fillText(String(spree.spinsToHit), centerX, padding.top - 4);
    });
  },
};
