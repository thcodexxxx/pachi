// ui/screens.js — 画面切替・イベント配線・各画面のレンダリング
//
// 投資設定フォーム（スライダー・数値入力）はユーザーの一時的な入力値であり
// GameState には持たせない（DOM側だけで完結させ、GameState.update は
// 「遊戯開始」ボタン押下時にのみ呼ぶ）。これにより、他の状態変化による
// 再描画がユーザー入力中のフォームを巻き戻す事故を防いでいる。

const Screens = {
  els: {},

  init() {
    this.els = {
      playerBar: document.getElementById('player-bar'),
      barCash: document.getElementById('bar-cash'),
      barBalls: document.getElementById('bar-balls'),

      titleCash: document.getElementById('title-cash'),
      titleBalls: document.getElementById('title-balls'),
      btnToSelect: document.getElementById('btn-to-select'),
      btnResetAll: document.getElementById('btn-reset-all'),

      machineList: document.getElementById('machine-list'),
      btnSelectBack: document.getElementById('btn-select-back'),

      investMachineName: document.getElementById('invest-machine-name'),
      investBallsRange: document.getElementById('invest-balls-range'),
      investBallsNumber: document.getElementById('invest-balls-number'),
      investMaxBalls: document.getElementById('invest-max-balls'),
      investCashNumber: document.getElementById('invest-cash-number'),
      investTotalBalls: document.getElementById('invest-total-balls'),
      btnInvestStart: document.getElementById('btn-invest-start'),
      btnInvestBack: document.getElementById('btn-invest-back'),

      btnToggleSpin: document.getElementById('btn-toggle-spin'),
      btnAdd1000: document.getElementById('btn-add-1000'),
      btnAdd1000Banner: document.getElementById('btn-add-1000-banner'),
      btnQuit: document.getElementById('btn-quit'),
      speedSlider: document.getElementById('speed-slider'),

      settleInvested: document.getElementById('settle-invested'),
      settleWins: document.getElementById('settle-wins'),
      settleSpins: document.getElementById('settle-spins'),
      settleDiff: document.getElementById('settle-diff'),
      settleBalls: document.getElementById('settle-balls'),
      settleCashValue: document.getElementById('settle-cash-value'),
      btnSettleExchange: document.getElementById('btn-settle-exchange'),
      btnSettleKeep: document.getElementById('btn-settle-keep'),

      winOverlay: document.getElementById('win-overlay'),

      screenEls: {
        title: document.getElementById('screen-title'),
        select: document.getElementById('screen-select'),
        invest: document.getElementById('screen-invest'),
        play: document.getElementById('screen-play'),
        settlement: document.getElementById('screen-settlement'),
      },
    };

    this._buildMachineList();
    this._bindEvents();
    this._lastInvestKey = null;
    this._prevScreen = null;
  },

  _buildMachineList() {
    const container = this.els.machineList;
    container.innerHTML = '';
    Object.values(MACHINES).forEach((m) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'machine-card';
      card.innerHTML =
        '<img src="' + m.image + '" alt="' + m.name + '">' +
        '<div class="info">' +
        '<div class="name">' + m.name + '</div>' +
        '<div class="maker">' + m.maker + '</div>' +
        '<div class="spec">' + m.specLabel + '</div>' +
        '<div class="type">' + m.typeLabel + '</div>' +
        '</div>';
      card.addEventListener('click', () => {
        GameState.update((d) => {
          d.selectedMachineId = m.id;
          d.screen = 'invest';
        });
      });
      container.appendChild(card);
    });
  },

  _bindEvents() {
    const e = this.els;

    e.btnToSelect.addEventListener('click', () => {
      GameState.update((d) => { d.screen = 'select'; });
    });

    e.btnResetAll.addEventListener('click', () => {
      if (window.confirm('所持金・持ち玉・記録をすべてリセットします。よろしいですか？')) {
        GameState.resetAll();
      }
    });

    e.btnSelectBack.addEventListener('click', () => {
      GameState.update((d) => { d.screen = 'title'; });
    });

    e.btnInvestBack.addEventListener('click', () => {
      GameState.update((d) => { d.screen = 'select'; });
    });

    e.investBallsRange.addEventListener('input', () => {
      e.investBallsNumber.value = e.investBallsRange.value;
      this._updateInvestTotals();
    });
    e.investBallsNumber.addEventListener('input', () => {
      const max = Number(e.investBallsRange.max) || 0;
      let v = Math.floor(Number(e.investBallsNumber.value) || 0);
      v = Math.min(Math.max(v, 0), max);
      e.investBallsRange.value = v;
      this._updateInvestTotals();
    });
    e.investCashNumber.addEventListener('input', () => {
      this._updateInvestTotals();
    });
    document.querySelectorAll('.btn-invest-add').forEach((btn) => {
      btn.addEventListener('click', () => {
        const add = Number(btn.dataset.yen) || 0;
        const cash = GameState.data.player.cash;
        const current = Math.floor(Number(e.investCashNumber.value) || 0);
        e.investCashNumber.value = Math.min(current + add, Math.floor(cash / CONFIG.INVESTMENT_UNIT) * CONFIG.INVESTMENT_UNIT);
        this._updateInvestTotals();
      });
    });

    e.btnInvestStart.addEventListener('click', () => {
      const machineId = GameState.data.selectedMachineId;
      const ballsUsed = Math.floor(Number(e.investBallsNumber.value) || 0);
      const cashYen = Math.floor((Number(e.investCashNumber.value) || 0) / CONFIG.INVESTMENT_UNIT) * CONFIG.INVESTMENT_UNIT;
      GameEngine.startSession(machineId, ballsUsed, cashYen);
    });

    e.btnToggleSpin.addEventListener('click', () => {
      const session = GameState.data.session;
      if (!session) return;
      if (session.isSpinning) GameEngine.stop();
      else GameEngine.start();
    });

    e.btnAdd1000.addEventListener('click', () => GameEngine.addInvestment(CONFIG.INVESTMENT_UNIT));
    e.btnAdd1000Banner.addEventListener('click', () => GameEngine.addInvestment(CONFIG.INVESTMENT_UNIT));

    e.btnQuit.addEventListener('click', () => GameEngine.endSession());

    e.speedSlider.addEventListener('input', () => GameEngine.setSpeed(Number(e.speedSlider.value)));

    e.btnSettleExchange.addEventListener('click', () => GameEngine.settleExchange());
    e.btnSettleKeep.addEventListener('click', () => GameEngine.settleKeepBalls());

    e.winOverlay.addEventListener('click', () => GameEngine.ackWin());
  },

  _updateInvestTotals() {
    const e = this.els;
    const balls = Math.floor(Number(e.investBallsNumber.value) || 0);
    const cashYen = Math.floor((Number(e.investCashNumber.value) || 0) / CONFIG.INVESTMENT_UNIT) * CONFIG.INVESTMENT_UNIT;
    const totalBalls = balls + cashToBalls(cashYen);
    e.investTotalBalls.textContent = formatNum(totalBalls);
    const cash = GameState.data.player.cash;
    e.btnInvestStart.disabled = totalBalls <= 0 || cashYen > cash;
  },

  _populateInvestScreen(state) {
    const key = state.selectedMachineId + ':' + state.player.storedBalls;
    if (this._lastInvestKey === key) return;
    this._lastInvestKey = key;

    const machine = MACHINES[state.selectedMachineId];
    if (!machine) return;
    const e = this.els;
    e.investMachineName.textContent = machine.name + '（' + machine.specLabel + '）';
    e.investMaxBalls.textContent = formatNum(state.player.storedBalls);
    e.investBallsRange.max = state.player.storedBalls;
    e.investBallsRange.value = 0;
    e.investBallsNumber.max = state.player.storedBalls;
    e.investBallsNumber.value = 0;
    e.investCashNumber.value = state.player.storedBalls > 0 ? 0 : CONFIG.INVESTMENT_UNIT;
    this._updateInvestTotals();
  },

  _renderSettlement(state) {
    const session = state.session;
    if (!session) return;
    const e = this.els;
    const balls = Math.floor(session.playBalls);
    e.settleInvested.textContent = formatNum(session.investedCash) + '円';
    e.settleWins.textContent = formatNum(session.winCount) + '回';
    e.settleSpins.textContent = formatNum(session.totalSpins) + '回転';
    e.settleDiff.textContent = (session.diffBalls >= 0 ? '+' : '') + formatNum(session.diffBalls) + '玉';
    e.settleBalls.textContent = formatNum(balls) + '玉';
    e.settleCashValue.textContent = formatNum(ballsToCash(balls)) + '円';
  },

  render(state) {
    const e = this.els;

    e.playerBar.classList.toggle('hidden', state.screen === 'title');
    e.barCash.textContent = formatNum(state.player.cash);
    e.barBalls.textContent = formatNum(state.player.storedBalls);

    e.titleCash.textContent = formatNum(state.player.cash);
    e.titleBalls.textContent = formatNum(state.player.storedBalls);

    Object.entries(e.screenEls).forEach(([name, el]) => {
      el.classList.toggle('active', state.screen === name);
    });

    if (state.screen === 'invest') {
      if (this._prevScreen !== 'invest') this._lastInvestKey = null; // 他画面から入り直した際は必ずフォームを初期化
      this._populateInvestScreen(state);
    }
    if (state.screen === 'play') {
      Counter.render(state);
      Graph.render(state.session);
      Graph.renderHistory(state.session);
    }
    if (state.screen === 'settlement') this._renderSettlement(state);

    this._prevScreen = state.screen;
  },
};
