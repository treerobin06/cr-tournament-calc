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
      <div className="rounded-2xl bg-[#1E1C35] border border-purple-900/40 p-5">
        <h3 className="text-lg font-bold text-amber-400 mb-3" style={{fontFamily:'Fredoka'}}>关键排名节点（95% 置信胜场数）</h3>
        <div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1.5 pr-4 font-medium text-slate-400">目标名次</th>
                  {KEY_RANKS.map((rank) => (
                    <th key={rank} className="text-center py-1.5 px-2 font-medium text-slate-400">
                      前 {rank >= 1000 ? `${rank / 1000}k` : rank}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-1.5 pr-4 text-slate-400">95% 安全胜场</td>
                  {keyNodes.map(({ rank, safeWins }) => (
                    <td
                      key={rank}
                      className={`text-center py-1.5 px-2 font-bold ${
                        rank === params.targetRank ? "text-amber-400 bg-amber-500/10" : "text-slate-200"
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
      <div className="rounded-2xl bg-[#1E1C35] border border-purple-900/40 p-5">
        <h3 className="text-lg font-bold text-amber-400 mb-3" style={{fontFamily:'Fredoka'}}>完整分布表</h3>
        <div>
          <div className="overflow-auto max-h-80">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[#1E1C35]">
                <tr className="border-b border-purple-900/40">
                  <th className="text-right py-1.5 pr-3 font-medium text-slate-400">胜场</th>
                  <th className="text-right py-1.5 pr-3 font-medium text-slate-400">预期人数</th>
                  <th className="text-right py-1.5 pr-3 font-medium text-slate-400">累计人数</th>
                  <th className="text-right py-1.5 pr-3 font-medium text-slate-400">累计概率</th>
                  <th className="text-right py-1.5 font-medium text-slate-400">衰减比</th>
                </tr>
              </thead>
              <tbody>
                {distribution.map((row, idx) => {
                  // 绿色高亮：tailCount <= targetRank 的行（这些人能晋级）
                  const isHighlighted = idx >= targetRankIdx && targetRankIdx >= 0
                  return (
                    <tr
                      key={row.wins}
                      className={`border-b border-purple-900/20 ${
                        isHighlighted
                          ? "bg-emerald-500/10"
                          : idx % 2 === 0
                          ? "bg-white/[0.02]"
                          : ""
                      }`}
                    >
                      <td className="text-right py-1 pr-3 font-medium text-slate-200">{row.wins}</td>
                      <td className="text-right py-1 pr-3 text-slate-400">
                        {Math.round(row.count).toLocaleString()}
                      </td>
                      <td className={`text-right py-1 pr-3 font-medium ${isHighlighted ? "text-emerald-400" : "text-slate-300"}`}>
                        {Math.round(row.tailCount).toLocaleString()}
                      </td>
                      <td className="text-right py-1 pr-3 text-slate-400">
                        {(row.tailProb * 100).toFixed(2)}%
                      </td>
                      <td className="text-right py-1 text-slate-400">
                        {isNaN(row.decayRatio) ? "—" : `${(row.decayRatio * 100).toFixed(1)}%`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            绿色高亮行：累计人数 ≤ 目标排名（{params.targetRank.toLocaleString()}），即该胜场可晋级
          </p>
        </div>
      </div>
    </div>
  )
}
