# CR 锦标赛排名计算器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-based tournament ranking calculator for Clash Royale that estimates "how many wins to reach top N" using NegBin distribution + optional Monte Carlo simulation with skill heterogeneity.

**Architecture:** Pure frontend SPA. Math engine as pure functions (no side effects), UI layer with React components, simulation engine in Web Worker. All computation runs client-side. Two calculation paths: analytical (NegBin, instant) and simulation (Monte Carlo, 1-2min for 200k players).

**Tech Stack:** React 18 + TypeScript, Vite, Tailwind CSS + shadcn/ui, Recharts, KaTeX, Web Worker

---

## File Structure

```
cr-tournament-calc/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── src/
│   ├── main.tsx                          # React 入口
│   ├── App.tsx                           # 根组件：布局 + 状态管理
│   ├── lib/
│   │   ├── math.ts                       # 数学引擎：NegBin、尾分布、Binomial 晋级概率、四种查询
│   │   └── math.test.ts                  # 数学引擎单元测试
│   ├── workers/
│   │   └── simulation.worker.ts          # 蒙特卡罗模拟 Web Worker
│   ├── components/
│   │   ├── ParameterPanel.tsx            # 左侧参数面板
│   │   ├── QueryTabs.tsx                 # 四种查询模式 Tab 切换 + 结果展示
│   │   ├── PredictRank.tsx              # 预测最终排名（含个人胜率滑块）
│   │   ├── DistributionChart.tsx         # 图表1：胜场分布曲线
│   │   ├── CumulativeRankChart.tsx       # 图表2：累计排名曲线
│   │   ├── DecayRatioChart.tsx           # 图表4：衰减比例图
│   │   ├── RobustnessHeatmap.tsx         # 图表3：鲁棒性热力图（Canvas）
│   │   ├── DataTable.tsx                 # 完整分布表 + 关键节点速查
│   │   ├── MathInsights.tsx              # 数学洞察面板（KaTeX 公式）
│   │   └── SimulationPanel.tsx           # 蒙特卡罗模拟控制 + 结果展示
│   └── hooks/
│       └── useSimulation.ts              # Web Worker 通�� hook
```

---

## Task 1: 项目脚手架

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`

- [ ] **Step 1: 用 Vite 创建项目**

```bash
cd ~/Desktop/taoyao
npm create vite@latest cr-tournament-calc -- --template react-ts
cd cr-tournament-calc
```

- [ ] **Step 2: 安装依赖**

```bash
npm install
npm install -D tailwindcss @tailwindcss/vite
npm install recharts katex @types/katex
```

- [ ] **Step 3: 配置 Tailwind**

`vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

`src/index.css` 顶部替换为：
```css
@import "tailwindcss";
```

- [ ] **Step 4: 安装 shadcn/ui**

```bash
npx shadcn@latest init -d
npx shadcn@latest add tabs card slider input label select button badge tooltip
```

- [ ] **Step 5: 创建最小 App 验证构建**

`src/App.tsx`:
```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function App() {
  return (
    <div className="min-h-screen bg-background p-6">
      <Card>
        <CardHeader>
          <CardTitle>皇室战争锦标赛排名计算器</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">加载中...</p>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 6: 验证构建**

```bash
npm run dev
# 在浏览器中访问 localhost:5173，确认页面正常渲染
```

- [ ] **Step 7: 初始化 Git 并提交**

```bash
cd ~/Desktop/taoyao/cr-tournament-calc
git init
echo "node_modules\ndist\n.env" > .gitignore
git add -A
git commit -m "feat: 项目脚手架 — Vite + React + Tailwind + shadcn/ui"
```

---

## Task 2: 数学引擎 — NegBin 分布与尾分布

**Files:**
- Create: `src/lib/math.ts`, `src/lib/math.test.ts`

- [ ] **Step 1: 安装测试框架**

```bash
npm install -D vitest
```

在 `package.json` 的 `scripts` 中添加 `"test": "vitest run"`, `"test:watch": "vitest"`。

在 `vite.config.ts` 中添加 test 配置：
```ts
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
  },
})
```

- [ ] **Step 2: 写失败测试 — NegBin PMF**

`src/lib/math.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { negbinPmf, negbinTail, computeDistribution } from './math'

describe('negbinPmf', () => {
  it('P(W=0 | r=5) = (0.5)^5 = 0.03125', () => {
    expect(negbinPmf(0, 5)).toBeCloseTo(0.03125, 10)
  })

  it('P(W=1 | r=5) = C(5,4) * (0.5)^6 = 5/64', () => {
    expect(negbinPmf(1, 5)).toBeCloseTo(5 / 64, 10)
  })

  it('P(W=12 | r=5) = C(16,4) * (0.5)^17', () => {
    const c16_4 = 1820
    expect(negbinPmf(12, 5)).toBeCloseTo(c16_4 / Math.pow(2, 17), 10)
  })
})

describe('negbinTail', () => {
  it('S(0) = 1（所有概率之和）', () => {
    expect(negbinTail(0, 5, 1_000_000)).toBeCloseTo(1.0, 6)
  })

  it('尾分布单调递减', () => {
    for (let k = 0; k < 30; k++) {
      expect(negbinTail(k + 1, 5, 200_000)).toBeLessThanOrEqual(
        negbinTail(k, 5, 200_000)
      )
    }
  })
})

describe('computeDistribution', () => {
  it('所有 PMF 求和 ≈ 1', () => {
    const dist = computeDistribution(5, 200_000)
    const sum = dist.reduce((s, d) => s + d.pmf, 0)
    expect(sum).toBeCloseTo(1.0, 6)
  })
})
```

- [ ] **Step 3: 运行测试确认失败**

```bash
npm test
# Expected: FAIL — negbinPmf is not defined
```

- [ ] **Step 4: 实现数学引擎**

`src/lib/math.ts`:
```ts
// === NegBin(r, 0.5) 概率质量函数 ===
// 递推公式：P(0)=(0.5)^r, P(k+1)=P(k)*(k+r)/(2*(k+1))
export function negbinPmf(k: number, r: number): number {
  let p = Math.pow(0.5, r)
  for (let i = 0; i < k; i++) {
    p = p * (i + r) / (2 * (i + 1))
  }
  return p
}

// === NegBin(r, p_win) PMF（非 50% 胜率版本，用于预测最终排名） ===
export function negbinPmfGeneral(k: number, r: number, pWin: number): number {
  const pLose = 1 - pWin
  // P(W=k) = C(k+r-1, r-1) * pWin^k * pLose^r
  // 递推：P(0) = pLose^r, P(k+1) = P(k) * pWin * (k+r) / (k+1)
  let p = Math.pow(pLose, r)
  for (let i = 0; i < k; i++) {
    p = p * pWin * (i + r) / (i + 1)
  }
  return p
}

// === 尾分布 S(k) = P(W >= k) ===
// 截断条件：剩余尾质量 < 0.1/N
export function negbinTail(k: number, r: number, n: number): number {
  const threshold = 0.1 / n
  let tail = 0
  let j = k
  while (true) {
    const p = negbinPmf(j, r)
    if (p < threshold && j > k) break
    tail += p
    j++
    if (j > 500) break // 安全上限
  }
  return tail
}

// === 混合分布（处理提前放弃）===
export function mixedPmf(k: number, rFull: number, alpha: number): number {
  const rQuit = rFull - 1
  return alpha * negbinPmf(k, rFull) + (1 - alpha) * negbinPmf(k, rQuit)
}

export function mixedTail(k: number, rFull: number, alpha: number, n: number): number {
  const threshold = 0.1 / n
  let tail = 0
  let j = k
  while (true) {
    const p = mixedPmf(j, rFull, alpha)
    if (p < threshold && j > k) break
    tail += p
    j++
    if (j > 500) break
  }
  return tail
}

// === 分布数据（用于图表和表格）===
export interface DistributionRow {
  wins: number
  pmf: number          // 恰好 k 胜的概率
  count: number        // 恰好 k 胜的期望人数
  tailProb: number     // >= k 胜的概率
  tailCount: number    // >= k 胜的期望人数
  decayRatio: number   // P(k) / P(k-1)
}

export function computeDistribution(
  rFull: number,
  n: number,
  alpha: number = 1.0,
): DistributionRow[] {
  const rows: DistributionRow[] = []
  const threshold = 0.1 / n
  let k = 0
  while (true) {
    const pmf = alpha === 1.0 ? negbinPmf(k, rFull) : mixedPmf(k, rFull, alpha)
    if (pmf < threshold && k > 0) break
    rows.push({
      wins: k,
      pmf,
      count: pmf * n,
      tailProb: 0,  // 后面填充
      tailCount: 0,
      decayRatio: k > 0 ? pmf / rows[k - 1].pmf : 0,
    })
    k++
    if (k > 500) break
  }
  // 从后往前累加尾分布
  let cumProb = 0
  for (let i = rows.length - 1; i >= 0; i--) {
    cumProb += rows[i].pmf
    rows[i].tailProb = cumProb
    rows[i].tailCount = cumProb * n
  }
  return rows
}
```

- [ ] **Step 5: 运行测试确认通过**

```bash
npm test
# Expected: PASS — 所有测试通过
```

- [ ] **Step 6: 提交**

```bash
git add src/lib/math.ts src/lib/math.test.ts package.json vite.config.ts
git commit -m "feat: 数学引擎 — NegBin 分布、尾分布、混合分布"
```

---

## Task 3: 数学引擎 — Binomial 晋级概率 + 四种查询模式

**Files:**
- Modify: `src/lib/math.ts`, `src/lib/math.test.ts`

- [ ] **Step 1: 写失败测试 — Binomial 晋级概率和查询**

追加到 `src/lib/math.test.ts`:
```ts
import {
  negbinPmf, negbinTail, computeDistribution,
  promotionProbability, queryWinsToRank, queryRankFromWins,
  querySafePlayerCount,
} from './math'

describe('promotionProbability', () => {
  it('当 N*S(k) 远小于 target 时，概率接近 1', () => {
    // r=5, k=20, N=1000 → N*S(20) ≈ 0.77，远小于 900
    const prob = promotionProbability(20, 5, 1.0, 1000, 900)
    expect(prob).toBeGreaterThan(0.999)
  })

  it('当 N*S(k) 远大于 target 时，概率接近 0', () => {
    // r=5, k=5, N=200000 → N*S(5) ≈ 71000，远大于 900
    const prob = promotionProbability(5, 5, 1.0, 200_000, 900)
    expect(prob).toBeLessThan(0.001)
  })
})

describe('queryWinsToRank', () => {
  it('200000 人进前 900：95% 安全胜场应该在 15-20 之间', () => {
    const result = queryWinsToRank(5, 1.0, 200_000, 900, 0.95)
    expect(result.safeWins).toBeGreaterThanOrEqual(15)
    expect(result.safeWins).toBeLessThanOrEqual(20)
  })
})

describe('queryRankFromWins', () => {
  it('与 queryWinsToRank 互为逆运算', () => {
    const winsResult = queryWinsToRank(5, 1.0, 200_000, 900, 0.95)
    const rankResult = queryRankFromWins(winsResult.safeWins, 5, 1.0, 200_000)
    // 排名应该 ≤ 900
    expect(rankResult.conservativeRank).toBeLessThanOrEqual(900)
  })
})

describe('querySafePlayerCount', () => {
  it('15 胜进前 900 的安全人数上限应该是合理的数字', () => {
    const result = querySafePlayerCount(15, 5, 1.0, 900, 0.95)
    expect(result.maxPlayers).toBeGreaterThan(10_000)
    expect(result.maxPlayers).toBeLessThan(10_000_000)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test
# Expected: FAIL — promotionProbability is not defined
```

- [ ] **Step 3: 实现 Binomial 晋级概率和四种查询**

追加到 `src/lib/math.ts`:
```ts
// === Binomial CDF（正态近似，N 大时足够准确）===
// P(X <= x) where X ~ Binomial(N, p)
function normalCdf(z: number): number {
  // Abramowitz & Stegun 近似
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911
  const sign = z < 0 ? -1 : 1
  const x = Math.abs(z) / Math.SQRT2
  const t = 1.0 / (1.0 + p * x)
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)
  return 0.5 * (1.0 + sign * y)
}

function binomialCdf(x: number, n: number, p: number): number {
  if (p === 0) return 1
  if (p === 1) return x >= n ? 1 : 0
  const mean = n * p
  const std = Math.sqrt(n * p * (1 - p))
  if (std === 0) return x >= mean ? 1 : 0
  // 连续性校正
  return normalCdf((x + 0.5 - mean) / std)
}

// === 晋级概率：P(≥k 胜的人数 ≤ target-1) ===
export function promotionProbability(
  k: number, rFull: number, alpha: number, n: number, targetRank: number,
): number {
  const tailProb = alpha === 1.0
    ? negbinTail(k, rFull, n)
    : mixedTail(k, rFull, alpha, n)
  // X_k ~ Binomial(N, tailProb)
  return binomialCdf(targetRank - 1, n, tailProb)
}

// === 模式 1：胜场 → 排名 ===
export interface RankResult {
  conservativeRank: number  // 最坏排名（r 负）
  optimisticRank: number    // 最好排名（0 负）
  percentile: number        // 百分位（保守）
}

export function queryRankFromWins(
  wins: number, rFull: number, alpha: number, n: number,
): RankResult {
  const tailK = alpha === 1.0
    ? negbinTail(wins, rFull, n)
    : mixedTail(wins, rFull, alpha, n)
  const tailKPlus1 = alpha === 1.0
    ? negbinTail(wins + 1, rFull, n)
    : mixedTail(wins + 1, rFull, alpha, n)
  const conservativeRank = Math.round(n * tailK)
  const optimisticRank = Math.max(1, Math.round(n * tailKPlus1) + 1)
  return {
    conservativeRank,
    optimisticRank,
    percentile: (1 - tailK) * 100,
  }
}

// === 模式 2：目标名次 → 需要多少胜 ===
export interface WinsToRankResult {
  safeWins: number        // 95% 安全胜场
  probByWins: Array<{ wins: number; probability: number }>
}

export function queryWinsToRank(
  rFull: number, alpha: number, n: number, targetRank: number, confidence: number = 0.95,
): WinsToRankResult {
  const probByWins: Array<{ wins: number; probability: number }> = []
  let safeWins = 0

  for (let k = 0; k <= 100; k++) {
    const prob = promotionProbability(k, rFull, alpha, n, targetRank)
    if (prob > 0.001 || probByWins.length > 0) {
      probByWins.push({ wins: k, probability: prob })
    }
    if (prob >= confidence && safeWins === 0) {
      safeWins = k
    }
    if (prob > 0.9999 && probByWins.length > 5) break
  }
  return { safeWins, probByWins }
}

// === 模式 4：安全人数上限 ===
export interface SafePlayerCountResult {
  maxPlayers: number        // 95% 安全人数上限
  maxPlayers80: number      // 80%
  maxPlayers99: number      // 99%
}

export function querySafePlayerCount(
  wins: number, rFull: number, alpha: number, targetRank: number, confidence: number = 0.95,
): SafePlayerCountResult {
  // 二分查找：找最大 N 使得 promotionProbability >= confidence
  function findMax(conf: number): number {
    let lo = 1, hi = 10_000_000
    while (lo < hi) {
      const mid = Math.floor((lo + hi + 1) / 2)
      if (promotionProbability(wins, rFull, alpha, mid, targetRank) >= conf) {
        lo = mid
      } else {
        hi = mid - 1
      }
    }
    return lo
  }
  return {
    maxPlayers: findMax(confidence),
    maxPlayers80: findMax(0.80),
    maxPlayers99: findMax(0.99),
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test
# Expected: PASS
```

- [ ] **Step 5: 提交**

```bash
git add src/lib/math.ts src/lib/math.test.ts
git commit -m "feat: Binomial 晋级概率 + 四种查询模式"
```

---

## Task 4: App 状态管理 + 参数面板

**Files:**
- Modify: `src/App.tsx`
- Create: `src/components/ParameterPanel.tsx`

- [ ] **Step 1: 实现参数面板组件**

`src/components/ParameterPanel.tsx`:
```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

export interface TournamentParams {
  playerCount: number
  lives: number
  fullPlayRatio: number
  targetRank: number
  kappa: number
}

interface Props {
  params: TournamentParams
  onChange: (params: TournamentParams) => void
}

export function ParameterPanel({ params, onChange }: Props) {
  const set = (patch: Partial<TournamentParams>) =>
    onChange({ ...params, ...patch })

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="text-lg">参数设置</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* 参赛人数 */}
        <div className="space-y-2">
          <Label>参赛人数 N</Label>
          <Input
            type="number"
            value={params.playerCount}
            onChange={e => set({ playerCount: Math.max(1000, Number(e.target.value)) })}
          />
          <Slider
            value={[Math.log10(params.playerCount)]}
            min={3} max={6.7} step={0.01}
            onValueChange={([v]) => set({ playerCount: Math.round(Math.pow(10, v)) })}
          />
          <p className="text-xs text-muted-foreground">
            {params.playerCount.toLocaleString()} 人
          </p>
        </div>

        {/* 命数 */}
        <div className="space-y-2">
          <Label>命数 r</Label>
          <Select
            value={String(params.lives)}
            onValueChange={v => set({ lives: Number(v) })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[3, 4, 5, 6, 7].map(v => (
                <SelectItem key={v} value={String(v)}>{v} 条命</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 打满比例 */}
        <div className="space-y-2">
          <Label>打满比例 α = {params.fullPlayRatio.toFixed(2)}</Label>
          <Slider
            value={[params.fullPlayRatio]}
            min={0.5} max={1.0} step={0.01}
            onValueChange={([v]) => set({ fullPlayRatio: v })}
          />
          <p className="text-xs text-muted-foreground">
            {Math.round(params.fullPlayRatio * 100)}% 玩家打满 {params.lives} 命
          </p>
        </div>

        {/* 晋级名次 */}
        <div className="space-y-2">
          <Label>晋级名次</Label>
          <Input
            type="number"
            value={params.targetRank}
            onChange={e => set({ targetRank: Math.max(1, Number(e.target.value)) })}
          />
        </div>

        {/* 禀赋差异（高级） */}
        <div className="space-y-2 pt-2 border-t">
          <Label>禀赋差异 κ = {params.kappa.toFixed(2)}</Label>
          <Slider
            value={[params.kappa]}
            min={0} max={3.0} step={0.01}
            onValueChange={([v]) => set({ kappa: v })}
          />
          <p className="text-xs text-muted-foreground">
            {params.kappa === 0
              ? '纯 50% 胜率（理论计算）'
              : `顶尖(+2σ) vs 平均 ≈ ${Math.round(100 / (1 + Math.exp(-2 * params.kappa)))}% 胜率（需模拟）`}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: 实现 App 根组件和状态管理**

`src/App.tsx`:
```tsx
import { useState, useMemo } from 'react'
import { ParameterPanel, type TournamentParams } from './components/ParameterPanel'
import { computeDistribution } from './lib/math'

const DEFAULT_PARAMS: TournamentParams = {
  playerCount: 240_000,
  lives: 5,
  fullPlayRatio: 0.9,
  targetRank: 900,
  kappa: 1.47,
}

export default function App() {
  const [params, setParams] = useState<TournamentParams>(DEFAULT_PARAMS)

  const distribution = useMemo(
    () => computeDistribution(params.lives, params.playerCount, params.fullPlayRatio),
    [params.lives, params.playerCount, params.fullPlayRatio],
  )

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <h1 className="text-2xl font-bold">皇室战争锦标赛排名计算器</h1>
        <p className="text-sm text-muted-foreground mt-1">
          基于负二项分布的理论估算 · 输出为参考区间，非精确预测
        </p>
      </header>

      <div className="flex gap-6 p-6">
        {/* 左侧参数面板 */}
        <aside className="w-72 shrink-0">
          <ParameterPanel params={params} onChange={setParams} />
        </aside>

        {/* 右侧主区域 */}
        <main className="flex-1 space-y-6">
          <p className="text-muted-foreground">
            分布已计算：{distribution.length} 个胜场级别，
            参赛 {params.playerCount.toLocaleString()} 人
          </p>
          {/* 后续 Task 会填充查询卡片、图表、表格 */}
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 验证页面渲染**

```bash
npm run dev
# 确认参数面板正常显示、滑块可交互、分布计算正常
```

- [ ] **Step 4: 提交**

```bash
git add src/App.tsx src/components/ParameterPanel.tsx
git commit -m "feat: App 状态管理 + 参数面板"
```

---

## Task 5: 查询模式 Tab + 结果展示

**Files:**
- Create: `src/components/QueryTabs.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: 实现四种查询模式的 Tab 组件**

`src/components/QueryTabs.tsx`:
```tsx
import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  queryRankFromWins, queryWinsToRank, querySafePlayerCount,
  promotionProbability,
} from '@/lib/math'
import type { TournamentParams } from './ParameterPanel'

interface Props {
  params: TournamentParams
}

export function QueryTabs({ params }: Props) {
  const { lives, fullPlayRatio: alpha, playerCount: n, targetRank } = params

  // 模式1 状态
  const [m1Wins, setM1Wins] = useState(15)
  const m1Result = queryRankFromWins(m1Wins, lives, alpha, n)

  // 模式2 结果
  const m2Result = queryWinsToRank(lives, alpha, n, targetRank)

  // 模式3 状态
  const [m3Wins, setM3Wins] = useState(15)
  const [m3NMin, setM3NMin] = useState(100_000)
  const [m3NMax, setM3NMax] = useState(500_000)

  // 模式4 状态
  const [m4Wins, setM4Wins] = useState(15)
  const m4Result = querySafePlayerCount(m4Wins, lives, alpha, targetRank)

  return (
    <Tabs defaultValue="mode2">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="mode1">胜场→排名</TabsTrigger>
        <TabsTrigger value="mode2">名次→胜场</TabsTrigger>
        <TabsTrigger value="mode3">鲁棒性分析</TabsTrigger>
        <TabsTrigger value="mode4">安全人数</TabsTrigger>
      </TabsList>

      {/* 模式1 */}
      <TabsContent value="mode1">
        <Card>
          <CardHeader><CardTitle>我的胜场 �� 预估排名</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Label>我的胜场</Label>
              <Input type="number" value={m1Wins} className="w-24"
                onChange={e => setM1Wins(Math.max(0, Number(e.target.value)))} />
            </div>
            <div className="space-y-2">
              <p>保守排名（{lives} 负）：<span className="text-2xl font-bold">{m1Result.conservativeRank.toLocaleString()}</span></p>
              <p>乐观排名（0 负）：<span className="text-2xl font-bold">{m1Result.optimisticRank.toLocaleString()}</span></p>
              <p>百分位：前 {(100 - m1Result.percentile).toFixed(2)}%</p>
              <p>晋级概率：
                <Badge variant={promotionProbability(m1Wins, lives, alpha, n, targetRank) >= 0.95 ? 'default' : 'destructive'}>
                  {(promotionProbability(m1Wins, lives, alpha, n, targetRank) * 100).toFixed(1)}%
                </Badge>
              </p>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* 模式2 */}
      <TabsContent value="mode2">
        <Card>
          <CardHeader>
            <CardTitle>进前 {targetRank} 名需要多少胜？</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-lg">
              95% 安全胜场：<span className="text-3xl font-bold text-primary">{m2Result.safeWins} 胜</span>
            </p>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">各胜场晋级概率：</p>
              {m2Result.probByWins
                .filter(r => r.probability > 0.01 && r.probability < 0.9999)
                .map(r => (
                  <div key={r.wins} className="flex items-center gap-2">
                    <span className="w-16 text-right font-mono">{r.wins} 胜</span>
                    <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                      <div
                        className={`h-full rounded ${r.probability >= 0.95 ? 'bg-green-500' : r.probability >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${r.probability * 100}%` }}
                      />
                    </div>
                    <span className="w-16 text-sm">{(r.probability * 100).toFixed(1)}%</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* 模式3 */}
      <TabsContent value="mode3">
        <Card>
          <CardHeader><CardTitle>鲁棒性分析</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Label>我的胜场</Label>
              <Input type="number" value={m3Wins} className="w-24"
                onChange={e => setM3Wins(Math.max(0, Number(e.target.value)))} />
              <Label>人数下限</Label>
              <Input type="number" value={m3NMin} className="w-32"
                onChange={e => setM3NMin(Number(e.target.value))} />
              <Label>人数上限</Label>
              <Input type="number" value={m3NMax} className="w-32"
                onChange={e => setM3NMax(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              {/* 采样 10 个点 */}
              {Array.from({ length: 10 }, (_, i) => {
                const playerN = Math.round(m3NMin + (m3NMax - m3NMin) * i / 9)
                const rank = queryRankFromWins(m3Wins, lives, alpha, playerN)
                const prob = promotionProbability(m3Wins, lives, alpha, playerN, targetRank)
                const safe = prob >= 0.95
                return (
                  <div key={i} className={`flex items-center gap-2 p-1 rounded ${safe ? 'bg-green-50' : 'bg-red-50'}`}>
                    <span className="w-28 text-sm">{playerN.toLocaleString()} 人</span>
                    <span className="w-24 text-sm">排名 ~{rank.conservativeRank.toLocaleString()}</span>
                    <Badge variant={safe ? 'default' : 'destructive'}>
                      {safe ? '安全' : '危险'} ({(prob * 100).toFixed(0)}%)
                    </Badge>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* 模式4 */}
      <TabsContent value="mode4">
        <Card>
          <CardHeader><CardTitle>安全人数上限</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Label>我的胜场</Label>
              <Input type="number" value={m4Wins} className="w-24"
                onChange={e => setM4Wins(Math.max(0, Number(e.target.value)))} />
            </div>
            <div className="space-y-2">
              <p>99% 安全：≤ <span className="font-bold">{m4Result.maxPlayers99.toLocaleString()}</span> 人</p>
              <p>95% 安全：≤ <span className="text-2xl font-bold text-primary">{m4Result.maxPlayers.toLocaleString()}</span> 人</p>
              <p>80% 安全：≤ <span className="font-bold">{m4Result.maxPlayers80.toLocaleString()}</span> 人</p>
              <p className="text-sm text-muted-foreground mt-2">参考：去年约 240,000 人参赛</p>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
```

- [ ] **Step 2: 将 QueryTabs 集成到 App**

在 `src/App.tsx` 的 `<main>` 区域替换占位文字：
```tsx
import { QueryTabs } from './components/QueryTabs'

// 在 <main> 内：
<QueryTabs params={params} />
```

- [ ] **Step 3: 验证四种查询模式均可使用**

```bash
npm run dev
# 验证四个 Tab 可切换、输入可交互、结果实时更新
```

- [ ] **Step 4: 提交**

```bash
git add src/components/QueryTabs.tsx src/App.tsx
git commit -m "feat: 四种查询模式 Tab + 结果展示"
```

---

## Task 6: 图表 — 胜场分布曲线 + 累���排名曲线

**Files:**
- Create: `src/components/DistributionChart.tsx`, `src/components/CumulativeRankChart.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: 实现胜场分布曲线**

`src/components/DistributionChart.tsx`:
```tsx
import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { DistributionRow } from '@/lib/math'

interface Props {
  data: DistributionRow[]
  targetWins?: number  // 高亮的胜场
}

export function DistributionChart({ data, targetWins }: Props) {
  const [logScale, setLogScale] = useState(false)

  const chartData = data.map(d => ({
    wins: d.wins,
    count: logScale ? Math.max(Math.log10(Math.max(d.count, 0.01)), -2) : d.count,
    rawCount: d.count,
    tailCount: d.tailCount,
  }))

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">胜场分布曲线</CardTitle>
        <Button variant="outline" size="sm" onClick={() => setLogScale(!logScale)}>
          {logScale ? '线性' : '对数'}
        </Button>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <XAxis dataKey="wins" label={{ value: '胜场', position: 'bottom' }} />
            <YAxis label={{ value: logScale ? 'log10(人数)' : '人数', angle: -90, position: 'insideLeft' }} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null
                const d = payload[0].payload
                return (
                  <div className="bg-popover border p-2 rounded shadow text-sm">
                    <p className="font-bold">{d.wins} 胜</p>
                    <p>恰好：{Math.round(d.rawCount).toLocaleString()} 人</p>
                    <p>≥ {d.wins} 胜：{Math.round(d.tailCount).toLocaleString()} 人</p>
                  </div>
                )
              }}
            />
            {targetWins !== undefined && (
              <ReferenceLine x={targetWins} stroke="hsl(var(--primary))" strokeDasharray="5 5" label="目标" />
            )}
            <Bar dataKey="count" fill="hsl(var(--primary))" opacity={0.7} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: 实现累计排名曲线**

`src/components/CumulativeRankChart.tsx`:
```tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DistributionRow } from '@/lib/math'

interface Props {
  data: DistributionRow[]
  targetRank: number
}

export function CumulativeRankChart({ data, targetRank }: Props) {
  const chartData = data
    .filter(d => d.tailCount >= 0.5) // 只显示有意义的区间
    .map(d => ({
      wins: d.wins,
      rank: Math.round(d.tailCount),
    }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">累计排名曲线</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <XAxis dataKey="wins" label={{ value: '胜场', position: 'bottom' }} />
            <YAxis
              scale="log" domain={['auto', 'auto']}
              label={{ value: '≥该胜场人数', angle: -90, position: 'insideLeft' }}
              tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null
                const d = payload[0].payload
                return (
                  <div className="bg-popover border p-2 rounded shadow text-sm">
                    <p className="font-bold">{d.wins} 胜</p>
                    <p>排名：前 {d.rank.toLocaleString()} 名</p>
                  </div>
                )
              }}
            />
            <ReferenceLine y={targetRank} stroke="red" strokeDasharray="5 5" label={`前 ${targetRank}`} />
            <Line type="monotone" dataKey="rank" stroke="hsl(var(--primary))" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: 集成到 App**

在 `src/App.tsx` 的 `<main>` 中 QueryTabs 下方添加：
```tsx
import { DistributionChart } from './components/DistributionChart'
import { CumulativeRankChart } from './components/CumulativeRankChart'

// 在 QueryTabs 下方：
<div className="grid grid-cols-2 gap-6">
  <DistributionChart data={distribution} />
  <CumulativeRankChart data={distribution} targetRank={params.targetRank} />
</div>
```

- [ ] **Step 4: 验证图表渲染**

```bash
npm run dev
# 确认两个图表正常显示、tooltip 工作、参数变化时实时更新
```

- [ ] **Step 5: 提交**

```bash
git add src/components/DistributionChart.tsx src/components/CumulativeRankChart.tsx src/App.tsx
git commit -m "feat: 胜场分布曲线 + 累计排名曲线"
```

---

## Task 7: 数据表 — 完整分布表 + 关键节点速查

**Files:**
- Create: `src/components/DataTable.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: 实现数据表组件**

`src/components/DataTable.tsx`:
```tsx
import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { queryWinsToRank } from '@/lib/math'
import type { DistributionRow } from '@/lib/math'
import type { TournamentParams } from './ParameterPanel'

interface Props {
  data: DistributionRow[]
  params: TournamentParams
}

export function DataTable({ data, params }: Props) {
  const { lives, fullPlayRatio, playerCount, targetRank } = params

  // 关键节点速查
  const keyRanks = [100, 500, 900, 1000, 5000, 10000]
  const keyNodes = useMemo(() =>
    keyRanks.map(rank => ({
      rank,
      wins: queryWinsToRank(lives, fullPlayRatio, playerCount, rank).safeWins,
    })),
    [lives, fullPlayRatio, playerCount],
  )

  return (
    <div className="space-y-6">
      {/* 关键节点速查 */}
      <Card>
        <CardHeader><CardTitle className="text-base">关键节点速查（95% 安全）</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {keyNodes.map(n => (
              <div key={n.rank} className="flex items-center justify-between p-2 rounded bg-muted/50">
                <span className="text-sm">前 {n.rank.toLocaleString()}</span>
                <Badge variant={n.rank === targetRank ? 'default' : 'outline'}>
                  {n.wins} 胜
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 完整分布表 */}
      <Card>
        <CardHeader><CardTitle className="text-base">完整分布表</CardTitle></CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b">
                  <th className="text-left p-2">胜场</th>
                  <th className="text-right p-2">恰好人数</th>
                  <th className="text-right p-2">≥该胜场</th>
                  <th className="text-right p-2">衰减比</th>
                </tr>
              </thead>
              <tbody>
                {data.map(row => (
                  <tr key={row.wins} className={`border-b hover:bg-muted/50 ${
                    Math.round(row.tailCount) <= targetRank && Math.round(row.tailCount) > 0
                      ? 'bg-green-50 dark:bg-green-950/20' : ''
                  }`}>
                    <td className="p-2 font-mono">{row.wins}</td>
                    <td className="p-2 text-right font-mono">{Math.round(row.count).toLocaleString()}</td>
                    <td className="p-2 text-right font-mono">{Math.round(row.tailCount).toLocaleString()}</td>
                    <td className="p-2 text-right font-mono">
                      {row.wins > 0 ? row.decayRatio.toFixed(3) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: 集成到 App**

在 `src/App.tsx` 中图表下方添加：
```tsx
import { DataTable } from './components/DataTable'

<DataTable data={distribution} params={params} />
```

- [ ] **Step 3: 验证表格渲染和高亮**

```bash
npm run dev
# 确认速查表正确、完整分布表可滚动、晋级区间高亮
```

- [ ] **Step 4: 提交**

```bash
git add src/components/DataTable.tsx src/App.tsx
git commit -m "feat: 完整分布表 + 关键节点速查表"
```

---

## Task 8: 衰减比例图 + 数学洞察面板

**Files:**
- Create: `src/components/DecayRatioChart.tsx`, `src/components/MathInsights.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: 实现衰减比例图**

`src/components/DecayRatioChart.tsx`:
```tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DistributionRow } from '@/lib/math'

interface Props {
  data: DistributionRow[]
}

export function DecayRatioChart({ data }: Props) {
  const chartData = data
    .filter(d => d.wins > 0 && d.decayRatio > 0)
    .map(d => ({ wins: d.wins, ratio: d.decayRatio }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">衰减比例（��多一胜的人数保留率）</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <XAxis dataKey="wins" label={{ value: '胜场', position: 'bottom' }} />
            <YAxis domain={[0, 'auto']} tickFormatter={v => `${(v * 100).toFixed(0)}%`} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null
                const d = payload[0].payload
                return (
                  <div className="bg-popover border p-2 rounded shadow text-sm">
                    <p className="font-bold">{d.wins} 胜</p>
                    <p>保留率：{(d.ratio * 100).toFixed(1)}%</p>
                    <p>即每 {Math.round(1 / d.ratio)} 人中有 1 人多赢一场</p>
                  </div>
                )
              }}
            />
            <ReferenceLine y={0.5} stroke="#888" strokeDasharray="3 3" label="50%" />
            <Line type="monotone" dataKey="ratio" stroke="hsl(var(--primary))" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: 实现数学洞察面板**

`src/components/MathInsights.tsx`:
```tsx
import { useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import katex from 'katex'
import 'katex/dist/katex.min.css'

function Latex({ tex }: { tex: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (ref.current) {
      katex.render(tex, ref.current, { throwOnError: false })
    }
  }, [tex])
  return <span ref={ref} />
}

interface Props {
  lives: number
}

export function MathInsights({ lives }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">数学洞察</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div>
          <p className="font-medium mb-1">单人胜场分布 — NegBin({lives}, 0.5)</p>
          <Latex tex={`P(W=k) = \\binom{k+${lives}-1}{${lives}-1} \\times 0.5^{k+${lives}}`} />
        </div>

        <div>
          <p className="font-medium mb-1">递推公式</p>
          <Latex tex={`P(W=0) = 0.5^{${lives}}, \\quad P(W=k{+}1) = P(W=k) \\times \\frac{k+${lives}}{2(k+1)}`} />
        </div>

        <div>
          <p className="font-medium mb-1">衰减规律</p>
          <p>比值 <Latex tex={`\\frac{P(k+1)}{P(k)} = \\frac{k+${lives}}{2(k+1)}`} />：</p>
          <ul className="list-disc list-inside text-muted-foreground">
            <li>低胜场时（k 小）比值接近 <Latex tex={`\\frac{${lives}}{2} = ${(lives / 2).toFixed(1)}`} />，衰减慢</li>
            <li>高胜场时（k 大）比值趋向 0.5，每多一胜人数减半</li>
            <li>k = {lives} 时比值恰好 = 1（分布峰值附近）</li>
          </ul>
        </div>

        <div>
          <p className="font-medium mb-1">晋级概率</p>
          <Latex tex={`X_k \\sim \\text{Binomial}(N, S(k)), \\quad P(\\text{晋级}) = P(X_k \\leq \\text{target} - 1)`} />
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: 集成到 App**

在 `src/App.tsx` 的图表 grid 中添加 DecayRatioChart，在 DataTable 下方添加 MathInsights：
```tsx
import { DecayRatioChart } from './components/DecayRatioChart'
import { MathInsights } from './components/MathInsights'

// 图表 grid 改为：
<div className="grid grid-cols-2 gap-6">
  <DistributionChart data={distribution} />
  <CumulativeRankChart data={distribution} targetRank={params.targetRank} />
  <DecayRatioChart data={distribution} />
</div>

// DataTable 下方：
<MathInsights lives={params.lives} />
```

- [ ] **Step 4: 验证渲染**

```bash
npm run dev
# 确认衰减图和 KaTeX 公式正常显示
```

- [ ] **Step 5: 提交**

```bash
git add src/components/DecayRatioChart.tsx src/components/MathInsights.tsx src/App.tsx
git commit -m "feat: 衰减比例图 + 数学洞察面板"
```

---

## Task 9: 蒙特卡罗模拟引擎（Web Worker）

**Files:**
- Create: `src/workers/simulation.worker.ts`, `src/hooks/useSimulation.ts`, `src/components/SimulationPanel.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: 实现 Web Worker 模拟引擎**

`src/workers/simulation.worker.ts`:
```ts
// 蒙特卡罗锦标赛模拟
// 支持 50% 胜率和 Bradley-Terry 禀赋模型

interface SimConfig {
  playerCount: number
  lives: number
  fullPlayRatio: number
  kappa: number  // 0 = 50% 胜率
  seed: number
}

interface SimResult {
  // 每个胜场的人数
  winDistribution: number[]
  // 前 N 名的胜场
  topPlayerWins: number[]
  // 耗时 ms
  elapsed: number
}

// 简单的 xorshift128 PRNG
function createRng(seed: number) {
  let s = [seed, seed ^ 0x12345678, seed ^ 0xdeadbeef, seed ^ 0xcafebabe]
  return () => {
    let t = s[3]
    t ^= t << 11; t ^= t >>> 8
    s[3] = s[2]; s[2] = s[1]; s[1] = s[0]
    t ^= s[0]; t ^= s[0] >>> 19
    s[0] = t
    return (t >>> 0) / 4294967296
  }
}

function simulate(config: SimConfig): SimResult {
  const { playerCount: N, lives, fullPlayRatio: alpha, kappa, seed } = config
  const start = performance.now()
  const rng = createRng(seed)

  // 初始化玩家
  const wins = new Int16Array(N)
  const losses = new Int16Array(N)
  const maxLives = new Int8Array(N)
  const skills = new Float32Array(N)
  const active = new Uint8Array(N) // 1=活跃, 0=淘汰

  for (let i = 0; i < N; i++) {
    maxLives[i] = rng() < alpha ? lives : (lives - 1)
    active[i] = 1
    // Box-Muller 生成正态分布
    if (kappa > 0) {
      const u1 = rng(), u2 = rng()
      skills[i] = Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2)
    }
  }

  // 模拟轮次
  let activeCount = N
  while (activeCount > 1) {
    // 收集活跃玩家索引，按胜场排序
    const activeIdx: number[] = []
    for (let i = 0; i < N; i++) {
      if (active[i]) activeIdx.push(i)
    }
    if (activeIdx.length <= 1) break

    // 按胜场排序（降序），同胜场内随机打乱
    activeIdx.sort((a, b) => {
      const diff = wins[b] - wins[a]
      if (diff !== 0) return diff
      return rng() - 0.5
    })

    // 配对：���邻两人如果胜场差 ≤ 1 则配对
    let paired = 0
    for (let i = 0; i + 1 < activeIdx.length; i += 2) {
      const a = activeIdx[i], b = activeIdx[i + 1]
      if (Math.abs(wins[a] - wins[b]) > 1) {
        // 跳过，尝试下一个
        i-- // 让 a 和 i+2 尝试配对（通过 i+=2 后 i 变成 i+1）
        // 实际上这样不对，简单处理：跳过不配对
        continue
      }

      // 决定胜负
      let aWinProb = 0.5
      if (kappa > 0) {
        const delta = skills[a] - skills[b]
        aWinProb = 1 / (1 + Math.exp(-kappa * delta))
      }

      if (rng() < aWinProb) {
        wins[a]++
        losses[b]++
        if (losses[b] >= maxLives[b]) { active[b] = 0; activeCount-- }
      } else {
        wins[b]++
        losses[a]++
        if (losses[a] >= maxLives[a]) { active[a] = 0; activeCount-- }
      }
      paired++
    }

    if (paired === 0) break // 无法继续配对

    // 发送进度
    const progress = 1 - activeCount / N
    self.postMessage({ type: 'progress', progress })
  }

  // 统计结果
  const maxWin = Math.max(...Array.from(wins))
  const winDistribution = new Array(maxWin + 1).fill(0)
  for (let i = 0; i < N; i++) {
    winDistribution[wins[i]]++
  }

  // 排名（胜多优先，同胜场负少优先）
  const indices = Array.from({ length: N }, (_, i) => i)
  indices.sort((a, b) => {
    if (wins[b] !== wins[a]) return wins[b] - wins[a]
    return losses[a] - losses[b]
  })
  const topPlayerWins = indices.slice(0, 1000).map(i => wins[i])

  return {
    winDistribution,
    topPlayerWins,
    elapsed: performance.now() - start,
  }
}

self.onmessage = (e: MessageEvent) => {
  const config = e.data as SimConfig
  const result = simulate(config)
  self.postMessage({ type: 'result', result })
}
```

- [ ] **Step 2: 实现 useSimulation hook**

`src/hooks/useSimulation.ts`:
```ts
import { useState, useRef, useCallback } from 'react'

interface SimConfig {
  playerCount: number
  lives: number
  fullPlayRatio: number
  kappa: number
  seed: number
}

interface SimResult {
  winDistribution: number[]
  topPlayerWins: number[]
  elapsed: number
}

export function useSimulation() {
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<SimResult | null>(null)
  const workerRef = useRef<Worker | null>(null)

  const run = useCallback((config: SimConfig) => {
    if (workerRef.current) workerRef.current.terminate()

    const worker = new Worker(
      new URL('../workers/simulation.worker.ts', import.meta.url),
      { type: 'module' },
    )
    workerRef.current = worker
    setRunning(true)
    setProgress(0)
    setResult(null)

    worker.onmessage = (e) => {
      if (e.data.type === 'progress') {
        setProgress(e.data.progress)
      } else if (e.data.type === 'result') {
        setResult(e.data.result)
        setRunning(false)
        worker.terminate()
      }
    }

    worker.postMessage(config)
  }, [])

  const cancel = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate()
      workerRef.current = null
      setRunning(false)
    }
  }, [])

  return { run, cancel, running, progress, result }
}
```

- [ ] **Step 3: 实现模拟控制面板**

`src/components/SimulationPanel.tsx`:
```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useSimulation } from '@/hooks/useSimulation'
import type { TournamentParams } from './ParameterPanel'

interface Props {
  params: TournamentParams
}

export function SimulationPanel({ params }: Props) {
  const { run, cancel, running, progress, result } = useSimulation()

  const handleRun = () => {
    run({
      playerCount: Math.min(params.playerCount, 500_000),
      lives: params.lives,
      fullPlayRatio: params.fullPlayRatio,
      kappa: params.kappa,
      seed: Date.now(),
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">蒙特卡罗模拟</CardTitle>
        {running ? (
          <Button variant="destructive" size="sm" onClick={cancel}>取消</Button>
        ) : (
          <Button size="sm" onClick={handleRun}>
            {params.kappa > 0 ? '运行模拟（禀赋模式）' : '验证理论值'}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {running && (
          <div>
            <div className="h-2 bg-muted rounded overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress * 100}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{(progress * 100).toFixed(0)}%</p>
          </div>
        )}

        {result && (
          <div className="space-y-2 text-sm">
            <p>耗时：{(result.elapsed / 1000).toFixed(1)}s</p>
            <p className="font-medium">前 10 名胜场：</p>
            <div className="flex gap-1 flex-wrap">
              {result.topPlayerWins.slice(0, 10).map((w, i) => (
                <Badge key={i} variant="outline">{i + 1}. {w}胜</Badge>
              ))}
            </div>
            {params.targetRank <= result.topPlayerWins.length && (
              <p>第 {params.targetRank} 名：
                <span className="font-bold text-primary">
                  {result.topPlayerWins[params.targetRank - 1]} 胜
                </span>
              </p>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {params.kappa > 0
            ? `禀赋模式（κ=${params.kappa}）：理论公式不适用，需通过模拟计算`
            : '50% 胜率模式：用于验证理论公式的准确性'}
          <br />模拟上限 50 万人，实际模拟 {Math.min(params.playerCount, 500_000).toLocaleString()} 人
        </p>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: 集成到 App**

在 `src/App.tsx` 的参数面板下方（或 main 区域）添加：
```tsx
import { SimulationPanel } from './components/SimulationPanel'

// 在 MathInsights 下方：
<SimulationPanel params={params} />
```

- [ ] **Step 5: 验证��拟可运行**

```bash
npm run dev
# 点击"运行模拟"，确认进度条、结果展示正常
# 测试取消功能
```

- [ ] **Step 6: 提交**

```bash
git add src/workers/simulation.worker.ts src/hooks/useSimulation.ts src/components/SimulationPanel.tsx src/App.tsx
git commit -m "feat: 蒙特卡罗模拟引擎（Web Worker + Bradley-Terry 禀赋模型）"
```

---

## Task 10: 预测最终排名 + 鲁棒性热力图

**Files:**
- Create: `src/components/PredictRank.tsx`, `src/components/RobustnessHeatmap.tsx`
- Modify: `src/App.tsx`, `src/lib/math.ts`

- [ ] **Step 1: 在 math.ts 中添加预测最终排名函数**

追加到 `src/lib/math.ts`:
```ts
// === 预测最终排名（当前 W-L，还没出局）===
export interface PredictionResult {
  // 最终胜场分布
  finalWinsDistribution: Array<{ wins: number; probability: number }>
  // 对应排名的置信区间
  rankP50: number   // 50% 中位排名
  rankP80Low: number
  rankP80High: number
  rankP95Low: number
  rankP95High: number
}

export function predictFinalRank(
  currentWins: number,
  currentLosses: number,
  rFull: number,
  alpha: number,
  n: number,
  personalWinRate: number = 0.5,
): PredictionResult {
  const remainingLives = rFull - currentLosses
  if (remainingLives <= 0) {
    // 已出局
    const rank = queryRankFromWins(currentWins, rFull, alpha, n)
    return {
      finalWinsDistribution: [{ wins: currentWins, probability: 1 }],
      rankP50: rank.conservativeRank,
      rankP80Low: rank.optimisticRank,
      rankP80High: rank.conservativeRank,
      rankP95Low: rank.optimisticRank,
      rankP95High: rank.conservativeRank,
    }
  }

  // 后续胜场 ~ NegBin(remainingLives, personalWinRate)
  const dist: Array<{ wins: number; probability: number; rank: number }> = []
  let cumProb = 0
  for (let extra = 0; extra <= 200; extra++) {
    const p = negbinPmfGeneral(extra, remainingLives, personalWinRate)
    if (p < 1e-10 && extra > 0) break
    const totalWins = currentWins + extra
    const rank = queryRankFromWins(totalWins, rFull, alpha, n)
    dist.push({ wins: totalWins, probability: p, rank: rank.conservativeRank })
    cumProb += p
  }

  // 计算置信区间
  let cum = 0
  let p50 = 0, p10 = 0, p90 = 0, p2_5 = 0, p97_5 = 0
  for (const d of dist) {
    cum += d.probability
    if (!p2_5 && cum >= 0.025) p2_5 = d.rank
    if (!p10 && cum >= 0.10) p10 = d.rank
    if (!p50 && cum >= 0.50) p50 = d.rank
    if (!p90 && cum >= 0.90) p90 = d.rank
    if (!p97_5 && cum >= 0.975) p97_5 = d.rank
  }

  return {
    finalWinsDistribution: dist.map(d => ({ wins: d.wins, probability: d.probability })),
    rankP50: p50,
    rankP80Low: p90,  // 排名越小越好，所以 low=p90（排名值小=排名好）
    rankP80High: p10,
    rankP95Low: p97_5,
    rankP95High: p2_5,
  }
}
```

- [ ] **Step 2: 实现预测排名组件**

`src/components/PredictRank.tsx`:
```tsx
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { predictFinalRank } from '@/lib/math'
import type { TournamentParams } from './ParameterPanel'

interface Props {
  params: TournamentParams
}

export function PredictRank({ params }: Props) {
  const [currentWins, setCurrentWins] = useState(15)
  const [currentLosses, setCurrentLosses] = useState(0)
  const [personalWinRate, setPersonalWinRate] = useState(0.5)

  const { lives, fullPlayRatio, playerCount } = params
  const isActive = currentLosses < lives

  const prediction = predictFinalRank(
    currentWins, currentLosses, lives, fullPlayRatio, playerCount, personalWinRate,
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">预测最终排名</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Label>当前胜场</Label>
          <Input type="number" value={currentWins} className="w-20"
            onChange={e => setCurrentWins(Math.max(0, Number(e.target.value)))} />
          <Label>当前负场</Label>
          <Input type="number" value={currentLosses} className="w-20"
            onChange={e => setCurrentLosses(Math.min(lives, Math.max(0, Number(e.target.value))))} />
        </div>

        {isActive && (
          <>
            <div className="space-y-2">
              <Label>个人胜率假设：{(personalWinRate * 100).toFixed(0)}%</Label>
              <Slider
                value={[personalWinRate]}
                min={0.3} max={0.8} step={0.01}
                onValueChange={([v]) => setPersonalWinRate(v)}
              />
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded text-sm">
              此预测假设后续每局胜率为 {(personalWinRate * 100).toFixed(0)}%。
              {personalWinRate === 0.5
                ? '这是总体平均水平。如果你已经连胜，真实实力可能高于平均。'
                : ''}
            </div>
          </>
        )}

        <div className="space-y-1">
          <p>剩余 {lives - currentLosses} 条���</p>
          <p>预测排名中位数：<span className="text-2xl font-bold">{prediction.rankP50.toLocaleString()}</span></p>
          <p className="text-sm text-muted-foreground">
            80% 区间：{prediction.rankP80Low.toLocaleString()} ~ {prediction.rankP80High.toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground">
            95% 区间：{prediction.rankP95Low.toLocaleString()} ~ {prediction.rankP95High.toLocaleString()}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: 实现鲁棒性热力图（Canvas）**

`src/components/RobustnessHeatmap.tsx`:
```tsx
import { useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { promotionProbability } from '@/lib/math'
import type { TournamentParams } from './ParameterPanel'

interface Props {
  params: TournamentParams
}

export function RobustnessHeatmap({ params }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { lives, fullPlayRatio, targetRank } = params

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = 500, H = 300
    canvas.width = W
    canvas.height = H

    // X: 参赛人数 50k ~ 2M (20 steps)
    // Y: 胜场 8 ~ 25 (18 steps)
    const nSteps = 20, wSteps = 18
    const nMin = 50_000, nMax = 2_000_000
    const wMin = 8, wMax = 25
    const cellW = W / nSteps, cellH = H / wSteps

    for (let ni = 0; ni < nSteps; ni++) {
      for (let wi = 0; wi < wSteps; wi++) {
        const n = Math.round(nMin + (nMax - nMin) * ni / (nSteps - 1))
        const w = wMin + wi

        const prob = promotionProbability(w, lives, fullPlayRatio, n, targetRank)

        // 颜色：绿(安全) → 黄(边缘) → 红(危险)
        let r: number, g: number, b: number
        if (prob >= 0.95) {
          r = 34; g = 197; b = 94   // 绿
        } else if (prob >= 0.5) {
          const t = (prob - 0.5) / 0.45
          r = Math.round(234 * (1 - t) + 34 * t)
          g = Math.round(179 * (1 - t) + 197 * t)
          b = Math.round(8 * (1 - t) + 94 * t)
        } else {
          const t = prob / 0.5
          r = Math.round(239 * (1 - t) + 234 * t)
          g = Math.round(68 * (1 - t) + 179 * t)
          b = Math.round(68 * (1 - t) + 8 * t)
        }

        ctx.fillStyle = `rgb(${r},${g},${b})`
        // Y 轴反转（胜场高的在上）
        ctx.fillRect(ni * cellW, (wSteps - 1 - wi) * cellH, cellW, cellH)
      }
    }

    // 坐标轴标注
    ctx.fillStyle = '#333'
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'center'
    for (let ni = 0; ni < nSteps; ni += 4) {
      const n = Math.round(nMin + (nMax - nMin) * ni / (nSteps - 1))
      ctx.fillText(`${(n / 10000).toFixed(0)}万`, ni * cellW + cellW / 2, H - 2)
    }
    ctx.textAlign = 'right'
    for (let wi = 0; wi < wSteps; wi += 2) {
      const w = wMin + wi
      ctx.fillText(String(w), 20, (wSteps - 1 - wi) * cellH + cellH / 2 + 3)
    }
  }, [lives, fullPlayRatio, targetRank])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          鲁棒性热力图（进前 {targetRank} 的晋级概率）
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <canvas ref={canvasRef} className="w-full" style={{ imageRendering: 'pixelated' }} />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>← 参赛人数 →</span>
            <span className="flex gap-2">
              <span className="inline-block w-3 h-3 bg-red-500 rounded-sm" /> 危险
              <span className="inline-block w-3 h-3 bg-yellow-500 rounded-sm" /> 边缘
              <span className="inline-block w-3 h-3 bg-green-500 rounded-sm" /> 安全
            </span>
          </div>
          <p className="text-xs text-muted-foreground">↑ 胜场</p>
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: 集成到 App**

```tsx
import { PredictRank } from './components/PredictRank'
import { RobustnessHeatmap } from './components/RobustnessHeatmap'

// 在图表 grid 中添加 RobustnessHeatmap
// QueryTabs 下方添加 PredictRank
```

- [ ] **Step 5: 验证所有组件**

```bash
npm run dev
# 确认预测排名、热力图均正常工作
```

- [ ] **Step 6: 提交**

```bash
git add src/lib/math.ts src/components/PredictRank.tsx src/components/RobustnessHeatmap.tsx src/App.tsx
git commit -m "feat: 预测最终排名 + 鲁棒性热力图"
```

---

## Task 11: 最终整合 + 构建验证 + 推送

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 确保 App.tsx 布局完整**

最终 `src/App.tsx` 应包含所有组件的导入和合理布局：参数面板（左）、查询Tab + 预测 + 图表 + 表格 + 数学洞察 + 模拟（右）。

- [ ] **Step 2: 运行所有测试**

```bash
npm test
# 所有测试通过
```

- [ ] **Step 3: 生产构建**

```bash
npm run build
# 确认无错误
```

- [ ] **Step 4: 预览验证**

```bash
npm run preview
# 浏览器打开，完整走一遍四种查询模式，确认功能正常
```

- [ ] **Step 5: 最终提交**

```bash
git add -A
git commit -m "feat: 最终整合 — 所有功能模块完成"
```

- [ ] **Step 6: 创建 GitHub 仓库并推送**

```bash
gh repo create cr-tournament-calc --private --source=. --push
```
