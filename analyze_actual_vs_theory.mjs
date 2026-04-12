/**
 * 皇室战争锦标赛：实际数据 vs 理论模型 深度对比分析
 * 
 * 数据来源：一次实际锦标赛结果（404 人报名）
 * 理论模型：NegBin(5, 0.5) 混合分布
 */

import { readFileSync } from 'fs';

// ============================================================
// 1. 读取实际数据
// ============================================================
const csv = readFileSync('./tournament_actual_data.csv', 'utf-8');
const rows = csv.trim().split('\n').slice(1).map(line => {
  const [rank, wins, losses] = line.split(',').map(Number);
  return { rank, wins, losses };
});

const totalPlayers = rows.length;
console.log(`\n${'═'.repeat(60)}`);
console.log(`  实际数据总览`);
console.log(`${'═'.repeat(60)}`);
console.log(`总报名人数: ${totalPlayers}`);

// 统计胜场分布
const winsDist = {};
const lossesDist = {};
for (const r of rows) {
  winsDist[r.wins] = (winsDist[r.wins] || 0) + 1;
  lossesDist[r.losses] = (lossesDist[r.losses] || 0) + 1;
}

// 计算关键指标
const activePlayers = rows.filter(r => r.wins > 0 || r.losses > 0).length;
const playedAtLeastOne = rows.filter(r => r.wins + r.losses > 0).length;
const playedFull = rows.filter(r => r.losses === 5).length;
const didntPlay = rows.filter(r => r.wins === 0 && r.losses === 0).length;

console.log(`实际打了至少1场: ${playedAtLeastOne} 人`);
console.log(`完全没打(0胜0负): ${didntPlay} 人`);
console.log(`打满5命(5负): ${playedFull} 人`);
console.log(`提前退出(<5负): ${playedAtLeastOne - playedFull} 人`);

// ============================================================
// 2. 实际胜场分布
// ============================================================
console.log(`\n${'═'.repeat(60)}`);
console.log(`  实际胜场分布`);
console.log(`${'═'.repeat(60)}`);
console.log(`${'胜场'.padEnd(6)} | ${'人数'.padStart(4)} | ${'占比'.padStart(6)} | ${'累计≥k'.padStart(6)} | 分布图`);
console.log(`${'─'.repeat(55)}`);

const maxWins = Math.max(...Object.keys(winsDist).map(Number));
let cumulative = totalPlayers;
const actualTail = {}; // 记录实际尾分布

for (let k = 0; k <= maxWins; k++) {
  const count = winsDist[k] || 0;
  const pct = (count / totalPlayers * 100).toFixed(1);
  actualTail[k] = cumulative;
  const bar = '█'.repeat(Math.round(count / 2));
  console.log(`${String(k).padStart(4)}胜 | ${String(count).padStart(4)} | ${pct.padStart(5)}% | ${String(cumulative).padStart(6)} | ${bar}`);
  cumulative -= count;
}

// ============================================================
// 3. 败场（命数使用）分布
// ============================================================
console.log(`\n${'═'.repeat(60)}`);
console.log(`  败场分布（命数使用情况）`);
console.log(`${'═'.repeat(60)}`);
for (let l = 0; l <= 5; l++) {
  const count = lossesDist[l] || 0;
  const pct = (count / totalPlayers * 100).toFixed(1);
  console.log(`  ${l}负: ${String(count).padStart(4)} 人 (${pct}%) ${'█'.repeat(Math.round(count / 3))}`);
}

// ============================================================
// 4. NegBin 理论计算
// ============================================================
function negbinPmf(k, r) {
  let p = Math.pow(0.5, r);
  for (let i = 0; i < k; i++) p = p * (i + r) / (2 * (i + 1));
  return p;
}

function negbinTail(k, r, n) {
  const threshold = 0.01 / n;
  let pmfK = negbinPmf(k, r);
  let j = k, pmfJ = pmfK, tail = 0;
  while (pmfJ >= threshold) { tail += pmfJ; j++; pmfJ = pmfJ * (j - 1 + r) / (2 * j); }
  tail += pmfJ;
  return tail;
}

function mixedTail(k, rFull, alpha, n) {
  return alpha * negbinTail(k, rFull, n) + (1 - alpha) * negbinTail(k, rFull - 1, n);
}

function mixedPmf(k, rFull, alpha) {
  return alpha * negbinPmf(k, rFull) + (1 - alpha) * negbinPmf(k, rFull - 1);
}

// ============================================================
// 5. 理论 vs 实际对比
// ============================================================
console.log(`\n${'═'.repeat(60)}`);
console.log(`  理论 vs 实际：逐胜场对比`);
console.log(`${'═'.repeat(60)}`);

const rFull = 5;
const n = totalPlayers;

// 场景A: 全部 404 人，alpha=0.9
// 场景B: 只算活跃玩家（排除 0胜0负）
const nActive = playedAtLeastOne;

// 计算满局率 alpha（打满5命的比例，在活跃玩家中）
const alphaActual = playedFull / nActive;
console.log(`\n  实际满局率 α = ${playedFull}/${nActive} = ${(alphaActual*100).toFixed(1)}%`);

console.log(`\n${'胜场'.padEnd(6)} | ${'实际人数'.padStart(8)} | ${'理论A(404人)'.padStart(12)} | ${'理论B(${nActive}活跃)'.padStart(14)} | ${'实际/理论B'.padStart(10)}`);
console.log(`${'─'.repeat(65)}`);

for (let k = 0; k <= maxWins; k++) {
  const actual = winsDist[k] || 0;
  
  // 理论A: 所有人50%胜率，alpha=0.9
  const theoryA = mixedPmf(k, rFull, 0.9) * n;
  
  // 理论B: 只算活跃玩家，用实际 alpha
  const theoryB = mixedPmf(k, rFull, alphaActual) * nActive;
  // 加上挂机玩家（都在0胜）
  const theoryBAdj = k === 0 ? theoryB + didntPlay : theoryB;
  
  const ratio = theoryBAdj > 0.1 ? (actual / theoryBAdj).toFixed(2) : '-';
  console.log(`${String(k).padStart(4)}胜 | ${String(actual).padStart(8)} | ${theoryA.toFixed(1).padStart(12)} | ${theoryBAdj.toFixed(1).padStart(14)} | ${ratio.toString().padStart(10)}`);
}

// ============================================================
// 6. 尾分布对比（≥k 胜的人数）
// ============================================================
console.log(`\n${'═'.repeat(60)}`);
console.log(`  尾分布对比：≥k 胜的人数`);
console.log(`${'═'.repeat(60)}`);
console.log(`${'胜场'.padEnd(6)} | ${'实际≥k'.padStart(7)} | ${'理论(404,α=0.9)'.padStart(16)} | ${'理论(${nActive},实际α)'.padStart(16)} | ${'偏差倍数'.padStart(8)}`);
console.log(`${'─'.repeat(65)}`);

for (let k = 1; k <= maxWins; k++) {
  const actualGe = actualTail[k] || 0;
  const theoryGe404 = mixedTail(k, rFull, 0.9, n) * n;
  const theoryGeActive = mixedTail(k, rFull, alphaActual, nActive) * nActive;
  const ratio = theoryGeActive > 0.1 ? (actualGe / theoryGeActive).toFixed(2) : '-';
  
  const marker = k >= 10 ? ' ←关键区间' : '';
  console.log(`  ≥${String(k).padStart(2)}胜 | ${String(actualGe).padStart(7)} | ${theoryGe404.toFixed(1).padStart(16)} | ${theoryGeActive.toFixed(1).padStart(16)} | ${ratio.toString().padStart(8)}${marker}`);
}

// ============================================================
// 7. 定量分析偏差
// ============================================================
console.log(`\n${'═'.repeat(60)}`);
console.log(`  偏差分析总结`);
console.log(`${'═'.repeat(60)}`);

// 计算实际的"前16名门槛"
const top16Wins = rows[15].wins;
console.log(`\n  【实际前16名门槛】: ${top16Wins} 胜`);

// 理论预测
const theoryThreshold404 = (() => {
  for (let k = 20; k >= 0; k--) {
    if (mixedTail(k, rFull, 0.9, 404) * 404 >= 16) return k;
  }
  return 0;
})();
const theoryThresholdActive = (() => {
  for (let k = 20; k >= 0; k--) {
    if (mixedTail(k, rFull, alphaActual, nActive) * nActive >= 16) return k;
  }
  return 0;
})();

console.log(`  【理论预测(404人,α=0.9)】: ${theoryThreshold404} 胜`);
console.log(`  【理论预测(${nActive}活跃,α=${alphaActual.toFixed(2)})】: ${theoryThresholdActive} 胜`);
console.log(`  【偏差】: 实际比理论高 ${top16Wins - theoryThreshold404} 胜`);

// 高胜场区膨胀分析
console.log(`\n  【高胜场区膨胀】:`);
for (let k = 10; k <= 19; k++) {
  const actual = actualTail[k] || 0;
  const theory = mixedTail(k, rFull, alphaActual, nActive) * nActive;
  if (theory < 0.1) continue;
  const inflation = actual / theory;
  const bar = inflation > 1 ? '▲'.repeat(Math.min(Math.round((inflation - 1) * 5), 20)) : '▼'.repeat(Math.min(Math.round((1 - inflation) * 5), 10));
  console.log(`    ≥${k}胜: 实际${actual}人 vs 理论${theory.toFixed(1)}人 = ${inflation.toFixed(1)}x ${bar}`);
}

// 提前退出分析
console.log(`\n  【提前退出分析】:`);
const earlyQuitByWins = {};
for (const r of rows) {
  if (r.losses < 5 && (r.wins > 0 || r.losses > 0)) {
    const key = r.wins;
    earlyQuitByWins[key] = (earlyQuitByWins[key] || 0) + 1;
  }
}
console.log(`    打满5命的人数: ${playedFull} (${(playedFull/playedAtLeastOne*100).toFixed(1)}%)`);
console.log(`    提前退出的人数: ${playedAtLeastOne - playedFull} (${((playedAtLeastOne - playedFull)/playedAtLeastOne*100).toFixed(1)}%)`);
console.log(`    完全没打的人数: ${didntPlay} (${(didntPlay/totalPlayers*100).toFixed(1)}%)`);

// 注意：部分提前退出的可能是高胜场的玩家
console.log(`\n    各胜场段的提前退出人数:`);
for (let k = maxWins; k >= 0; k--) {
  const eq = earlyQuitByWins[k] || 0;
  const total = winsDist[k] || 0;
  if (total === 0) continue;
  if (eq > 0) {
    console.log(`      ${k}胜: ${eq}/${total} 人提前退出 (${(eq/total*100).toFixed(0)}%)`);
  }
}

console.log(`\n${'═'.repeat(60)}`);
console.log(`  根本原因分析`);
console.log(`${'═'.repeat(60)}`);
console.log(`
  1. 【胜率异质性 — 最大偏差源】
     理论假设所有人 50% 胜率，但实际：
     - 强者(top20%) 胜率 ≈ 55-65%，能系统性地多赢
     - NegBin(5, 0.6) 均值=7.5胜，vs NegBin(5, 0.5) 均值=5胜
     - 实际≥13胜有 ${actualTail[13]} 人，理论只有 ${(mixedTail(13, rFull, alphaActual, nActive) * nActive).toFixed(1)} 人
     → 高胜场区膨胀 ${(actualTail[13] / (mixedTail(13, rFull, alphaActual, nActive) * nActive)).toFixed(1)}x

  2. 【有效参赛人数】
     报名 ${totalPlayers} 人，完全没打 ${didntPlay} 人 (${(didntPlay/totalPlayers*100).toFixed(0)}%)
     有效竞争者仅 ${nActive} 人
     → 这本该降低门槛，但被胜率异质性反超

  3. 【送分/买分】
     无法从数据直接量化，但高胜场区的膨胀程度
     可能部分来自组队送分（小号给大号喂胜场）

  4. 【满局率】
     实际满局率 ${(alphaActual*100).toFixed(1)}%（在活跃玩家中）
     ${playedAtLeastOne - playedFull} 人没打满就退出

  综合效应：
  理论前16门槛 = ${theoryThreshold404} 胜 → 实际 = ${top16Wins} 胜
  偏差 ${top16Wins - theoryThreshold404} 胜，主要由胜率异质性驱动
`);

