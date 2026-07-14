// machines.js — 機種マスタ
//
// 出典：本アプリ開発指示プロンプトに記載の公表スペック（DMMぱちタウン調べ）。
// 数値はすべてこのオブジェクトに集約し、マジックナンバーを排除する。
// 機種を追加する場合は MACHINES に新しいエントリを足し、
// rng.js に対応する drawSpinXxx() と分岐を追加すればよい。

const MACHINES = {
  eva: {
    id: 'eva',
    name: 'e 新世紀エヴァンゲリオン 〜はじまりの記憶〜',
    maker: 'ビスティ',
    image: 'assets/eva.png',
    typeLabel: 'ST(LT)ループ機',
    specLabel: '通常 1/399.9 / ST中 1/99.6',

    odds: {
      normal: 399.9, // 通常時大当り確率（分母）
      st: 99.6, // ST中大当り確率（分母）
    },

    // 初当り時の振り分け（合計1.0）
    // 「ヘソ・割合」の内訳：ST直行(LT発動)は50.5%だが内訳が均一ではなく、
    // そのほとんど(50%)は2R・約300個、ごく一部(0.5%)だけが10R・約1,500個になる。
    firstHit: {
      stDirectBigRate: 0.005, // ST直行のうち10R（レア、大当り全体の0.5%）
      stDirectRate: 0.5, // ST直行のうち2R（大当り全体の50%）
      jitanRate: 0.495, // 時短100回転へ（2R）
    },

    jitanSpins: 100, // 時短の回転数（1/399.9で抽選）
    stSpins: 157, // STの回転数（157回転以内に1/99.6を引けば継続＝結果的に継続率約80%）

    payout: {
      stDirectBig: 1500, // 初当り（ST直行・10R）
      stDirect: 300, // 初当り（ST直行・2R）
      jitanEntry: 300, // 初当り（時短行き・2R）
      stWin: 2400, // ST中の大当り（時短経由でST突入した際の当りも含めオール2,400個）
    },
  },

  sao: {
    id: 'sao',
    name: 'e ソードアート・オンライン 閃光の軌跡',
    maker: '京楽',
    image: 'assets/sao.png',
    typeLabel: 'ライトミドル RUSH機',
    specLabel: '通常 1/199.9 / RUSH中実質 1/59.9',

    odds: {
      normal: 199.9, // 通常時大当り確率（分母）
      rush: 59.9, // RUSH中実質大当り確率（分母）
    },

    // 初当り振り分け（合計1.0）
    // 「ヘソ・割合」：SWORD RUSH突入は2R・約300個、LIGHTNING RUSH直行のみ10R・約1,500個。
    firstHit: {
      swordRate: 0.69, // SWORD RUSH突入（2R）
      lightningRate: 0.01, // LIGHTNING RUSH直行・LT（10R）
      normalReturnRate: 0.3, // 通常復帰（時短なし、2R）
    },

    swordSpins: 54, // SWORD RUSH：ST50回転+残り保留4個＝実質54回転
    lightningSpins: 119, // LIGHTNING RUSH：ST115回転+残り保留4個＝実質119回転

    // 「電チュー・割合」：SWORD RUSH中の大当り内訳（合計1.0）。
    // 昇格(LIGHTNING RUSHへ)は「次回まで+LT」3%と「ST115回転」27%の合算で30%、
    // 昇格時は常に10R・約1,500個。SWORD RUSH継続の場合のみ10R(40%)/2R(30%)の差がある。
    sword: {
      upgradeRate: 0.3, // LIGHTNING RUSHへ昇格（常に1,500個）
      stayHighRate: 0.4, // SWORD RUSH継続・10R・約1,500個
      stayLowRate: 0.3, // SWORD RUSH継続・2R・約300個
    },

    // 「電チュー・割合」：LIGHTNING RUSH中の大当り内訳（合計1.0）。常にLIGHTNING RUSH継続。
    // 「次回まで」22.5%＋「ST115回転」47.5%＝70%が10R・約1,500個、残り30%が2R・約300個。
    lightning: {
      highRate: 0.7, // 10R・約1,500個
      lowRate: 0.3, // 2R・約300個
    },

    payout: {
      swordEntry: 300, // 初当り（SWORD RUSH突入時・2R）
      lightningEntry: 1500, // 初当り（LIGHTNING RUSH直行・10R）
      normalReturn: 300, // 初当り（通常復帰）
      swordWinHigh: 1500, // SWORD RUSH中の大当り（10R）
      swordWinLow: 300, // SWORD RUSH中の大当り（2R）
      lightningWinHigh: 1500, // LIGHTNING RUSH中の大当り（10R）
      lightningWinLow: 300, // LIGHTNING RUSH中の大当り（2R）
    },
  },
};

// 各機種の初期フェーズ状態（セッション開始時に使用）
function createInitialPhaseState() {
  return { phase: 'normal', spinsLeft: null };
}

// そのフェーズが電サポ中（＝持ち玉が減らない）かどうか
// 仕様上必須なのはST中のみだが、時短/RUSH中も実際の電サポ挙動に近いため減らさない実装とする
function isNoConsumptionPhase(machineId, phase) {
  if (machineId === 'eva') return phase === 'jitan' || phase === 'st';
  if (machineId === 'sao') return phase === 'sword' || phase === 'lightning';
  return false;
}

// 現在のフェーズを画面表示用のラベルに変換
const PHASE_LABELS = {
  eva: { normal: '通常', jitan: '時短', st: 'ST' },
  sao: { normal: '通常', sword: 'SWORD RUSH', lightning: 'LIGHTNING RUSH' },
};

function getPhaseLabel(machineId, phase) {
  return (PHASE_LABELS[machineId] && PHASE_LABELS[machineId][phase]) || phase;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MACHINES,
    createInitialPhaseState,
    isNoConsumptionPhase,
    getPhaseLabel,
  };
}
