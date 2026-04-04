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

  // 找到目标排名对应的胜场数
  const targetWins = useMemo(() => {
    const row = distribution.find((r) => r.tailCount <= params.targetRank)
    return row?.wins
  }, [distribution, params.targetRank])

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="px-6 py-5 border-b border-purple-900/30">
        <h1 className="text-3xl font-bold text-amber-400" style={{fontFamily:'Fredoka'}}>
          皇室战争锦标赛排名计算器
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          基于负二项分布的理论估算 · 输出为参考区间，非精确预测
        </p>
      </header>

      {/* Main Layout */}
      <div className="max-w-screen-2xl mx-auto px-4 py-4 flex gap-4">
        {/* Left Sidebar: ParameterPanel */}
        <aside className="w-72 shrink-0">
          <ParameterPanel params={params} onChange={setParams} />
        </aside>

        {/* Right Main Area */}
        <main className="flex-1 min-w-0 space-y-6">
          {/* Query Tabs */}
          <section>
            <QueryTabs params={params} />
          </section>

          {/* 预测最终排名 */}
          <section>
            <PredictRank params={params} />
          </section>

          {/* 2×2 Chart Grid */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-[#1E1C35] border border-purple-900/40 p-5">
              <DistributionChart distribution={distribution} targetWins={targetWins} />
            </div>
            <div className="rounded-2xl bg-[#1E1C35] border border-purple-900/40 p-5">
              <CumulativeRankChart distribution={distribution} targetRank={params.targetRank} />
            </div>
            <div className="rounded-2xl bg-[#1E1C35] border border-purple-900/40 p-5">
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
