// state.js — アプリ全体の状態管理（単一の状態オブジェクト + localStorage永続化）
//
// GameState.data が唯一の正（single source of truth）。
// 変更は必ず GameState.update(mutator) 経由で行い、保存＆再描画通知を一括で行う。

const STORAGE_KEY = 'pachinko-sim-state-v1';

function createInitialState() {
  return {
    player: {
      cash: CONFIG.INITIAL_CASH,
      storedBalls: 0,
    },
    screen: 'title', // title | select | invest | play | settlement
    selectedMachineId: null,
    session: null,
    settings: {
      spinsPerSecond: CONFIG.SPINS_PER_SECOND, // 遊戯中にも変更可能な回転速度
    },
  };
}

// 遊戯セッションの初期状態を作る
// ballsUsed: 持ち玉遊戯として投入する玉数（0でも可）
// cashInvestment: 現金投資額（円、1,000円単位。0でも可、ただし合計玉数は1以上が必要）
function createSession(machineId, ballsUsed, cashInvestment) {
  return {
    machineId,
    investedCash: cashInvestment,
    playBalls: ballsUsed + cashToBalls(cashInvestment),
    totalSpins: 0,
    spinsSinceLastWin: 0,
    winCount: 0,
    diffBalls: 0,
    totalPayoutBalls: 0, // 出玉数（獲得玉の累計。消費玉は引かないグロス値）
    diffBallsHistory: [{ spin: 0, diff: 0 }],
    winMarkers: [], // { spin, payout }
    hitHistory: [], // 確定した連チャン（スプリー）の履歴 { spinsToHit, chainCount, totalPayout }
    currentSpree: null, // 進行中の連チャン（通常への復帰でhitHistoryへ確定）
    phaseState: createInitialPhaseState(),
    isSpinning: false,
    outOfFunds: false, // 玉切れ・現金切れで続行不可
    pendingWin: null, // { payout } — 大当り演出表示中はここに値が入る
  };
}

const GameState = {
  data: null,
  listeners: [],

  init() {
    let restored = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) restored = JSON.parse(raw);
    } catch (e) {
      restored = null; // 壊れたデータは無視して初期状態から始める
    }

    this.data = restored && restored.player ? restored : createInitialState();

    // 旧バージョンのlocalStorageデータに新フィールドが無い場合の互換対応
    if (!this.data.settings) {
      this.data.settings = { spinsPerSecond: CONFIG.SPINS_PER_SECOND };
    }
    if (this.data.session) {
      if (!this.data.session.hitHistory) this.data.session.hitHistory = [];
      if (this.data.session.currentSpree === undefined) this.data.session.currentSpree = null;
      if (this.data.session.totalPayoutBalls === undefined) this.data.session.totalPayoutBalls = 0;
    }

    // リロード直後にアニメーションが暴走しないよう、遊戯中フラグ・演出待ちは必ずクリアする
    if (this.data.session) {
      this.data.session.isSpinning = false;
      this.data.session.pendingWin = null;
    }
  },

  subscribe(fn) {
    this.listeners.push(fn);
  },

  notify() {
    this.listeners.forEach((fn) => fn(this.data));
  },

  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
  },

  // mutator: (data) => void — data を直接書き換える
  update(mutator) {
    mutator(this.data);
    this.save();
    this.notify();
  },

  resetAll() {
    this.data = createInitialState();
    this.save();
    this.notify();
  },
};
