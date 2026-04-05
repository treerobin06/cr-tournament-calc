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
      <div className="cr-card">
        <h3 className="section-title text-base mb-4">关键排名节点（95% 置信胜场数）</h3>
        <div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-black bg-gray-50">
                  <th className="text-left py-2 pr-4 text-xs font-bold uppercase tracking-wider text-gray-900">目标名次</th>
                  {KEY_RANKS.map((rank) => (
                    <th key={rank} className="text-center py-2 px-2 text-xs font-bold uppercase tracking-wider text-gray-900">
                      前 {rank >= 1000 ? `${rank / 1000}k` : rank}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-1.5 pr-4 text-gray-500">95% 安全胜场</td>
                  {keyNodes.map(({ rank, safeWins }) => (
                    <td
                      key={rank}
                      className={`text-center py-1.5 px-2 font-bold ${
                        rank === params.targetRank ? "text-amber-600 bg-amber-50" : "text-gray-900"
                      }`}
                    >
                      {safeWins} 胜
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 完整分布表 */}
      <div className="cr-card">
        <h3 className="section-title text-base mb-4">完整分布表</h3>
        <div>
          <div className="overflow-auto max-h-80">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50">
                <tr className="border-b-2 border-black">
                  <th className="text-right py-2 pr-3 text-xs font-bold uppercase tracking-wider text-gray-900">胜场</th>
                  <th className="text-right py-2 pr-3 text-xs font-bold uppercase tracking-wider text-gray-900">预期人数</th>
                  <th className="text-right py-2 pr-3 text-xs font-bold uppercase tracking-wider text-gray-900">累计人数</th>
                  <th className="text-right py-2 pr-3 text-xs font-bold uppercase tracking-wider text-gray-900">累计概率</th>
                  <th className="text-right py-2 text-xs font-bold uppercase tracking-wider text-gray-900">衰减比</th>
                </tr>
              </thead>
              <tbody>
                {distribution
                  .filter((row) => row.count >= 0.5)
                  .map((row) => {
                  // 绿色高亮：tailCount <= targetRank 的行（这些人能晋级）
                  const origIdx = distribution.indexOf(row)
                  const isHighlighted = origIdx >= targetRankIdx && targetRankIdx >= 0
                  return (
                    <tr
                      key={row.wins}
                      className={`border-b border-gray-200 transition-colors duration-150 hover:bg-amber-50 ${
                        isHighlighted
                          ? "bg-emerald-50 border-l-3 border-l-emerald-500"
                          : row.wins % 2 === 0
                          ? "bg-gray-50"
                          : ""
                      }`}
                    >
                      <td className="text-right py-1 pr-3 font-medium text-gray-900">{row.wins}</td>
                      <td className="text-right py-1 pr-3 text-gray-500">
                        {Math.round(row.count).toLocaleString()}
                      </td>
                      <td className={`text-right py-1 pr-3 font-medium ${isHighlighted ? "text-emerald-600" : "text-gray-700"}`}>
                        {Math.round(row.tailCount).toLocaleString()}
                      </td>
                      <td className="text-right py-1 pr-3 text-gray-500">
                        {(row.tailProb * 100).toFixed(2)}%
                      </td>
                      <td className="text-right py-1 text-gray-500">
                        {isNaN(row.decayRatio) ? "—" : `${(row.decayRatio * 100).toFixed(1)}%`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            绿色高亮行：累计人数 ≤ 目标排名（{params.targetRank.toLocaleString()}），即该胜场可晋级
          </p>
        </div>
      </div>
    </div>
  )
}
