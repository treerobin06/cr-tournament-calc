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
  const [playerCount, setPlayerCount] = useState(240000)
  const [targetRank, setTargetRank] = useState(900)

  const distribution = useMemo(() => {
    const { rFull, alpha } = paramsToMathArgs(params)
    return computeDistribution(rFull, playerCount, alpha, params.cheaterRatio, 12)
  }, [params, playerCount])

  // 找到目标排名对应的胜场数（用于图表标注）
  const targetWins = useMemo(() => {
    const row = distribution.find((r) => r.tailCount <= targetRank)
    return row?.wins
  }, [distribution, targetRank])

  return (
    <div className="min-h-screen">
      {/* 金色装饰条 */}
      <div className="gold-bar" />

      {/* Header */}
      <header className="px-4 sm:px-8 py-6 bg-white/80 backdrop-blur-sm border-b-2 border-black">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold section-title">
              ⚔️ 皇室战争锦标赛排名计算器
            </h1>
            <p className="text-sm mt-2 font-medium" style={{fontFamily: "'Poppins', sans-serif"}}>
              <span className="inline-block bg-amber-100 text-amber-800 border border-amber-300 rounded-full px-3 py-0.5 mr-2 text-xs font-bold">理论估算</span>
              基于负二项分布 · 输出为参考区间
              <span className="mx-2 text-gray-300">|</span>
              <span className="text-gray-400">非精确预测，实际排名受多种因素影响</span>
            </p>
          </div>
        </div>
      </header>

      {/* Main Layout — 窄屏垂直堆叠，宽屏侧边栏 */}
      <div className="w-full px-4 sm:px-8 py-6 flex flex-col lg:flex-row gap-8">
        {/* Left Sidebar: ParameterPanel + 共享参数 */}
        <aside className="w-full lg:w-80 shrink-0 lg:sticky lg:top-4 lg:self-start space-y-4">
          {/* 核心参数（控制所有 Tab 和图表） */}
          <div className="cr-card p-5">
            <h2 className="text-lg font-bold mb-4" style={{fontFamily: "'Righteous', sans-serif"}}>核心参数</h2>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">参赛人数</label>
                <input
                  type="number"
                  value={playerCount}
                  min={1000}
                  max={5000000}
                  onChange={e => setPlayerCount(Math.max(1000, Number(e.target.value)))}
                  className="w-full h-9 text-sm"
                />
                <p className="text-xs text-gray-400">{playerCount.toLocaleString()} 人参赛</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">目标排名</label>
                <input
                  type="number"
                  value={targetRank}
                  min={1}
                  max={100000}
                  onChange={e => setTargetRank(Math.max(1, Number(e.target.value)))}
                  className="w-full h-9 text-sm"
                />
                <p className="text-xs text-gray-400">进入前 {targetRank} 名</p>
              </div>
            </div>
          </div>
          {/* 模型参数 */}
          <ParameterPanel params={params} onChange={setParams} />
        </aside>

        {/* Right Main Area */}
        <main className="flex-1 min-w-0 space-y-8">

          {/* Query Tabs */}
          <section>
            <QueryTabs params={params} playerCount={playerCount} targetRank={targetRank} />
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
              <CumulativeRankChart distribution={distribution} targetRank={targetRank} />
            </div>
          </section>

          {/* 次要图表（衰减比 + 热力图） */}
          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="cr-card">
              <DecayRatioChart distribution={distribution} />
            </div>
            <RobustnessHeatmap params={params} targetRank={targetRank} />
          </section>

          {/* Data Table */}
          <section>
            <DataTable distribution={distribution} params={params} targetRank={targetRank} />
          </section>

          {/* Monte Carlo Simulation */}
          <section>
            <SimulationPanel params={params} playerCount={playerCount} targetRank={targetRank} />
          </section>

          {/* Math Insights */}
          <section>
            <MathInsights />
          </section>
        </main>
      </div>
    </div>
  )
}

export default App
