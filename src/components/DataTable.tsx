import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import type { DistributionRow } from "@/lib/math"
import { queryWinsToRank } from "@/lib/math"
import type { TournamentParams } from "@/components/ParameterPanel"
import { paramsToMathArgs } from "@/components/ParameterPanel"

interface DataTableProps {
  distribution: DistributionRow[]
  params: TournamentParams
}

const KEY_RANKS = [100, 500, 900, 1000, 5000, 10000]

export function DataTable({ distribution, params }: DataTableProps) {
  const { rFull, alpha, n } = paramsToMathArgs(params)

  // 关键节点：每个目标名次对应的最低胜场
  const keyNodes = KEY_RANKS.map((rank) => {
    const result = queryWinsToRank(rFull, alpha, n, rank, 0.95)
    return { rank, safeWins: result.safeWins }
  })

  // 找到 targetRank 对应 tailCount 的分布行索引
  const targetRankIdx = distribution.findIndex((row) => row.tailCount <= params.targetRank)

  return (
    <div className="space-y-6">
      {/* 关键节点表 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">关键排名节点（95% 置信胜场数）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1.5 pr-4 font-medium text-muted-foreground">目标名次</th>
                  {KEY_RANKS.map((rank) => (
                    <th key={rank} className="text-center py-1.5 px-2 font-medium text-muted-foreground">
                      前 {rank >= 1000 ? `${rank / 1000}k` : rank}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-1.5 pr-4 text-muted-foreground">95% 安全胜场</td>
                  {keyNodes.map(({ rank, safeWins }) => (
                    <td
                      key={rank}
                      className={`text-center py-1.5 px-2 font-bold ${
                        rank === params.targetRank ? "text-green-600 bg-green-50 dark:bg-green-950/20" : ""
                      }`}
                    >
                      {safeWins} 胜
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 完整分布表 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">完整分布表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto max-h-80">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b">
                  <th className="text-right py-1.5 pr-3 font-medium text-muted-foreground">胜场</th>
                  <th className="text-right py-1.5 pr-3 font-medium text-muted-foreground">预期人数</th>
                  <th className="text-right py-1.5 pr-3 font-medium text-muted-foreground">累计人数</th>
                  <th className="text-right py-1.5 pr-3 font-medium text-muted-foreground">累计概率</th>
                  <th className="text-right py-1.5 font-medium text-muted-foreground">衰减比</th>
                </tr>
              </thead>
              <tbody>
                {distribution.map((row, idx) => {
                  // 绿色高亮：tailCount <= targetRank 的行（这些人能晋级）
                  const isHighlighted = idx >= targetRankIdx && targetRankIdx >= 0
                  return (
                    <tr
                      key={row.wins}
                      className={`border-b border-muted/40 ${
                        isHighlighted
                          ? "bg-green-50 dark:bg-green-950/20"
                          : idx % 2 === 0
                          ? "bg-muted/20"
                          : ""
                      }`}
                    >
                      <td className="text-right py-1 pr-3 font-medium">{row.wins}</td>
                      <td className="text-right py-1 pr-3 text-muted-foreground">
                        {Math.round(row.count).toLocaleString()}
                      </td>
                      <td className={`text-right py-1 pr-3 font-medium ${isHighlighted ? "text-green-700 dark:text-green-400" : ""}`}>
                        {Math.round(row.tailCount).toLocaleString()}
                      </td>
                      <td className="text-right py-1 pr-3 text-muted-foreground">
                        {(row.tailProb * 100).toFixed(2)}%
                      </td>
                      <td className="text-right py-1 text-muted-foreground">
                        {isNaN(row.decayRatio) ? "—" : `${(row.decayRatio * 100).toFixed(1)}%`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            绿色高亮行：累计人数 ≤ 目标排名（{params.targetRank.toLocaleString()}），即该胜场可晋级
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
