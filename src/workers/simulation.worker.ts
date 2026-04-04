/**
 * 蒙特卡罗锦标赛模拟 Web Worker
 * 使用 xorshift128 PRNG、TypedArray 提升性能
 * 配对规则：胜场差 ≤ 1 才能配对（同场竞技原则）
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
}

export interface SimResult {
  winDistribution: number[]   // winDistribution[w] = 玩家数（w=0,1,2,...）
  topPlayerWins: number[]     // 前 min(1000, N) 名玩家的胜场数（已按排名排序）
  elapsed: number             // 毫秒
}

// ---- 主模拟逻辑 ----
function runSimulation(config: SimConfig): void {
  const t0 = performance.now()
  const rng = new XorShift128(config.seed)

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

    // 发送进度
    const progress = 1 - activeCount / N
    self.postMessage({ type: 'progress', progress })
  }

  // ---- 计算结果 ----
  // 所有玩家按 (wins DESC, losses ASC) 排序
  const allPlayers = Array.from({ length: N }, (_, i) => i)
  allPlayers.sort((a, b) => {
    if (wins[b] !== wins[a]) return wins[b] - wins[a]
    return losses[a] - losses[b]
  })

  // 胜场分布
  let maxWins = 0
  for (let i = 0; i < N; i++) if (wins[i] > maxWins) maxWins = wins[i]
  const winDistribution = new Array<number>(maxWins + 1).fill(0)
  for (let i = 0; i < N; i++) winDistribution[wins[i]]++

  // 前 1000 名的胜场
  const topCount = Math.min(1000, N)
  const topPlayerWins: number[] = []
  for (let i = 0; i < topCount; i++) {
    topPlayerWins.push(wins[allPlayers[i]])
  }

  const elapsed = performance.now() - t0

  self.postMessage({
    type: 'result',
    result: { winDistribution, topPlayerWins, elapsed } satisfies SimResult,
  })
}

// ---- 接收主线程消息 ----
self.addEventListener('message', (e: MessageEvent<SimConfig>) => {
  runSimulation(e.data)
})
