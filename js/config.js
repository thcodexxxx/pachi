// config.js — 各種設定値
// このファイルの数値を変えるだけで収支計算やゲーム速度を調整できる。
// 通常の<script>として読み込む前提（ES moduleにしない）。
// file:// で index.html を直接開いた場合でも type="module" は
// CORS制限で読み込めないブラウザがあるため、全ファイルをグローバルスコープの
// 素のスクリプトとして構成している。

const CONFIG = {
  INITIAL_CASH: 1000000, // 初期所持金（円）
  RENTAL_PRICE_PER_BALL: 4.3, // 貸玉単価（円/玉、現金遊戯の参考値として保持）
  BALLS_PER_1000YEN: 232, // 1,000円で借りられる玉数
  SPINS_PER_1000YEN: 17, // 回転効率（1,000円あたりの回転数）
  EXCHANGE_PRICE_PER_BALL: 3.5, // 換金レート（円/玉）
  INVESTMENT_UNIT: 1000, // 投資単位（円）
  SPINS_PER_SECOND: 10, // ゲーム内演出速度（1秒あたりの回転数）
  WIN_DISPLAY_MS: 2500, // 大当り演出を自動で閉じるまでの時間（ミリ秒）
};

// 1回転あたりの消費玉数 = 1,000円で借りられる玉数 ÷ 回転効率
CONFIG.BALLS_PER_SPIN = CONFIG.BALLS_PER_1000YEN / CONFIG.SPINS_PER_1000YEN;

// 投資額(円) → 貸出玉数
function cashToBalls(yen) {
  return Math.floor(yen / CONFIG.INVESTMENT_UNIT) * CONFIG.BALLS_PER_1000YEN;
}

// 玉数 → 換金額(円)。端数切り捨て。
function ballsToCash(balls) {
  return Math.floor(balls * CONFIG.EXCHANGE_PRICE_PER_BALL);
}

// 3桁カンマ区切り表示用（表示上は四捨五入。換金等の実際の端数処理は各関数がMath.floorで行う）
function formatNum(n) {
  return Math.round(n).toLocaleString('ja-JP');
}

// Node.js（テスト・シミュレーション用）から require できるようにする
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CONFIG, cashToBalls, ballsToCash, formatNum };
}
