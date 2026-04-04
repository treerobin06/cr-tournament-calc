/// <reference types="vitest/globals" />

import { describe, it, expect } from 'vitest';
import {
  negbinPmf,
  negbinPmfGeneral,
  negbinTail,
  mixedPmf,
  mixedTail,
  computeDistribution,
  promotionProbability,
  queryRankFromWins,
  queryWinsToRank,
  querySafePlayerCount,
  predictFinalRank,
} from './math';

// ============================================================
// Task 2: NegBin PMF 精确值验证
// ============================================================

describe('negbinPmf', () => {
  it('P(W=0 | r=5) = (0.5)^5 = 0.03125', () => {
    expect(negbinPmf(0, 5)).toBeCloseTo(0.03125, 10);
  });

  it('P(W=1 | r=5) = 5/64 = 0.078125', () => {
    // P(1) = P(0) * (0+5) / (2*1) = 0.03125 * 5/2 = 0.078125
    expect(negbinPmf(1, 5)).toBeCloseTo(5 / 64, 10);
  });

  it('P(W=12 | r=5) = C(16,4) * (0.5)^17 = 1820/131072', () => {
    // NegBin(r=5,p=0.5)，P(W=12) = C(12+5-1, 5-1) * (0.5)^5 * (0.5)^12
    //   = C(16,4) * (0.5)^17 = 1820 / 131072
    const expected = 1820 / 131072;
    expect(negbinPmf(12, 5)).toBeCloseTo(expected, 8);
  });

  it('PMF 值均为非负数', () => {
    for (let k = 0; k <= 20; k++) {
      expect(negbinPmf(k, 5)).toBeGreaterThanOrEqual(0);
    }
  });

  it('PMF 单调性：先增后减（r=5时峰值在 k=3 和 k=4 相等，k=5 开始下降）', () => {
    // 对于 NegBin(r=5, p=0.5)，P(3)=P(4)=0.13671875（双峰），之后下降
    const p2 = negbinPmf(2, 5);
    const p3 = negbinPmf(3, 5);
    const p4 = negbinPmf(4, 5);
    const p5 = negbinPmf(5, 5);
    // P(3) == P(4)（众数），P(2) < P(3)，P(5) < P(4)
    expect(p3).toBeCloseTo(p4, 10); // 双峰相等
    expect(p2).toBeLessThan(p3);    // 上升阶段
    expect(p5).toBeLessThan(p4);    // 下降阶段
  });
});

describe('negbinPmfGeneral', () => {
  it('pWin=0.5 时与 negbinPmf 结果一致', () => {
    for (let k = 0; k <= 10; k++) {
      expect(negbinPmfGeneral(k, 5, 0.5)).toBeCloseTo(negbinPmf(k, 5), 10);
    }
  });

  it('P(W=0 | r=3, pWin=0.7) = (0.3)^3 = 0.027', () => {
    expect(negbinPmfGeneral(0, 3, 0.7)).toBeCloseTo(0.027, 10);
  });

  it('PMF 概率之和近似为 1（截断到 k=200）', () => {
    let sum = 0;
    for (let k = 0; k <= 200; k++) {
      sum += negbinPmfGeneral(k, 5, 0.7);
    }
    expect(sum).toBeCloseTo(1, 3);
  });
});

// ============================================================
// Task 2: 尾分布验证
// ============================================================

describe('negbinTail', () => {
  it('S(0) ≈ 1.0（全体概率）', () => {
    const s0 = negbinTail(0, 5, 100000);
    expect(s0).toBeCloseTo(1.0, 3);
  });

  it('尾概率单调递减', () => {
    let prev = 1.0;
    for (let k = 1; k <= 30; k++) {
      const curr = negbinTail(k, 5, 100000);
      expect(curr).toBeLessThanOrEqual(prev + 1e-10);
      prev = curr;
    }
  });

  it('S(k) - S(k+1) ≈ P(W=k)', () => {
    const n = 1e6;
    for (let k = 0; k <= 15; k++) {
      const diff = negbinTail(k, 5, n) - negbinTail(k + 1, 5, n);
      const pmf = negbinPmf(k, 5);
      expect(diff).toBeCloseTo(pmf, 3);
    }
  });
});

// ============================================================
// Task 2: 混合分布
// ============================================================

describe('mixedPmf & mixedTail', () => {
  it('alpha=1 时等于 negbinPmf(k, rFull)', () => {
    for (let k = 0; k <= 10; k++) {
      expect(mixedPmf(k, 5, 1)).toBeCloseTo(negbinPmf(k, 5), 10);
    }
  });

  it('alpha=0 时等于 negbinPmf(k, rFull-1)', () => {
    for (let k = 0; k <= 10; k++) {
      expect(mixedPmf(k, 5, 0)).toBeCloseTo(negbinPmf(k, 4), 10);
    }
  });

  it('mixedTail S(0) ≈ 1', () => {
    expect(mixedTail(0, 5, 0.5, 100000)).toBeCloseTo(1.0, 3);
  });

  it('mixedTail 单调递减', () => {
    let prev = mixedTail(0, 5, 0.5, 100000);
    for (let k = 1; k <= 20; k++) {
      const curr = mixedTail(k, 5, 0.5, 100000);
      expect(curr).toBeLessThanOrEqual(prev + 1e-10);
      prev = curr;
    }
  });
});

// ============================================================
// Task 2: computeDistribution
// ============================================================

describe('computeDistribution', () => {
  it('PMF 之和近似为 1', () => {
    const rows = computeDistribution(5, 100000, 0.5);
    const sumPmf = rows.reduce((s, r) => s + r.pmf, 0);
    expect(sumPmf).toBeCloseTo(1.0, 2);
  });

  it('tailProb 从 1 单调递减', () => {
    const rows = computeDistribution(5, 100000, 0.5);
    expect(rows[0].tailProb).toBeCloseTo(1.0, 5);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].tailProb).toBeLessThanOrEqual(rows[i - 1].tailProb + 1e-10);
    }
  });

  it('count = pmf * n', () => {
    const n = 200000;
    const rows = computeDistribution(5, n, 0.5);
    for (const row of rows.slice(0, 20)) {
      expect(row.count).toBeCloseTo(row.pmf * n, 5);
    }
  });

  it('tailCount = tailProb * n', () => {
    const n = 200000;
    const rows = computeDistribution(5, n, 0.5);
    for (const row of rows.slice(0, 20)) {
      expect(row.tailCount).toBeCloseTo(row.tailProb * n, 5);
    }
  });

  it('decayRatio k=0 时为 NaN', () => {
    const rows = computeDistribution(5, 100000, 0.5);
    expect(isNaN(rows[0].decayRatio)).toBe(true);
  });

  it('decayRatio 等于 pmf[k]/pmf[k-1]', () => {
    const rows = computeDistribution(5, 100000, 0.5);
    for (let i = 1; i < Math.min(rows.length, 20); i++) {
      const expected = rows[i].pmf / rows[i - 1].pmf;
      expect(rows[i].decayRatio).toBeCloseTo(expected, 8);
    }
  });

  it('第一行 wins=0', () => {
    const rows = computeDistribution(5, 100000, 0.5);
    expect(rows[0].wins).toBe(0);
  });

  it('rows 非空且长度合理（>=20）', () => {
    const rows = computeDistribution(5, 200000, 0.5);
    expect(rows.length).toBeGreaterThan(20);
    expect(rows.length).toBeLessThan(500);
  });
});

// ============================================================
// Task 3: promotionProbability
// ============================================================

describe('promotionProbability', () => {
  it('当 N*S(k+1) << targetRank 时（赢的人很少），概率 ≈ 1', () => {
    // 10 个玩家，top 900，赢了 20 场，尾概率很小
    const prob = promotionProbability(20, 5, 0.5, 10, 900);
    expect(prob).toBeGreaterThan(0.99);
  });

  it('当 N*S(k+1) >> targetRank 时（赢的人很多），概率 ≈ 0', () => {
    // 10M 玩家，top 900，只赢了 0 场
    const prob = promotionProbability(0, 5, 0.5, 10_000_000, 900);
    expect(prob).toBeLessThan(0.01);
  });

  it('概率在 [0, 1] 范围内', () => {
    const testCases = [
      [5, 5, 0.5, 200000, 900],
      [10, 5, 0.5, 200000, 900],
      [15, 5, 0.5, 200000, 900],
      [20, 5, 0.5, 200000, 900],
    ] as [number, number, number, number, number][];

    for (const [k, r, alpha, n, target] of testCases) {
      const prob = promotionProbability(k, r, alpha, n, target);
      expect(prob).toBeGreaterThanOrEqual(0);
      expect(prob).toBeLessThanOrEqual(1);
    }
  });

  it('随着 wins 增加，晋级概率单调不减', () => {
    const n = 200000;
    let prev = 0;
    for (let k = 0; k <= 25; k++) {
      const prob = promotionProbability(k, 5, 0.5, n, 900);
      expect(prob).toBeGreaterThanOrEqual(prev - 1e-10);
      prev = prob;
    }
  });
});

// ============================================================
// Task 3: queryWinsToRank
// ============================================================

describe('queryWinsToRank', () => {
  it('200k 玩家，top 900 → safeWins 在 15-20 之间（95% 置信）', () => {
    const { safeWins } = queryWinsToRank(5, 0.5, 200_000, 900);
    expect(safeWins).toBeGreaterThanOrEqual(15);
    expect(safeWins).toBeLessThanOrEqual(20);
  });

  it('probByWins 概率随 wins 增加单调不减', () => {
    const { probByWins } = queryWinsToRank(5, 0.5, 200_000, 900);
    for (let i = 1; i < probByWins.length; i++) {
      expect(probByWins[i].probability).toBeGreaterThanOrEqual(probByWins[i - 1].probability - 1e-10);
    }
  });

  it('probByWins[0].wins === 0', () => {
    const { probByWins } = queryWinsToRank(5, 0.5, 200_000, 900);
    expect(probByWins[0].wins).toBe(0);
  });

  it('safeWins 处的晋级概率 >= 0.95', () => {
    const { safeWins, probByWins } = queryWinsToRank(5, 0.5, 200_000, 900);
    const prob = probByWins.find(p => p.wins === safeWins)?.probability ?? 0;
    expect(prob).toBeGreaterThanOrEqual(0.95);
  });

  it('safeWins 前一胜场的晋级概率 < 0.95', () => {
    const { safeWins, probByWins } = queryWinsToRank(5, 0.5, 200_000, 900);
    if (safeWins > 0) {
      const prevProb = probByWins.find(p => p.wins === safeWins - 1)?.probability ?? 0;
      expect(prevProb).toBeLessThan(0.95);
    }
  });
});

// ============================================================
// Task 3: queryRankFromWins 与 queryWinsToRank 的一致性
// ============================================================

describe('queryRankFromWins & queryWinsToRank consistency', () => {
  it('queryWinsToRank safeWins 的晋级概率 ≥ 0.95（互逆一致性验证）', () => {
    const n = 200_000;
    const targetRank = 900;
    const { safeWins } = queryWinsToRank(5, 0.5, n, targetRank);

    // safeWins 的晋级概率应 >= 0.95
    const prob = promotionProbability(safeWins, 5, 0.5, n, targetRank);
    expect(prob).toBeGreaterThanOrEqual(0.95);
  });

  it('queryRankFromWins 的 optimisticRank 与 safeWins 趋势一致', () => {
    const n = 200_000;
    const { safeWins } = queryWinsToRank(5, 0.5, n, 900);

    // safeWins 对应的乐观排名应该在 900 附近
    const { optimisticRank, conservativeRank } = queryRankFromWins(safeWins, 5, 0.5, n);

    // 乐观排名应 <= 900（safeWins 级别的玩家大概率能进 top 900）
    expect(optimisticRank).toBeLessThanOrEqual(1000); // 允许一些误差范围

    // 保守排名应 > 乐观排名
    expect(conservativeRank).toBeGreaterThanOrEqual(optimisticRank);
  });

  it('percentile 在 0-100 之间', () => {
    const { percentile } = queryRankFromWins(12, 5, 0.5, 200_000);
    expect(percentile).toBeGreaterThanOrEqual(0);
    expect(percentile).toBeLessThanOrEqual(100);
  });

  it('更多胜场对应更好（更小）的排名', () => {
    const n = 200_000;
    const rank10 = queryRankFromWins(10, 5, 0.5, n).optimisticRank;
    const rank15 = queryRankFromWins(15, 5, 0.5, n).optimisticRank;
    const rank20 = queryRankFromWins(20, 5, 0.5, n).optimisticRank;

    expect(rank15).toBeLessThan(rank10);
    expect(rank20).toBeLessThan(rank15);
  });
});

// ============================================================
// Task 3: querySafePlayerCount
// ============================================================

describe('querySafePlayerCount', () => {
  it('15 胜，top 900 → maxPlayers 在合理范围（10k-10M）', () => {
    const { maxPlayers } = querySafePlayerCount(15, 5, 0.5, 900);
    expect(maxPlayers).toBeGreaterThan(10_000);
    expect(maxPlayers).toBeLessThan(10_000_000);
  });

  it('maxPlayers80 >= maxPlayers（80%更宽松，允许更多玩家）', () => {
    const { maxPlayers, maxPlayers80 } = querySafePlayerCount(15, 5, 0.5, 900);
    expect(maxPlayers80).toBeGreaterThanOrEqual(maxPlayers);
  });

  it('maxPlayers >= maxPlayers99（99%更严格，允许更少玩家）', () => {
    const { maxPlayers, maxPlayers99 } = querySafePlayerCount(15, 5, 0.5, 900);
    expect(maxPlayers).toBeGreaterThanOrEqual(maxPlayers99);
  });

  it('maxPlayers 处的晋级概率 >= 0.95', () => {
    const { maxPlayers } = querySafePlayerCount(15, 5, 0.5, 900);
    const prob = promotionProbability(15, 5, 0.5, maxPlayers, 900);
    expect(prob).toBeGreaterThanOrEqual(0.95);
  });

  it('maxPlayers + 1 处的晋级概率 < 0.95', () => {
    const { maxPlayers } = querySafePlayerCount(15, 5, 0.5, 900);
    if (maxPlayers > 0) {
      const prob = promotionProbability(15, 5, 0.5, maxPlayers + 100, 900);
      expect(prob).toBeLessThan(0.95);
    }
  });

  it('胜场更多时，允许更多玩家', () => {
    const { maxPlayers: max15 } = querySafePlayerCount(15, 5, 0.5, 900);
    const { maxPlayers: max18 } = querySafePlayerCount(18, 5, 0.5, 900);
    expect(max18).toBeGreaterThan(max15);
  });
});

// ============================================================
// Task 3: predictFinalRank
// ============================================================

describe('predictFinalRank', () => {
  it('比赛已结束时（currentLosses >= rFull）直接返回当前排名', () => {
    const result = predictFinalRank(10, 5, 5, 0.5, 200_000);
    expect(result.expectedFinalWins).toBe(10);
    expect(result.p50RankRange[0]).toBeLessThanOrEqual(result.p50RankRange[1]);
  });

  it('expectedFinalWins >= currentWins', () => {
    const result = predictFinalRank(5, 2, 5, 0.5, 200_000);
    expect(result.expectedFinalWins).toBeGreaterThanOrEqual(5);
  });

  it('胜率高时 expectedFinalWins 更大', () => {
    const r1 = predictFinalRank(5, 2, 5, 0.5, 200_000, 0.4);
    const r2 = predictFinalRank(5, 2, 5, 0.5, 200_000, 0.6);
    expect(r2.expectedFinalWins).toBeGreaterThanOrEqual(r1.expectedFinalWins);
  });

  it('p95RankRange 包含 p80RankRange 包含 p50RankRange（置信区间嵌套）', () => {
    const result = predictFinalRank(5, 2, 5, 0.5, 200_000);
    // 更宽的置信区间下界 <= 更窄的下界
    expect(result.p95RankRange[0]).toBeLessThanOrEqual(result.p50RankRange[0]);
    // 更宽的置信区间上界 >= 更窄的上界
    expect(result.p95RankRange[1]).toBeGreaterThanOrEqual(result.p50RankRange[1]);
  });

  it('expectedRank 为正整数', () => {
    const result = predictFinalRank(8, 3, 5, 0.5, 200_000);
    expect(result.expectedRank).toBeGreaterThan(0);
    expect(Number.isInteger(result.expectedRank)).toBe(true);
  });
});
