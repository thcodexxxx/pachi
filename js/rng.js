// rng.js — 抽選ロジック（純粋関数）
//
// 副作用（DOM操作・グローバル状態の書き換え）を一切持たない設計にすることで、
// 単体テストやコンソールからの大量回転シミュレーションが容易になる。
// 各 drawSpinXxx(phaseState) は以下の形の結果を返す：
//   { win: boolean, payout: number, next: { phase, spinsLeft } }

// Node環境（シミュレーション検証用）では require、ブラウザでは machines.js が
// スクリプトスコープに定義した MACHINES をそのまま参照する（読み込み順は
// machines.js → rng.js の順で index.html に並べること）。
(function (root) {
  const isNode = typeof module !== 'undefined' && !!module.exports;
  // Node側だけ別名で受け取り、ブラウザ側は下の M() 内で外側スコープの
  // bare な MACHINES 識別子（machines.jsが定義）を直接参照する。
  const NODE_MACHINES = isNode ? require('./machines.js').MACHINES : null;
  function M() {
    return isNode ? NODE_MACHINES : MACHINES;
  }

  function randomFloat() {
    return Math.random();
  }

  // oddsDenominator分の1の確率で true を返す
  function hit(oddsDenominator) {
    return randomFloat() < 1 / oddsDenominator;
  }

  // ─── エヴァ ────────────────────────────────────────────
  function drawSpinEva(phaseState) {
    const m = M().eva;
    const phase = phaseState.phase;

    if (phase === 'normal') {
      if (hit(m.odds.normal)) {
        const r = randomFloat();
        if (r < m.firstHit.stDirectBigRate) {
          return { win: true, payout: m.payout.stDirectBig, next: { phase: 'st', spinsLeft: m.stSpins } };
        }
        if (r < m.firstHit.stDirectBigRate + m.firstHit.stDirectRate) {
          return { win: true, payout: m.payout.stDirect, next: { phase: 'st', spinsLeft: m.stSpins } };
        }
        return { win: true, payout: m.payout.jitanEntry, next: { phase: 'jitan', spinsLeft: m.jitanSpins } };
      }
      return { win: false, payout: 0, next: { phase: 'normal', spinsLeft: null } };
    }

    if (phase === 'jitan') {
      if (hit(m.odds.normal)) {
        return { win: true, payout: m.payout.stWin, next: { phase: 'st', spinsLeft: m.stSpins } };
      }
      const spinsLeft = phaseState.spinsLeft - 1;
      const next = spinsLeft <= 0 ? { phase: 'normal', spinsLeft: null } : { phase: 'jitan', spinsLeft };
      return { win: false, payout: 0, next };
    }

    if (phase === 'st') {
      if (hit(m.odds.st)) {
        return { win: true, payout: m.payout.stWin, next: { phase: 'st', spinsLeft: m.stSpins } };
      }
      const spinsLeft = phaseState.spinsLeft - 1;
      const next = spinsLeft <= 0 ? { phase: 'normal', spinsLeft: null } : { phase: 'st', spinsLeft };
      return { win: false, payout: 0, next };
    }

    throw new Error('drawSpinEva: unknown phase "' + phase + '"');
  }

  // ─── SAO ───────────────────────────────────────────────
  function drawSpinSAO(phaseState) {
    const m = M().sao;
    const phase = phaseState.phase;

    if (phase === 'normal') {
      if (hit(m.odds.normal)) {
        const r = randomFloat();
        if (r < m.firstHit.swordRate) {
          return { win: true, payout: m.payout.swordEntry, next: { phase: 'sword', spinsLeft: m.swordSpins } };
        }
        if (r < m.firstHit.swordRate + m.firstHit.lightningRate) {
          return {
            win: true,
            payout: m.payout.lightningEntry,
            next: { phase: 'lightning', spinsLeft: m.lightningSpins },
          };
        }
        return { win: true, payout: m.payout.normalReturn, next: { phase: 'normal', spinsLeft: null } };
      }
      return { win: false, payout: 0, next: { phase: 'normal', spinsLeft: null } };
    }

    if (phase === 'sword') {
      if (hit(m.odds.rush)) {
        // 昇格(1,500個確定) / 継続・10R(1,500個) / 継続・2R(300個) の3択を1回の抽選で決める
        const r = randomFloat();
        if (r < m.sword.upgradeRate) {
          return {
            win: true,
            payout: m.payout.swordWinHigh,
            next: { phase: 'lightning', spinsLeft: m.lightningSpins },
          };
        }
        if (r < m.sword.upgradeRate + m.sword.stayHighRate) {
          return { win: true, payout: m.payout.swordWinHigh, next: { phase: 'sword', spinsLeft: m.swordSpins } };
        }
        return { win: true, payout: m.payout.swordWinLow, next: { phase: 'sword', spinsLeft: m.swordSpins } };
      }
      const spinsLeft = phaseState.spinsLeft - 1;
      const next = spinsLeft <= 0 ? { phase: 'normal', spinsLeft: null } : { phase: 'sword', spinsLeft };
      return { win: false, payout: 0, next };
    }

    if (phase === 'lightning') {
      if (hit(m.odds.rush)) {
        const payout = randomFloat() < m.lightning.highRate ? m.payout.lightningWinHigh : m.payout.lightningWinLow;
        return { win: true, payout, next: { phase: 'lightning', spinsLeft: m.lightningSpins } };
      }
      const spinsLeft = phaseState.spinsLeft - 1;
      const next = spinsLeft <= 0 ? { phase: 'normal', spinsLeft: null } : { phase: 'lightning', spinsLeft };
      return { win: false, payout: 0, next };
    }

    throw new Error('drawSpinSAO: unknown phase "' + phase + '"');
  }

  function drawSpin(machineId, phaseState) {
    if (machineId === 'eva') return drawSpinEva(phaseState);
    if (machineId === 'sao') return drawSpinSAO(phaseState);
    throw new Error('drawSpin: unknown machine "' + machineId + '"');
  }

  // ─── 検証用シミュレーション ─────────────────────────────
  // ブラウザのコンソールから runSimulation('eva', 100000) のように呼び出し、
  // 実際の当選率・突入率が仕様値に近いかを確認できる。
  function runSimulation(machineId, spins) {
    spins = spins || 100000;
    let phaseState = { phase: 'normal', spinsLeft: null };
    let totalWins = 0;
    let totalPayout = 0;
    const firstHitCounts = {}; // 通常時からの初当り種別カウント
    const rushEntryCounts = {}; // 何らかのRUSH/ST状態に入った回数（継続当り含む）

    for (let i = 0; i < spins; i++) {
      const wasNormal = phaseState.phase === 'normal';
      const result = drawSpin(machineId, phaseState);
      if (result.win) {
        totalWins++;
        totalPayout += result.payout;
        if (wasNormal) {
          const key = phaseState.phase + '->' + result.next.phase;
          firstHitCounts[key] = (firstHitCounts[key] || 0) + 1;
        }
        rushEntryCounts[result.next.phase] = (rushEntryCounts[result.next.phase] || 0) + 1;
      }
      phaseState = result.next;
    }

    return {
      machineId,
      spins,
      totalWins,
      hitRate: spins / totalWins,
      totalPayout,
      avgPayoutPerWin: totalPayout / totalWins,
      firstHitCounts,
      rushEntryCounts,
    };
  }

  const api = { randomFloat, hit, drawSpin, drawSpinEva, drawSpinSAO, runSimulation };

  if (isNode) {
    module.exports = api;
  } else {
    Object.assign(root, api);
  }
})(typeof window !== 'undefined' ? window : globalThis);
