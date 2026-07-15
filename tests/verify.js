// tests/verify.js — 抽選ロジックの検証スクリプト（Node.jsから実行）
// 実行: node tests/verify.js
//
// 各機種を100万回転シミュレートし、公表スペックから導かれる理論値と比較する。
// 統計的なズレは正常（乱数のため）。目安として数%以内に収まっていればOK。

const { drawSpin } = require('../js/rng.js');

function simulate(machineId, spins) {
  let phaseState = { phase: 'normal', spinsLeft: null };
  let totalWins = 0;
  let normalSpins = 0;
  let normalWins = 0;
  const firstHitTransition = {}; // 通常時からの初当り遷移先カウント
  let stEntriesFromNormalOrJitan = 0; // eva: st"突入"（直行 or 時短経由）カウント（ST内継続は含まない）
  let stContinued = 0; // eva: ST中に当って継続した回数
  let stContinuedBig = 0; // eva: ST中の当りのうち8R×4回・約4800個だった回数
  let stTimedOut = 0; // eva: ST中に157回転以内に当たらず終了した回数
  let jitanEntries = 0;
  let jitanPulledBack = 0; // 時短中に当たってST突入した回数
  let stDirectBigCount = 0; // eva: ST直行のうち10R(1500個)だった回数
  let stDirectSmallCount = 0; // eva: ST直行のうち2R(300個)だった回数
  let swordEntries = 0; // sao: 初当りでSWORD直行
  let swordWinEvents = 0; // sao: SWORD RUSH中の当り回数（継続 or 昇格の分岐点）
  let swordUpgraded = 0;
  let swordStayHighCount = 0; // sao: SWORD RUSH継続・10R(1500個)
  let swordStayLowCount = 0; // sao: SWORD RUSH継続・2R(300個)
  let swordTimedOut = 0; // sao: SWORD RUSH中に当たらず終了した回数
  let lightningDirectEntries = 0;
  let lightningWinEvents = 0; // LT中の当り回数(=継続分岐)
  let lightningInfiniteCount = 0; // sao: LIGHTNING RUSH中・10R(1500個)・無限ST(次回まで)
  let lightningHighCount = 0; // sao: LIGHTNING RUSH中・10R(1500個)・119回転カウントダウン
  let lightningLowCount = 0; // sao: LIGHTNING RUSH中・2R(300個)・119回転カウントダウン
  let lightningTimedOut = 0; // sao: LIGHTNING RUSH中に当たらず終了した回数
  let normalReturnCount = 0;

  for (let i = 0; i < spins; i++) {
    const prevPhase = phaseState.phase;
    if (prevPhase === 'normal') normalSpins++;
    const result = drawSpin(machineId, phaseState);

    if (result.win) {
      totalWins++;
      if (prevPhase === 'normal') normalWins++;

      if (machineId === 'eva') {
        if (prevPhase === 'normal') {
          firstHitTransition[result.next.phase] = (firstHitTransition[result.next.phase] || 0) + 1;
          if (result.next.phase === 'st') {
            stEntriesFromNormalOrJitan++;
            if (result.payout === 1500) stDirectBigCount++;
            else stDirectSmallCount++;
          }
          if (result.next.phase === 'jitan') jitanEntries++;
        } else if (prevPhase === 'jitan') {
          jitanPulledBack++;
          stEntriesFromNormalOrJitan++;
        } else if (prevPhase === 'st') {
          stContinued++;
          if (result.payout === 4800) stContinuedBig++;
        }
      }

      if (machineId === 'sao') {
        if (prevPhase === 'normal') {
          firstHitTransition[result.next.phase] = (firstHitTransition[result.next.phase] || 0) + 1;
          if (result.next.phase === 'sword') swordEntries++;
          if (result.next.phase === 'lightning') lightningDirectEntries++;
          if (result.next.phase === 'normal') normalReturnCount++;
        } else if (prevPhase === 'sword') {
          swordWinEvents++;
          if (result.next.phase === 'lightning') swordUpgraded++;
          else if (result.payout === 1500) swordStayHighCount++;
          else swordStayLowCount++;
        } else if (prevPhase === 'lightning') {
          lightningWinEvents++;
          if (result.next.spinsLeft === -1) lightningInfiniteCount++;
          else if (result.payout === 1500) lightningHighCount++;
          else lightningLowCount++;
        }
      }
    } else {
      // ST/RUSHが「継続失敗（そのまま終了）」で通常へ落ちた分岐を数える
      if (machineId === 'eva' && prevPhase === 'st' && result.next.phase === 'normal') {
        stTimedOut++;
      }
      if (machineId === 'sao' && prevPhase === 'sword' && result.next.phase === 'normal') {
        swordTimedOut++;
      }
      if (machineId === 'sao' && prevPhase === 'lightning' && result.next.phase === 'normal') {
        lightningTimedOut++;
      }
    }

    phaseState = result.next;
  }

  return {
    machineId,
    spins,
    totalWins,
    hitRate: (spins / totalWins).toFixed(2),
    normalHitRate: (normalSpins / normalWins).toFixed(2),
    firstHitTransition,
    stEntriesFromNormalOrJitan,
    jitanEntries,
    jitanPulledBack,
    jitanPullbackRate: jitanEntries ? (jitanPulledBack / jitanEntries) : null,
    stDirectBigCount,
    stDirectSmallCount,
    stContinued,
    stContinuedBig,
    stTimedOut,
    stContinuationRate: stContinued + stTimedOut ? stContinued / (stContinued + stTimedOut) : null,
    swordEntries,
    lightningDirectEntries,
    normalReturnCount,
    swordWinEvents,
    swordUpgraded,
    swordStayHighCount,
    swordStayLowCount,
    swordTimedOut,
    swordContinuationRate: swordWinEvents + swordTimedOut ? swordWinEvents / (swordWinEvents + swordTimedOut) : null,
    swordUpgradeRateObserved: swordWinEvents ? (swordUpgraded / swordWinEvents) : null,
    lightningWinEvents,
    lightningInfiniteCount,
    lightningHighCount,
    lightningLowCount,
    lightningTimedOut,
    lightningContinuationRate:
      lightningWinEvents + lightningTimedOut ? lightningWinEvents / (lightningWinEvents + lightningTimedOut) : null,
  };
}

const SPINS = 2000000;

console.log('=== エヴァ 検証（' + SPINS.toLocaleString() + '回転） ===');
const evaResult = simulate('eva', SPINS);
const evaFirstHits = evaResult.firstHitTransition;
const evaFirstHitTotal = (evaFirstHits.st || 0) + (evaFirstHits.jitan || 0);
console.log('通常時大当り確率(実測): 1/' + evaResult.normalHitRate + ' (仕様: 1/399.9)');
console.log('全状態込み総合大当り確率(参考、実測): 1/' + evaResult.hitRate + ' ※ST等を含むため分母は小さくなる');
console.log('初当り ST直行率(実測): ' + ((evaFirstHits.st / evaFirstHitTotal) * 100).toFixed(2) + '% (仕様: 50.5%)');
console.log('  内訳 10R(1500個)(実測): ' + ((evaResult.stDirectBigCount / evaFirstHitTotal) * 100).toFixed(3) + '% (仕様: 0.5%)');
console.log('  内訳 2R(300個)(実測): ' + ((evaResult.stDirectSmallCount / evaFirstHitTotal) * 100).toFixed(2) + '% (仕様: 50%)');
console.log('初当り 時短行き率(実測): ' + ((evaFirstHits.jitan / evaFirstHitTotal) * 100).toFixed(2) + '% (仕様: 49.5%)');
console.log('時短からの引き戻し率(実測): ' + (evaResult.jitanPullbackRate * 100).toFixed(2) + '% (仕様目安: 約22%)');
const evaTotalStEntryRate = evaResult.stEntriesFromNormalOrJitan / evaFirstHitTotal;
console.log('トータルST突入率(実測、初当り基準): ' + (evaTotalStEntryRate * 100).toFixed(2) + '% (仕様: 約61.4%)');
console.log('ST継続率(実測): ' + (evaResult.stContinuationRate * 100).toFixed(2) + '% (仕様: 約80%)');
console.log('  ST中の当りの内訳 8R×4回(4800個)(実測): ' + ((evaResult.stContinuedBig / evaResult.stContinued) * 100).toFixed(3) + '% (仕様: 0.5%)');

console.log('\n=== SAO 検証（' + SPINS.toLocaleString() + '回転） ===');
const saoResult = simulate('sao', SPINS);
const saoFirstHits = saoResult.firstHitTransition;
const saoFirstHitTotal = (saoFirstHits.sword || 0) + (saoFirstHits.lightning || 0) + (saoFirstHits.normal || 0);
console.log('通常時大当り確率(実測): 1/' + saoResult.normalHitRate + ' (仕様: 1/199.9)');
console.log('全状態込み総合大当り確率(参考、実測): 1/' + saoResult.hitRate + ' ※RUSH中を含むため分母は小さくなる');
console.log('初当り SWORD RUSH率(実測): ' + ((saoFirstHits.sword / saoFirstHitTotal) * 100).toFixed(2) + '% (仕様: 69%)');
console.log('初当り LIGHTNING RUSH直行率(実測): ' + ((saoFirstHits.lightning / saoFirstHitTotal) * 100).toFixed(2) + '% (仕様: 1%)');
console.log('初当り 通常復帰率(実測): ' + ((saoFirstHits.normal / saoFirstHitTotal) * 100).toFixed(2) + '% (仕様: 30%)');
console.log('SWORD RUSH継続率(実測、RUSH状態の維持=同ティア継続+昇格): ' + (saoResult.swordContinuationRate * 100).toFixed(2) + '% (仕様: 約60%)');
console.log('SWORD RUSH中のLIGHTNING昇格率(実測、当り時のみ): ' + (saoResult.swordUpgradeRateObserved * 100).toFixed(2) + '% (仕様: 30%)');
console.log('  SWORD RUSH継続時の内訳 10R(1500個)(実測): ' + ((saoResult.swordStayHighCount / (saoResult.swordStayHighCount + saoResult.swordStayLowCount)) * 100).toFixed(2) + '% (仕様: 40/(40+30)=57.14%)');
console.log('LIGHTNING RUSH継続率(実測): ' + (saoResult.lightningContinuationRate * 100).toFixed(2) + '% (仕様目安: 約90%相当)');
console.log('  LIGHTNING RUSH中の内訳 無限ST/次回まで(実測): ' + ((saoResult.lightningInfiniteCount / saoResult.lightningWinEvents) * 100).toFixed(2) + '% (仕様: 22.5%)');
console.log('  LIGHTNING RUSH中の内訳 10R(1500個)・119回転(実測): ' + ((saoResult.lightningHighCount / saoResult.lightningWinEvents) * 100).toFixed(2) + '% (仕様: 47.5%)');
console.log('  LIGHTNING RUSH中の内訳 2R(300個)・119回転(実測): ' + ((saoResult.lightningLowCount / saoResult.lightningWinEvents) * 100).toFixed(2) + '% (仕様: 30%)');

console.log('\n完了。');
