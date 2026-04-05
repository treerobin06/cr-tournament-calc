import { useState, useMemo } from "react"
import { ParameterPanel, DEFAULT_PARAMS, paramsToMathArgs, logScale, inverseLogScale } from "@/components/ParameterPanel"
import type { TournamentParams } from "@/components/ParameterPanel"
import { QueryTabs } from "@/components/QueryTabs"
import { DistributionChart } from "@/components/DistributionChart"
import { CumulativeRankChart } from "@/components/CumulativeRankChart"
import { DecayRatioChart } from "@/components/DecayRatioChart"
import { DataTable } from "@/components/DataTable"
import { MathInsights } from "@/components/MathInsights"
import { SimulationPanel } from "@/components/SimulationPanel"
import { PredictRank } from "@/components/PredictRank"
import { RobustnessHeatmap } from "@/components/RobustnessHeatmap"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { computeDistribution } from "@/lib/math"
// 对数滑块常量
const PLAYER_LOG_MIN = 1000
const PLAYER_LOG_MAX = 5000000

function App() {
  const [params, setParams] = useState<TournamentParams>(DEFAULT_PARAMS)

  const distribution = useMemo(() => {
    const { rFull, alpha, n } = paramsToMathArgs(params)
    return computeDistribution(rFull, n, alpha)
  }, [params])

  // 找到目标排名对应的胜场数
  const targetWins = useMemo(() => {
    const row = distribution.find((r) => r.tailCount <= params.targetRank)
    return row?.wins
  }, [distribution, params.targetRank])

  const updateParams = (partial: Partial<TournamentParams>) => {
    setParams(prev => ({ ...prev, ...partial }))
  }

  // 对数滑块当前位置
  const playerSliderVal = inverseLogScale(params.playerCount, PLAYER_LOG_MIN, PLAYER_LOG_MAX)

  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* 金色装饰条 */}
      <div className="gold-bar" />

      {/* Header */}
      <header className="px-4 sm:px-8 py-6 bg-white/80 backdrop-blur-sm border-b-2 border-black">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold section-title">
              ⚔️ 皇室战争锦标赛排名计算器
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              基于负二项分布的理论估算 · 输出为参考区间，非精确预测
            </p>
          </div>
        </div>
      </header>

      {/* Main Layout — 窄屏垂直堆叠，宽屏侧边栏 */}
      <div className="w-full px-4 sm:px-8 py-6 flex flex-col lg:flex-row gap-8">
        {/* Left Sidebar: ParameterPanel */}
        <aside className="w-full lg:w-80 shrink-0">
          <ParameterPanel params={params} onChange={setParams} />
        </aside>

        {/* Right Main Area */}
        <main className="flex-1 min-w-0 space-y-8">
          {/* 参赛人数 & 目标排名 — 查询区域输入栏 */}
          <section className="cr-card">
            <div className="flex items-start gap-8 flex-wrap">
              {/* 参赛人数 */}
              <div className="flex-1 min-w-[280px] space-y-2">
                <div className="flex items-center gap-3">
                  <label className="text-xs font-medium tracking-wide uppercase text-gray-500 whitespace-nowrap">参赛人数</label>
                  <span className="text-lg font-semibold text-gray-900">{params.playerCount.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Slider
                    className="flex-1"
                    min={0}
                    max={1}
                    step={0.001}
                    value={[playerSliderVal]}
                    onValueChange={([v]) => updateParams({ playerCount: logScale(v, PLAYER_LOG_MIN, PLAYER_LOG_MAX) })}
                    aria-label="参赛人数"
                  />
                  <Input
                    type="number"
                    value={params.playerCount}
                    min={1000}
                    max={5000000}
                    onChange={(e) => {
                      const v = parseInt(e.target.value)
                      if (!isNaN(v) && v >= 1000 && v <= 5000000) {
                        updateParams({ playerCount: v })
                      }
                    }}
                    className="w-28 h-8 text-sm"
                    aria-label="参赛人数（精确输入）"
                  />
                </div>
              </div>
              {/* 目标排名 */}
              <div className="space-y-2">
                <label className="text-xs font-medium tracking-wide uppercase text-gray-500 whitespace-nowrap">目标排名</label>
                <Input
                  type="number"
                  value={params.targetRank}
                  min={1}
                  max={100000}
                  onChange={(e) => {
                    const v = parseInt(e.target.value)
                    if (!isNaN(v) && v >= 1) updateParams({ targetRank: v })
                  }}
                  className="w-28 h-8 text-sm"
                />
              </div>
            </div>
          </section>

          {/* Query Tabs */}
          <section>
            <QueryTabs params={params} />
          </section>

          {/* 预测最终排名 */}
          <section>
            <PredictRank params={params} />
          </section>

          {/* 主要图表（分布 + 累计排名）— 全宽两列 */}
          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="cr-card">
              <DistributionChart distribution={distribution} targetWins={targetWins} />
            </div>
            <div className="cr-card">
              <CumulativeRankChart distribution={distribution} targetRank={params.targetRank} />
            </div>
          </section>

          {/* 次要图表（衰减比 + 热力图） */}
          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="cr-card">
              <DecayRatioChart distribution={distribution} />
            </div>
            <RobustnessHeatmap params={params} />
          </section>

          {/* Data Table */}
          <section>
            <DataTable distribution={distribution} params={params} />
          </section>

          {/* Math Insights */}
          <section>
            <MathInsights />
          </section>

          {/* Monte Carlo Simulation */}
          <section>
            <SimulationPanel params={params} />
          </section>
        </main>
      </div>
    </div>
  )
}

export default App
