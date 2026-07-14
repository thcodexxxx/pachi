// ui/counter.js — 遊戯画面のデータカウンター表示・大当り演出
//
// 内部抽選は gameEngine.js が「1秒間にCONFIG.SPINS_PER_SECOND回」のペースで実行しており、
// GameState の変更通知（1回転ごとに発火）をそのまま描画に反映するだけで
// 「回転数が1秒間にSPINS_PER_SECOND回ずつ滑らかにカウントアップする」体感になる設計。

const Counter = {
  els: {},

  init() {
    this.els = {
      stPanel: document.getElementById('st-panel'),
      stLabel: document.getElementById('st-label'),
      stValue: document.getElementById('st-value'),
      spinsSinceWin: document.getElementById('play-spins-since-win'),
      totalSpins: document.getElementById('play-total-spins'),
      winCount: document.getElementById('play-win-count'),
      playBalls: document.getElementById('play-balls'),
      playCash: document.getElementById('play-cash'),
      playPhase: document.getElementById('play-phase'),
      playActualRate: document.getElementById('play-actual-rate'),
      playTotalPayout: document.getElementById('play-total-payout'),
      playMachineName: document.getElementById('play-machine-name'),
      outOfFundsBanner: document.getElementById('out-of-funds-banner'),
      toggleSpinBtn: document.getElementById('btn-toggle-spin'),
      winOverlay: document.getElementById('win-overlay'),
      winPayoutText: document.getElementById('win-payout-text'),
      speedButtons: Array.from(document.querySelectorAll('.speed-btn')),
    };
  },

  render(state) {
    const session = state.session;
    if (!session) return;
    const machine = MACHINES[session.machineId];
    const e = this.els;

    e.playMachineName.textContent = machine.name;
    e.spinsSinceWin.textContent = formatNum(session.spinsSinceLastWin);
    e.totalSpins.textContent = formatNum(session.totalSpins);
    e.winCount.textContent = formatNum(session.winCount);
    e.playBalls.textContent = formatNum(session.playBalls);
    e.playCash.textContent = formatNum(state.player.cash);
    e.playPhase.textContent = getPhaseLabel(session.machineId, session.phaseState.phase);
    e.playActualRate.textContent = session.winCount > 0 ? '1/' + (session.totalSpins / session.winCount).toFixed(1) : '-';
    e.playTotalPayout.textContent = formatNum(session.totalPayoutBalls);

    e.speedButtons.forEach((btn) => {
      btn.classList.toggle('active', Number(btn.dataset.speed) === state.settings.spinsPerSecond);
    });

    if (session.phaseState.spinsLeft !== null && session.phaseState.spinsLeft !== undefined) {
      e.stPanel.classList.remove('hidden');
      e.stLabel.textContent = '残り' + getPhaseLabel(session.machineId, session.phaseState.phase);
      e.stValue.textContent = formatNum(session.phaseState.spinsLeft);
    } else {
      e.stPanel.classList.add('hidden');
    }

    e.outOfFundsBanner.classList.toggle('hidden', !session.outOfFunds);

    e.toggleSpinBtn.textContent = session.isSpinning ? '遊戯停止' : '遊戯開始';
    e.toggleSpinBtn.disabled = !!session.pendingWin || (!session.isSpinning && session.outOfFunds);

    if (session.pendingWin) {
      e.winPayoutText.textContent = '+' + formatNum(session.pendingWin.payout) + '玉';
      e.winOverlay.classList.remove('hidden');
    } else {
      e.winOverlay.classList.add('hidden');
    }
  },
};
