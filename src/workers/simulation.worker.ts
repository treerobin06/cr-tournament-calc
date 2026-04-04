/**
 * 蒙特卡罗锦标赛模拟 Web Worker
 * 使用 xorshift128 PRNG、TypedArray 提升性能
 * 配对规则：胜场差 ≤ 1 才能配对（同场竞技原则）
 * 支持多次模拟运行并汇总统计
 */

// ---- xorshift128 PRNG ----
class XorShift128 {
  private x: number
  private y: number
  private z: number
  private w: number

  constructor(seed: number) {
    // 用 seed 初始化四个状态（确保非零）
    this.x = seed >>> 0 || 123456789
    this.y = (seed * 1664525 + 1013904223) >>> 0 || 362436069
    this.z = (seed * 22695477 + 1) >>> 0 || 521288629
    this.w = (seed ^ (seed >>> 16)) >>> 0 || 88675123
  }

  /** 返回 [0, 1) 均匀随机数 */
  next(): number {
    const t = (this.x ^ (this.x << 11)) >>> 0
    this.x = this.y
    this.y = this.z
    this.z = this.w
    this.w = (this.w ^ (this.w >>> 19) ^ (t ^ (t >>> 8))) >>> 0
    return this.w / 0x100000000
  }

  /** Box-Muller 生成标准正态 N(0,1) */
  nextNormal(): number {
    let u: number, v: number, s: number
    do {
      u = this.next() * 2 - 1
      v = this.next() * 2 - 1
      s = u * u + v * v
    } while (s >= 1 || s === 0)
    return u * Math.sqrt(-2 * Math.log(s) / s)
  }
}

// ---- 消息类型 ----
export interface SimConfig {
  playerCount: number
  lives: number
  fullPlayRatio: number
  kappa: number
  seed: number
  runs: number    // 模拟次数（1~50，默认 1）
}

export interface SimResult {
  // 运行统计
  runs: number
  elapsed: number             // 总耗时（毫秒）
  // 汇总统计
  avgWinDistribution: number[]   // 各胜场的平均玩家数
  avgTopPlayerWins: number[]     // 前 min(1000, N) 名的平均胜场
  minTopPlayerWins: number[]     // 前 min(1000, N) 名的最小胜场（跨 run）
  maxTopPlayerWins: number[]     // 前 min(1000, N) 名的最大胜场（跨 run）
  // 冠军统计
  championWins: { avg: number; min: number; max: number }
  // 目标排名统计
  targetRankWins: { avg: number; min: number; max: number }
}

// ---- 单次模拟返回的原始数据 ----
interface SingleRunResult {
  winDistribution: number[]
  topPlayerWins: number[]
}

// ---- 单次模拟逻辑 ----
function runSingleSimulation(config: SimConfig, seed: number): SingleRunResult {
  const rng = new XorShift128(seed)

  const N = config.playerCount
  // alpha% 玩家获得 lives 命，其余获得 lives-1 命
  const alpha = config.fullPlayRatio
  const fullLives = config.lives
  const reducedLives = Math.max(1, fullLives - 1)

  // TypedArray 初始化
  const wins    = new Int16Array(N)
  const losses  = new Int16Array(N)
  const maxLives = new Int8Array(N)
  const active   = new Uint8Array(N)  // 1=活跃, 0=淘汰
  const skills   = new Float32Array(N)

  const alphaCount = Math.round(N * alpha)
  for (let i = 0; i < N; i++) {
    maxLives[i] = i < alphaCount ? fullLives : reducedLives
    active[i] = 1
  }

  // 若 kappa > 0：生成技能值
  if (config.kappa > 0) {
    for (let i = 0; i < N; i++) {
      skills[i] = rng.nextNormal()
    }
  }

  let activeCount = N

  // ---- 主循环 ----
  while (true) {
    // 收集活跃玩家
    const pool: number[] = []
    for (let i = 0; i < N; i++) {
      if (active[i]) pool.push(i)
    }
    if (pool.length <= 1) break

    // 按胜场降序排，同胜场内随机 shuffle（Fisher-Yates）
    pool.sort((a, b) => wins[b] - wins[a])

    // 对同胜场组做内部 shuffle
    let groupStart = 0
    while (groupStart < pool.length) {
      let groupEnd = groupStart
      const w = wins[pool[groupStart]]
      while (groupEnd < pool.length && wins[pool[groupEnd]] === w) groupEnd++
      // Fisher-Yates shuffle [groupStart, groupEnd)
      for (let k = groupEnd - 1; k > groupStart; k--) {
        const j = groupStart + Math.floor(rng.next() * (k - groupStart + 1))
        const tmp = pool[k]; pool[k] = pool[j]; pool[j] = tmp
      }
      groupStart = groupEnd
    }

    // 线性扫描配对（胜场差 ≤ 1）
    const pairs: Array<[number, number]> = []
    const paired = new Uint8Array(pool.length)

    for (let i = 0; i < pool.length - 1; i++) {
      if (paired[i]) continue
      for (let j = i + 1; j < pool.length; j++) {
        if (paired[j]) continue
        if (Math.abs(wins[pool[i]] - wins[pool[j]]) <= 1) {
          pairs.push([pool[i], pool[j]])
          paired[i] = 1
          paired[j] = 1
          break
        }
      }
    }

    // 无有效配对 → 结束
    if (pairs.length === 0) break

    // 执行对局
    for (const [a, b] of pairs) {
      let aWins: boolean
      if (config.kappa === 0) {
        // 纯随机 50/50
        aWins = rng.next() < 0.5
      } else {
        // Bradley-Terry 模型：P(a) = sigmoid(kappa * (skill_a - skill_b))
        const diff = config.kappa * (skills[a] - skills[b])
        // 防止溢出
        const prob = diff > 20 ? 1 : diff < -20 ? 0 : 1 / (1 + Math.exp(-diff))
        aWins = rng.next() < prob
      }

      if (aWins) {
        wins[a]++
        losses[b]++
        if (losses[b] >= maxLives[b]) { active[b] = 0; activeCount-- }
      } else {
        wins[b]++
        losses[a]++
        if (losses[a] >= maxLives[a]) { active[a] = 0; activeCount-- }
      }
    }

    // 发送进度（由外层调用者处理整体进度汇报）
    const progress = 1 - activeCount / N
    self.postMessage({ type: 'progress-inner', progress })
  }

  // ---- 计算结果 ----
  // 所有玩家按 (wins DESC, losses ASC) 排序
  const allPlayers = Array.from({ length: N }, (_, i) => i)
  allPlayers.sort((a, b) => {
    if (wins[b] !== wins[a]) return wins[b] - wins[a]
    return losses[a] - losses[b]
  })

  // 胜场分布
  let maxWinsVal = 0
  for (let i = 0; i < N; i++) if (wins[i] > maxWinsVal) maxWinsVal = wins[i]
  const winDistribution = new Array<number>(maxWinsVal + 1).fill(0)
  for (let i = 0; i < N; i++) winDistribution[wins[i]]++

  // 前 1000 名的胜场
  const topCount = Math.min(1000, N)
  const topPlayerWins: number[] = []
  for (let i = 0; i < topCount; i++) {
    topPlayerWins.push(wins[allPlayers[i]])
  }

  return { winDistribution, topPlayerWins }
}

// ---- 多次模拟汇总 ----
function runMultiSimulation(config: SimConfig): void {
  const t0 = performance.now()
  const totalRuns = Math.max(1, Math.min(50, config.runs || 1))

  // 收集每次运行的结果
  const allResults: SingleRunResult[] = []

  for (let r = 0; r < totalRuns; r++) {
    // 每次 run 用不同的 seed
    const seed = config.seed + r * 7919  // 用质数偏移确保差异
    const result = runSingleSimulation(config, seed)
    allResults.push(result)

    // 汇报整体进度
    self.postMessage({
      type: 'progress',
      progress: (r + 1) / totalRuns,
    })
  }

  // ---- 汇总统计 ----
  const topCount = Math.min(1000, config.playerCount)

  // 找到最大的 winDistribution 长度
  const maxDistLen = Math.max(...allResults.map(r => r.winDistribution.length))

  // 平均胜场分布
  const avgWinDistribution = new Array<number>(maxDistLen).fill(0)
  for (const res of allResults) {
    for (let i = 0; i < res.winDistribution.length; i++) {
      avgWinDistribution[i] += res.winDistribution[i]
    }
  }
  for (let i = 0; i < maxDistLen; i++) {
    avgWinDistribution[i] = Math.round(avgWinDistribution[i] / totalRuns)
  }

  // 前 topCount 名的统计
  const avgTopPlayerWins = new Array<number>(topCount).fill(0)
  const minTopPlayerWins = new Array<number>(topCount).fill(Infinity)
  const maxTopPlayerWins = new Array<number>(topCount).fill(-Infinity)

  for (const res of allResults) {
    for (let i = 0; i < topCount && i < res.topPlayerWins.length; i++) {
      const w = res.topPlayerWins[i]
      avgTopPlayerWins[i] += w
      if (w < minTopPlayerWins[i]) minTopPlayerWins[i] = w
      if (w > maxTopPlayerWins[i]) maxTopPlayerWins[i] = w
    }
  }
  for (let i = 0; i < topCount; i++) {
    avgTopPlayerWins[i] = Math.round((avgTopPlayerWins[i] / totalRuns) * 10) / 10
    if (minTopPlayerWins[i] === Infinity) minTopPlayerWins[i] = 0
    if (maxTopPlayerWins[i] === -Infinity) maxTopPlayerWins[i] = 0
  }

  // 冠军统计（第 0 名）
  const championStats = {
    avg: avgTopPlayerWins[0],
    min: minTopPlayerWins[0],
    max: maxTopPlayerWins[0],
  }

  // 目标排名统计（暂时用第 999 名，实际由前端根据 targetRank 索引取）
  // 这里返回完整数组，前端根据 targetRank 提取
  const targetRankStats = {
    avg: 0,
    min: 0,
    max: 0,
  }

  const elapsed = performance.now() - t0

  self.postMessage({
    type: 'result',
    result: {
      runs: totalRuns,
      elapsed,
      avgWinDistribution,
      avgTopPlayerWins,
      minTopPlayerWins,
      maxTopPlayerWins,
      championWins: championStats,
      targetRankWins: targetRankStats,
    } satisfies SimResult,
  })
}

// ---- 接收主线程消息 ----
self.addEventListener('message', (e: MessageEvent<SimConfig>) => {
  runMultiSimulation(e.data)
})
