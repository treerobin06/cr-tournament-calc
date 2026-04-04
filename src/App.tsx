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
import { computeDistribution } from "@/lib/math"
import { Card, CardContent } from "@/components/ui/card"

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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-baseline gap-4">
          <h1 className="text-xl font-bold tracking-tight">
            皇室战争锦标赛排名计算器
          </h1>
          <span className="text-xs text-muted-foreground hidden sm:block">
            基于负二项分布的理论模型 · 仅供参考，实际结果可能因游戏机制变动而偏差
          </span>
        </div>
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

          {/* 2×2 Chart Grid */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-4">
                <DistributionChart distribution={distribution} targetWins={targetWins} />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <CumulativeRankChart distribution={distribution} targetRank={params.targetRank} />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <DecayRatioChart distribution={distribution} />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="space-y-2">
                  <span className="text-sm font-medium">当前参数摘要</span>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">参与人数</div>
                    <div className="font-medium text-right">{params.playerCount.toLocaleString()}</div>
                    <div className="text-muted-foreground">命数</div>
                    <div className="font-medium text-right">{params.lives} 命</div>
                    <div className="text-muted-foreground">满局率</div>
                    <div className="font-medium text-right">{(params.fullPlayRatio * 100).toFixed(0)}%</div>
                    <div className="text-muted-foreground">有效人数</div>
                    <div className="font-medium text-right">
                      {Math.round(params.playerCount * params.fullPlayRatio).toLocaleString()}
                    </div>
                    <div className="text-muted-foreground">目标排名</div>
                    <div className="font-medium text-right text-green-600">前 {params.targetRank.toLocaleString()}</div>
                    <div className="text-muted-foreground">κ 参数</div>
                    <div className="font-medium text-right">{params.kappa.toFixed(2)}</div>
                    <div className="text-muted-foreground">rFull / α</div>
                    <div className="font-medium text-right">
                      {(() => {
                        const { rFull, alpha } = paramsToMathArgs(params)
                        return `${rFull} / ${alpha.toFixed(3)}`
                      })()}
                    </div>
                    {targetWins !== undefined && (
                      <>
                        <div className="text-muted-foreground">95% 安全胜场</div>
                        <div className="font-bold text-right text-green-600">{targetWins} 胜</div>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
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
