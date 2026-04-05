import { useState, useMemo } from "react"
import { ParameterPanel, DEFAULT_PARAMS, paramsToMathArgs } from "@/components/ParameterPanel"
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
import { computeDistribution } from "@/lib/math"

function App() {
  const [params, setParams] = useState<TournamentParams>(DEFAULT_PARAMS)

  const distribution = useMemo(() => {
    const { rFull, alpha, n } = paramsToMathArgs(params)
    return computeDistribution(rFull, n, alpha)
  }, [params])

  // 找到目标排名对应的胜场数（用于图表标注）
  const targetWins = useMemo(() => {
    const row = distribution.find((r) => r.tailCount <= params.targetRank)
    return row?.wins
  }, [distribution, params.targetRank])

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
          {/* Query Tabs — 每个 Tab 自带独立输入 */}
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
