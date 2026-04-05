/**
 * 数学引擎：NegBin 分布 + Binomial 晋级概率 + 四种查询模式
 *
 * 背景：皇室战争 Global Tournament 中，玩家胜场数 W ~ NegBin(r, 0.5)
 * r = rFull（整数）或 rFull-1（混合用于半整数等效）
 * alpha 控制 rFull 和 rFull-1 之间的插值
 */

// ============================================================
// 基础类型
// ============================================================

export interface DistributionRow {
  wins: number;       // 胜场数 k
  pmf: number;        // 概率质量 P(W=k)
  count: number;      // 预期人数 = pmf * n
  tailProb: number;   // 尾概率 P(W >= k)
  tailCount: number;  // 尾人数 = tailProb * n
  decayRatio: number; // P(k) / P(k-1)，k=0 时为 NaN
}

// ============================================================
// Task 2: NegBin 分布
// ============================================================

/**
 * NegBin(r, 0.5) PMF — 用递推公式计算
 * P(0) = (0.5)^r
 * P(k+1) = P(k) * (k+r) / (2*(k+1))
 */
export function negbinPmf(k: number, r: number): number {
  let p = Math.pow(0.5, r); // P(0)
  for (let i = 0; i < k; i++) {
    p = p * (i + r) / (2 * (i + 1));
  }
  return p;
}

/**
 * NegBin(r, pWin) PMF — 任意胜率版本（用于 predictFinalRank）
 * pLose = 1 - pWin
 * P(0) = pLose^r
 * P(k+1) = P(k) * pWin * (k+r) / (k+1)
 *
 * 注意：这里 r 是负二项分布的"失败次数"参数，
 * pWin 是每局胜的概率。W 表示在达到 r 次失败前的胜局数。
 */
export function negbinPmfGeneral(k: number, r: number, pWin: number): number {
  const pLose = 1 - pWin;
  let p = Math.pow(pLose, r); // P(0)
  for (let i = 0; i < k; i++) {
    p = p * pWin * (i + r) / (i + 1);
  }
  return p;
}

/**
 * NegBin(r, 0.5) 尾分布 S(k) = P(W >= k) = sum_{j=k}^{inf} P(W=j)
 * 当剩余质量 < 0.1/n 时停止（精度控制）
 */
export function negbinTail(k: number, r: number, n: number): number {
  const threshold = 0.1 / n;
  let tail = 0;

  // 先从 j=0 算到 k-1 的 PMF 累加，得到 P(W < k)
  // 然后 S(k) = 1 - P(W < k)
  // 但为精度，直接从 k 往后累加更稳
  // 先算 P(W=k) 作为起点
  let pmfK = negbinPmf(k, r);

  // 从 k 开始向后累加
  let j = k;
  let pmfJ = pmfK;
  while (pmfJ >= threshold) {
    tail += pmfJ;
    j++;
    // 用递推：P(j+1) = P(j) * (j+r) / (2*(j+1))
    pmfJ = pmfJ * (j - 1 + r) / (2 * j);
  }
  // 加上剩余的小尾巴（避免截断误差，直接加最后一项近似 sum of geometric tail）
  // 剩余 = pmfJ * 1 / (1 - (j+r)/(2*(j+1))) ，但当 r 固定时这可能发散
  // 保守做法：直接加上当前 pmfJ（已经很小了）
  tail += pmfJ;

  return tail;
}

/**
 * 混合 PMF：alpha * NegBin(rFull, 0.5) + (1-alpha) * NegBin(rFull-1, 0.5)
 */
export function mixedPmf(k: number, rFull: number, alpha: number): number {
  return alpha * negbinPmf(k, rFull) + (1 - alpha) * negbinPmf(k, rFull - 1);
}

/**
 * 混合尾分布
 */
export function mixedTail(k: number, rFull: number, alpha: number, n: number): number {
  return alpha * negbinTail(k, rFull, n) + (1 - alpha) * negbinTail(k, rFull - 1, n);
}

/**
 * 作弊/送分修正：部分玩家通过小号送分获得额外胜场
 * cheaterRatio: 作弊玩家占比（如 0.005 = 0.5%）
 * cheaterBoost: 作弊者额外获得的胜场数（如 8 = 平均多赢 8 场）
 *
 * 建模方式：作弊者的胜场 = 正常 NegBin 胜场 + cheaterBoost
 * 最终分布 = (1-cheaterRatio) × 正常分布 + cheaterRatio × 右移分布
 */

/**
 * 计算完整分布表
 * 返回 wins=0,1,2,... 直到尾概率足够小时停止
 * cheaterRatio/cheaterBoost: 送分修正参数（可选）
 */
export function computeDistribution(
  rFull: number, n: number, alpha: number,
  cheaterRatio: number = 0, cheaterBoost: number = 8,
): DistributionRow[] {
  const threshold = 0.001 / n; // 停止条件：pmf 很小

  // 先计算正常分布的 PMF 数组
  const normalPmfs: number[] = [];
  let pmfFull = Math.pow(0.5, rFull);
  let pmfLower = Math.pow(0.5, rFull - 1);

  for (let k = 0; ; k++) {
    const pmf = alpha * pmfFull + (1 - alpha) * pmfLower;
    normalPmfs.push(pmf);
    if (k > 0 && pmf < threshold) break;
    if (k > 500) break;
    pmfFull = pmfFull * (k + rFull) / (2 * (k + 1));
    pmfLower = pmfLower * (k + rFull - 1) / (2 * (k + 1));
  }

  // 合并正常分布和作弊者分布
  // 作弊者的胜场 = 正常胜场 + cheaterBoost（右移）
  const maxK = cheaterRatio > 0
    ? normalPmfs.length + cheaterBoost + 10
    : normalPmfs.length;
  const mergedPmfs: number[] = new Array(maxK).fill(0);

  for (let k = 0; k < normalPmfs.length; k++) {
    // 正常玩家贡献
    mergedPmfs[k] += (1 - cheaterRatio) * normalPmfs[k];
    // 作弊者贡献（右移 cheaterBoost）
    if (cheaterRatio > 0 && k + cheaterBoost < maxK) {
      mergedPmfs[k + cheaterBoost] += cheaterRatio * normalPmfs[k];
    }
  }

  // 构建分布表
  const rows: DistributionRow[] = [];
  let tailProb = 1.0;

  for (let k = 0; k < maxK; k++) {
    const pmf = mergedPmfs[k];
    if (k > 0 && pmf < threshold && cheaterRatio === 0) break;
    if (k > 0 && pmf < threshold / 10 && cheaterRatio > 0) break;

    rows.push({
      wins: k,
      pmf,
      count: pmf * n,
      tailProb,
      tailCount: tailProb * n,
      decayRatio: k === 0 ? NaN : pmf / (rows[k - 1]?.pmf || 1),
    });

    tailProb = tailProb - pmf;
    if (tailProb < 0) tailProb = 0;
  }

  return rows;
}

// ============================================================
// Task 3: Binomial 晋级概率 + 四种查询
// ============================================================

/**
 * 正态分布 CDF（标准正态，用误差函数近似）
 */
function normalCdf(x: number): number {
  // 使用 Abramowitz and Stegun 公式 7.1.26 近似
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const poly = t * (0.319381530
    + t * (-0.356563782
      + t * (1.781477937
        + t * (-1.821255978
          + t * 1.330274429))));
  const phi = Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  const cdf = 1 - phi * poly;
  return x >= 0 ? cdf : 1 - cdf;
}

/**
 * Binomial CDF 的正态近似（带连续性修正）
 * P(X <= m) where X ~ Binomial(N, p)
 * 连续性修正：P(X <= m) ≈ Phi((m + 0.5 - N*p) / sqrt(N*p*(1-p)))
 */
function binomialCdfNormal(m: number, N: number, p: number): number {
  if (N <= 0) return 1;
  if (p <= 0) return 1;
  if (p >= 1) return m >= N ? 1 : 0;

  const mu = N * p;
  const sigma = Math.sqrt(N * p * (1 - p));

  if (sigma < 1e-10) {
    // 方差极小时，直接精确判断
    return mu <= m + 0.5 ? 1 : 0;
  }

  const z = (m + 0.5 - mu) / sigma;
  return normalCdf(z);
}

/**
 * 晋级概率：P(X_k <= targetRank - 1) where X_k ~ Binomial(N, S_mixed(k))
 *
 * 含义：有 N 个玩家，每人达到 k 胜或以上的概率是 S_mixed(k)，
 * 求"比 k 胜者排名更靠前的人数 <= targetRank-1"的概率，
 * 即 k 胜玩家能晋级 targetRank 名以内的概率。
 */
export function promotionProbability(
  k: number,
  rFull: number,
  alpha: number,
  n: number,
  targetRank: number
): number {
  // S_mixed(k+1) 是比 k 胜排名更靠前的人（赢了超过 k 场）的比例
  // 即 P(W > k) = S_mixed(k+1)
  const pAbove = mixedTail(k + 1, rFull, alpha, n);

  // X_k = 排在 k 胜之前的人数 ~ Binomial(N, pAbove)
  // 晋级条件：X_k <= targetRank - 1
  return binomialCdfNormal(targetRank - 1, n, pAbove);
}

/**
 * 查询模式一：给定胜场数，查询期望排名
 * @returns { conservativeRank, optimisticRank, percentile }
 */
export function queryRankFromWins(
  wins: number,
  rFull: number,
  alpha: number,
  n: number
): { conservativeRank: number; optimisticRank: number; percentile: number } {
  // 比 wins 胜更靠前的人数期望 = n * P(W > wins)
  const pAbove = mixedTail(wins + 1, rFull, alpha, n);
  const expectedAbove = n * pAbove;

  // 乐观排名：期望超过你的人数（取整）+ 1
  const optimisticRank = Math.floor(expectedAbove) + 1;

  // 保守排名：95th percentile of Binomial(n, pAbove)
  // 即有 95% 概率排在这个名次以内
  // 用正态近似：mu + 1.645 * sigma + 0.5（连续性修正）
  const mu = n * pAbove;
  const sigma = Math.sqrt(n * pAbove * (1 - pAbove));
  const conservativeRank = Math.ceil(mu + 1.645 * sigma + 0.5) + 1;

  // 百分位：你超过了多少比例的玩家
  const pBelow = 1 - mixedTail(wins, rFull, alpha, n);
  const percentile = pBelow * 100;

  return { conservativeRank, optimisticRank, percentile };
}

/**
 * 查询模式二：给定目标排名，查询需要多少胜场
 * @param confidence 置信度，默认 0.95
 * @returns { safeWins, probByWins }
 */
export function queryWinsToRank(
  rFull: number,
  alpha: number,
  n: number,
  targetRank: number,
  confidence: number = 0.95
): { safeWins: number; probByWins: Array<{ wins: number; probability: number }> } {
  const probByWins: Array<{ wins: number; probability: number }> = [];
  let safeWins = 0;

  for (let k = 0; k <= 200; k++) {
    const prob = promotionProbability(k, rFull, alpha, n, targetRank);
    probByWins.push({ wins: k, probability: prob });

    if (prob >= confidence && safeWins === 0) {
      safeWins = k;
    }

    // 一旦概率超过 confidence 就不会再下降太多，可以适当截断
    if (k > 50 && prob > 0.9999) break;
  }

  return { safeWins, probByWins };
}

/**
 * 查询模式三：给定胜场数和目标排名，二分搜索最大玩家数
 * @param confidence 置信度，默认 0.95
 * @returns { maxPlayers, maxPlayers80, maxPlayers99 }
 */
export function querySafePlayerCount(
  wins: number,
  rFull: number,
  alpha: number,
  targetRank: number,
  confidence: number = 0.95
): { maxPlayers: number; maxPlayers80: number; maxPlayers99: number } {
  // 对给定胜场数 wins 和目标排名 targetRank，
  // 找最大的 N 使得 promotionProbability(wins, rFull, alpha, N, targetRank) >= confidence

  function findMaxN(conf: number): number {
    // 先检查 N=1 是否满足
    if (promotionProbability(wins, rFull, alpha, 1, targetRank) < conf) return 0;

    // 指数增长找上界
    let lo = 1;
    let hi = 1;
    while (promotionProbability(wins, rFull, alpha, hi, targetRank) >= conf) {
      hi *= 2;
      if (hi > 1e9) return Math.floor(hi / 2); // 防止无限循环
    }

    // 二分搜索
    while (lo < hi - 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (promotionProbability(wins, rFull, alpha, mid, targetRank) >= conf) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    return lo;
  }

  return {
    maxPlayers: findMaxN(confidence),
    maxPlayers80: findMaxN(0.80),
    maxPlayers99: findMaxN(0.99),
  };
}

/**
 * 查询模式四：预测最终排名
 * 给定当前 wins/losses，预测比赛结束后的排名分布
 *
 * @param currentWins 当前胜场
 * @param currentLosses 当前败场（游戏结束条件：达到 rFull 次失败）
 * @param rFull 最大失败次数
 * @param alpha 混合参数
 * @param n 总玩家数
 * @param personalWinRate 个人胜率（默认 0.5）
 */
export function predictFinalRank(
  currentWins: number,
  currentLosses: number,
  rFull: number,
  alpha: number,
  n: number,
  personalWinRate: number = 0.5
): {
  expectedRank: number;
  p50RankRange: [number, number];
  p80RankRange: [number, number];
  p95RankRange: [number, number];
  expectedFinalWins: number;
} {
  // 还需要的失败次数
  const remainingLosses = rFull - currentLosses;

  if (remainingLosses <= 0) {
    // 比赛已结束，直接用当前胜场查排名
    const { optimisticRank, conservativeRank } = queryRankFromWins(currentWins, rFull, alpha, n);
    return {
      expectedRank: Math.round((optimisticRank + conservativeRank) / 2),
      p50RankRange: [optimisticRank, conservativeRank],
      p80RankRange: [optimisticRank, conservativeRank],
      p95RankRange: [optimisticRank, conservativeRank],
      expectedFinalWins: currentWins,
    };
  }

  // 剩余比赛中额外获胜次数 E ~ NegBin(remainingLosses, personalWinRate)
  // 最终胜场 = currentWins + E
  // 计算最终胜场的分布（使用 negbinPmfGeneral）

  // 收集最终胜场的概率分布
  type WinProb = { finalWins: number; prob: number };
  const finalWinsDist: WinProb[] = [];
  const stopThreshold = 1e-6;

  let expectedFinalWins = 0;
  let totalProb = 0;

  for (let e = 0; e <= 300; e++) {
    const prob = negbinPmfGeneral(e, remainingLosses, personalWinRate);
    if (e > 10 && prob < stopThreshold) break;
    const fw = currentWins + e;
    finalWinsDist.push({ finalWins: fw, prob });
    expectedFinalWins += fw * prob;
    totalProb += prob;
  }

  // 归一化（处理截断误差）
  if (totalProb > 0) {
    for (const w of finalWinsDist) w.prob /= totalProb;
    expectedFinalWins /= totalProb;
  }

  // 对每种最终胜场，计算对应排名
  // 用期望排名近似：E[rank] = sum P(finalWins=fw) * expectedRank(fw)
  // 以及排名的分位数

  // 计算每个 finalWins 对应的乐观排名
  const rankProbs: Array<{ rank: number; prob: number }> = finalWinsDist.map(({ finalWins, prob }) => {
    const pAbove = mixedTail(finalWins + 1, rFull, alpha, n);
    const mu = n * pAbove;
    // 用期望排名（乐观）：期望超过你的人数 + 1
    const rank = Math.floor(mu) + 1;
    return { rank, prob };
  });

  // 计算期望排名
  let expectedRank = 0;
  for (const { rank, prob } of rankProbs) {
    expectedRank += rank * prob;
  }

  // 按排名升序排序，计算累计概率分位数
  // 注意排名越小越好，p50 表示 50% 的情况排名 <= 某值
  rankProbs.sort((a, b) => a.rank - b.rank);

  let cumProb = 0;
  let p50Low = rankProbs[0]?.rank ?? 1;
  let p50High = rankProbs[rankProbs.length - 1]?.rank ?? 1;
  let p80Low = p50Low;
  let p80High = p50High;
  let p95Low = p50Low;
  let p95High = p50High;

  let found50 = false, found80 = false, found95 = false;

  // 从好排名（小）到坏排名（大）累计
  for (const { rank, prob } of rankProbs) {
    const prevCum = cumProb;
    cumProb += prob;

    if (!found50 && cumProb >= 0.25) { p50Low = rank; found50 = true; }
    if (cumProb >= 0.75) { p50High = rank; }
    if (!found80 && cumProb >= 0.10) { p80Low = rank; found80 = true; }
    if (cumProb >= 0.90) { p80High = rank; }
    if (!found95 && cumProb >= 0.025) { p95Low = rank; found95 = true; }
    if (cumProb >= 0.975) { p95High = rank; }

    void prevCum; // 消除未使用变量警告
  }

  return {
    expectedRank: Math.round(expectedRank),
    p50RankRange: [p50Low, p50High],
    p80RankRange: [p80Low, p80High],
    p95RankRange: [p95Low, p95High],
    expectedFinalWins: Math.round(expectedFinalWins),
  };
}
