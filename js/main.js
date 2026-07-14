// main.js — エントリーポイント

document.addEventListener('DOMContentLoaded', () => {
  GameState.init();

  Counter.init();
  Graph.init();
  Screens.init();

  GameState.subscribe((state) => Screens.render(state));

  // 初期描画（GameState.init() は notify を呼ばないため明示的に描画する）
  Screens.render(GameState.data);

  // localStorageに壊れたisSpinningフラグ等が残っていないよう保存し直す
  GameState.save();
});
