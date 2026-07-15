// gameEngine.js — ゲームループと遊戯操作（画面表示には関与しない）
//
// requestAnimationFrame で経過時間を監視し、state.settings.spinsPerSecond の速さで
// 1回転ずつ drawSpin() を呼び出して GameState に反映する。
// 「表示アニメーション」と「内部抽選」は同じタイミングで実行されるため、
// 結果をまとめて先読みするのではなく1回転ごとに逐次抽選する設計にしている。
// spinsPerSecondはループの毎フレームでGameStateから読み直すため、
// 遊戯中に速度を変更しても次のフレームから即座に反映される。

const GameEngine = {
  _rafId: null,
  _lastSpinTime: 0,
  _winTimeoutId: null,

  // ─── セッション開始・終了 ──────────────────────────────
  startSession(machineId, ballsUsed, cashInvestment) {
    const s = GameState.data;
    ballsUsed = Math.max(0, Math.floor(ballsUsed || 0));
    cashInvestment = Math.max(0, Math.floor((cashInvestment || 0) / CONFIG.INVESTMENT_UNIT) * CONFIG.INVESTMENT_UNIT);

    if (ballsUsed > s.player.storedBalls) return false;
    if (cashInvestment > s.player.cash) return false;
    const totalBalls = ballsUsed + cashToBalls(cashInvestment);
    if (totalBalls <= 0) return false;

    GameState.update((d) => {
      d.player.storedBalls -= ballsUsed;
      d.player.cash -= cashInvestment;
      d.selectedMachineId = machineId;
      d.session = createSession(machineId, ballsUsed, cashInvestment);
      d.screen = 'play';
    });
    return true;
  },

  addInvestment(yen) {
    const s = GameState.data;
    if (!s.session) return false;
    yen = Math.floor(yen / CONFIG.INVESTMENT_UNIT) * CONFIG.INVESTMENT_UNIT;
    if (yen <= 0 || s.player.cash < yen) return false;

    GameState.update((d) => {
      d.player.cash -= yen;
      d.session.investedCash += yen;
      d.session.playBalls += cashToBalls(yen);
      d.session.outOfFunds = false;
    });
    return true;
  },

  endSession() {
    this._stopLoop();
    if (this._winTimeoutId) {
      clearTimeout(this._winTimeoutId);
      this._winTimeoutId = null;
    }
    GameState.update((d) => {
      if (!d.session) return;
      d.session.isSpinning = false;
      d.session.pendingWin = null; // 演出中に「やめる」が押された場合も確実に止める
      if (d.session.currentSpree) {
        // 遊戯を途中でやめた場合も、進行中の連チャンを履歴に確定させる
        d.session.hitHistory.push(d.session.currentSpree);
        d.session.currentSpree = null;
      }
      d.screen = 'settlement';
    });
  },

  settleExchange() {
    GameState.update((d) => {
      if (!d.session) return;
      const balls = Math.floor(d.session.playBalls);
      d.player.cash += ballsToCash(balls);
      d.session = null;
      d.screen = 'select';
    });
  },

  settleKeepBalls() {
    GameState.update((d) => {
      if (!d.session) return;
      const balls = Math.floor(d.session.playBalls);
      d.player.storedBalls += balls;
      d.session = null;
      d.screen = 'select';
    });
  },

  // 遊戯中でも呼べる：回転速度を変更する（次のループのフレームから反映）
  setSpeed(spinsPerSecond) {
    spinsPerSecond = Math.min(CONFIG.MAX_SPINS_PER_SECOND, Math.max(1, Math.floor(spinsPerSecond || 0)));
    GameState.update((d) => {
      d.settings.spinsPerSecond = spinsPerSecond;
    });
  },

  // ─── 回転ループ ────────────────────────────────────────
  start() {
    const s = GameState.data;
    if (!s.session || s.session.pendingWin || s.session.outOfFunds) return;
    GameState.update((d) => {
      d.session.isSpinning = true;
    });
    this._lastSpinTime = performance.now();
    this._runLoop();
  },

  stop() {
    GameState.update((d) => {
      if (d.session) d.session.isSpinning = false;
    });
    this._stopLoop();
  },

  ackWin() {
    if (this._winTimeoutId) {
      clearTimeout(this._winTimeoutId);
      this._winTimeoutId = null;
    }
    const s = GameState.data;
    if (!s.session || !s.session.pendingWin) return;
    GameState.update((d) => {
      d.session.pendingWin = null;
      d.session.isSpinning = true;
    });
    this._lastSpinTime = performance.now();
    this._runLoop();
  },

  _stopLoop() {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  },

  _runLoop() {
    if (this._rafId !== null) return; // 二重ループ防止
    const step = (now) => {
      const s = GameState.data;
      if (!s.session || !s.session.isSpinning || s.session.pendingWin) {
        this._rafId = null;
        return;
      }
      const interval = 1000 / s.settings.spinsPerSecond;
      let guard = 0;
      // タブがバックグラウンドだった場合など、大きく（絶対時間で2秒以上）ズレていたら
      // 一括消化せず現在時刻に補正する。閾値をintervalに比例させると高速設定時に
      // 通常のフレーム遅延でも誤発動し、追いつくはずのズレを捨ててしまうため固定値にする。
      const MAX_DRIFT_MS = 2000;
      if (now - this._lastSpinTime > MAX_DRIFT_MS) {
        this._lastSpinTime = now - interval;
      }
      // 1フレームで消化する回転数の上限。intervalが短い（高速設定）ほど、
      // 同じ絶対時間分の遅れを取り戻すのに必要な回数が増えるため、intervalに応じて広げる。
      const maxCatchUp = Math.max(10, Math.ceil(MAX_DRIFT_MS / interval));
      let spun = 0;
      while (now - this._lastSpinTime >= interval && guard < maxCatchUp) {
        this._lastSpinTime += interval;
        const shouldContinue = this._executeSpin();
        guard++;
        spun++;
        if (!shouldContinue) break;
      }
      // 1フレームで消化した複数回転ぶんの保存＆再描画をまとめて1回だけ行う（高速時の負荷軽減）。
      if (spun > 0) GameState.flush();
      const after = GameState.data;
      if (after.session && after.session.isSpinning && !after.session.pendingWin) {
        this._rafId = requestAnimationFrame(step);
      } else {
        this._rafId = null;
      }
    };
    this._rafId = requestAnimationFrame(step);
  },

  // 1回転実行。falseを返した場合はその場でループを止めるべき状態(大当り演出/玉切れ)になったことを示す。
  // 保存・再描画はしない（呼び出し側が1フレームに1回 GameState.flush() する）。
  _executeSpin() {
    let stopReason = null; // 'win' | 'outOfFunds' | null

    GameState.mutate((d) => {
      const session = d.session;
      if (!session) return;
      const machineId = session.machineId;
      const prevPhase = session.phaseState.phase;
      const noConsumption = isNoConsumptionPhase(machineId, prevPhase);
      const consume = noConsumption ? 0 : CONFIG.BALLS_PER_SPIN;

      if (consume > 0 && session.playBalls < consume) {
        // 玉が足りず1回転も回せない → 自動停止
        session.isSpinning = false;
        session.outOfFunds = true;
        stopReason = 'outOfFunds';
        return;
      }

      const result = drawSpin(machineId, session.phaseState);

      session.playBalls -= consume;
      session.diffBalls -= consume;
      session.totalSpins += 1;
      session.spinsSinceLastWin += 1;
      session.phaseState = result.next;

      if (result.win) {
        session.playBalls += result.payout;
        session.diffBalls += result.payout;
        session.totalPayoutBalls += result.payout;
        session.winCount += 1;
        session.winMarkers.push({ spin: session.totalSpins, payout: result.payout });

        if (prevPhase === 'normal') {
          // 通常時からの初当り：新しい連チャン（スプリー）の開始
          session.currentSpree = {
            spinsToHit: session.spinsSinceLastWin, // リセット前の値＝通常復帰後の経過回転数
            chainCount: 1,
            totalPayout: result.payout,
          };
        } else if (session.currentSpree) {
          // ST/RUSH中の当り：連チャン継続
          session.currentSpree.chainCount += 1;
          session.currentSpree.totalPayout += result.payout;
        }

        session.spinsSinceLastWin = 0;
        session.isSpinning = false;
        session.pendingWin = { payout: result.payout };
        stopReason = 'win';
      } else if (prevPhase !== 'normal' && result.next.phase === 'normal' && session.currentSpree) {
        // ST/RUSH/時短が当たらず終了 → 連チャンが確定し履歴へ
        session.hitHistory.push(session.currentSpree);
        session.currentSpree = null;
      }

      session.diffBallsHistory.push({ spin: session.totalSpins, diff: session.diffBalls });
    });

    if (stopReason === 'win') {
      this._winTimeoutId = setTimeout(() => this.ackWin(), CONFIG.WIN_DISPLAY_MS);
      return false;
    }
    if (stopReason === 'outOfFunds') {
      return false;
    }
    return true;
  },
};
