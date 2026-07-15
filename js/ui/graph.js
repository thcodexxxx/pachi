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
    this.historyScroll = document.getElementById('hit-history-scroll');
  },

  // Retina対応：CSS表示サイズに対して実ピクセルを合わせ、{w, h}(CSSピクセル単位)を返す。
  // cssWidth/cssHeight を明示指定した場合はそのサイズでcanvasを構成する（履歴グラフの
  // 横スクロール用に、本数に応じてcanvasを広げる目的で使う）。
  _prepareCanvas(canvas, ctx, explicitWidth, explicitHeight) {
    const cssWidth = explicitWidth || canvas.clientWidth || 600;
    const cssHeight = explicitHeight || canvas.clientHeight || 200;
    const dpr = window.devicePixelRatio || 1;
    // 明示サイズ指定時（履歴グラフ）だけインラインstyleでcanvasを広げる。
    // スランプグラフはCSSの width:100% を維持したいので触らない。
    if (explicitWidth) {
      canvas.style.width = cssWidth + 'px';
      canvas.style.height = cssHeight + 'px';
    }
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

  // 大当り履歴を棒グラフで描画。
  // ・1本＝1スプリー（初当り〜連チャン終了）。棒の高さ＝そこまでのハマり回転数。
  // ・最新が一番左（履歴配列を反転して左から描画）。
  // ・棒の上に連チャン数バッジ、棒の下にそのスプリーの出玉数。
  // ・全件を描画し、本数に応じてcanvasを横に広げてコンテナ側で横スクロールさせる。
  renderHistory(session) {
    if (!this.historyCtx) return;
    const ctx = this.historyCtx;
    const canvasH = 180;

    const history = (session && session.hitHistory) || [];
    const containerW = (this.historyScroll && this.historyScroll.clientWidth) || 600;

    if (history.length === 0) {
      const { w, h } = this._prepareCanvas(this.historyCanvas, ctx, containerW, canvasH);
      ctx.fillStyle = '#8892a4';
      ctx.font = '12px Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('まだ大当り履歴がありません', w / 2, h / 2);
      return;
    }

    // 最新を左に。履歴は古い順に積まれるので反転する。
    const ordered = history.slice().reverse();

    const padding = { top: 32, right: 12, bottom: 24, left: 12 };
    const barWidth = 40;
    const barGap = 10;
    // 本数ぶんの幅。コンテナ幅より狭ければコンテナ幅いっぱいに合わせる。
    const contentW = padding.left + padding.right + ordered.length * barWidth + (ordered.length - 1) * barGap;
    const cssWidth = Math.max(containerW, contentW);

    const { h } = this._prepareCanvas(this.historyCanvas, ctx, cssWidth, canvasH);
    const plotH = h - padding.top - padding.bottom;
    const maxSpinsToHit = Math.max(1, ...ordered.map((s) => s.spinsToHit));

    ctx.textAlign = 'center';
    ordered.forEach((spree, i) => {
      const x = padding.left + i * (barWidth + barGap);
      const barH = Math.max(2, (spree.spinsToHit / maxSpinsToHit) * plotH);
      const y = padding.top + (plotH - barH);
      const centerX = x + barWidth / 2;
      const isChain = spree.chainCount >= 2;

      ctx.fillStyle = isChain ? '#ffb23f' : '#4fb2ff';
      ctx.fillRect(x, y, barWidth, barH);

      // 上段：連チャン数バッジ（2連以上）
      if (isChain) {
        ctx.fillStyle = '#ff3355';
        ctx.font = 'bold 11px Consolas, monospace';
        ctx.fillText(spree.chainCount + '連', centerX, 13);
      }
      // 中段：ハマり回転数（棒の頭のすぐ上に固定行として）
      ctx.fillStyle = '#c8d0dc';
      ctx.font = '9px Consolas, monospace';
      ctx.fillText(String(spree.spinsToHit), centerX, padding.top - 5);

      // 下段：そのスプリーの出玉数
      ctx.fillStyle = '#39ff6a';
      ctx.font = 'bold 10px Consolas, monospace';
      ctx.fillText((spree.totalPayout || 0).toLocaleString('ja-JP'), centerX, h - 8);
    });
  },
};
