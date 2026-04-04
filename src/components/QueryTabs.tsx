import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  queryRankFromWins,
  queryWinsToRank,
  querySafePlayerCount,
  promotionProbability,
} from "@/lib/math"
import type { TournamentParams } from "@/components/ParameterPanel"
import { paramsToMathArgs } from "@/components/ParameterPanel"

interface QueryTabsProps {
  params: TournamentParams
}

const TABS = [
  { id: 'mode1', label: '胜场 → 排名' },
  { id: 'mode2', label: '名次 → 胜场' },
  { id: 'mode3', label: '鲁棒性分析' },
  { id: 'mode4', label: '安全人数' },
]

export function QueryTabs({ params }: QueryTabsProps) {
  const { rFull, alpha, n } = paramsToMathArgs(params)
  const [activeTab, setActiveTab] = useState('mode1')

  // 模式1：胜场→排名
  const [wins1, setWins1] = useState(12)
  // 模式3：鲁棒性分析
  const [wins3, setWins3] = useState(12)
  const [nMin, setNMin] = useState(100000)
  const [nMax, setNMax] = useState(500000)
  // 模式4：安全人数
  const [wins4, setWins4] = useState(12)

  // 模式1 计算
  const rankResult =
    wins1 >= 0
      ? queryRankFromWins(wins1, rFull, alpha, n)
      : null

  const promoProb =
    wins1 >= 0
      ? promotionProbability(wins1, rFull, alpha, n, params.targetRank)
      : 0

  // 模式2：名次→胜场
  const winsToRankResult = queryWinsToRank(rFull, alpha, n, params.targetRank, 0.95)

  // 模式3：N 范围扫描（10 点）
  const sweepPoints: Array<{
    N: number
    prob: number
    safe: boolean
  }> = (() => {
    if (nMin >= nMax) return []
    const step = (nMax - nMin) / 9
    return Array.from({ length: 10 }, (_, i) => {
      const N = Math.round(nMin + i * step)
      const prob = promotionProbability(wins3, rFull, alpha, N, params.targetRank)
      return { N, prob, safe: prob >= 0.95 }
    })
  })()

  // 模式4：安全人数
  const safeCount =
    wins4 >= 0
      ? querySafePlayerCount(wins4, rFull, alpha, params.targetRank, 0.95)
      : null

  return (
    <div className="space-y-3">
      {/* Tab Bar */}
      <div className="flex gap-2 p-2 rounded-2xl bg-[#15132a]">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex-1 py-3 px-4 rounded-xl font-bold transition-all duration-200 cursor-pointer
              ${activeTab === tab.id
                ? 'bg-amber-500/25 text-amber-400 text-lg border border-amber-500/50 shadow-lg shadow-amber-500/15'
                : 'text-slate-400 text-base hover:text-slate-200 hover:bg-white/5 border border-transparent'
              }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2/3 h-0.5 bg-amber-400 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* 模式1：给定胜场，查询期望排名 */}
      {activeTab === 'mode1' && (
        <div className="rounded-2xl bg-[#1E1C35] border border-purple-900/40 p-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mode1-wins-input" className="text-slate-300 font-semibold">胜场数</Label>
            <Input
              id="mode1-wins-input"
              type="number"
              min={0}
              max={100}
              value={wins1}
              onChange={(e) => setWins1(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-32 h-8"
            />
          </div>

          {rankResult && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-purple-900/40 p-3 text-center">
                  <div className="text-2xl font-extrabold text-amber-400">
                    #{rankResult.optimisticRank.toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">乐观排名（期望）</div>
                </div>
                <div className="rounded-xl border border-purple-900/40 p-3 text-center">
                  <div className="text-2xl font-extrabold text-amber-400">
                    #{rankResult.conservativeRank.toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">保守排名（95% 置信）</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">晋级概率：</span>
                <Badge
                  variant={promoProb >= 0.95 ? "default" : promoProb >= 0.5 ? "secondary" : "destructive"}
                  className={`text-sm ${promoProb >= 0.95 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : promoProb >= 0.5 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}
                >
                  {(promoProb * 100).toFixed(1)}%
                </Badge>
                <span className="text-xs text-slate-400">
                  （进入前 {params.targetRank.toLocaleString()} 名）
                </span>
              </div>

              <div className="text-sm text-slate-400">
                百分位：你超过了{" "}
                <strong className="text-slate-200">{rankResult.percentile.toFixed(1)}%</strong> 的玩家
              </div>
            </div>
          )}
        </div>
      )}

      {/* 模式2：名次→胜场，概率条 */}
      {activeTab === 'mode2' && (
        <div className="rounded-2xl bg-[#1E1C35] border border-purple-900/40 p-5 space-y-3">
          <div className="text-sm text-slate-400">
            目标排名：<strong className="text-slate-200">前 {params.targetRank.toLocaleString()} 名</strong>
            所需胜场分析（95% 安全胜场：
            <strong className="text-emerald-400 ml-1">
              {winsToRankResult.safeWins} 胜
            </strong>
            ）
          </div>

          <div className="space-y-1 max-h-64 overflow-y-auto">
            {winsToRankResult.probByWins
              .filter((_, i) => i <= winsToRankResult.safeWins + 5)
              .map(({ wins, probability }) => (
                <div key={wins} className="flex items-center gap-2">
                  <span className="w-16 text-xs text-right text-slate-400 shrink-0">
                    {wins} 胜
                  </span>
                  <div className="flex-1 h-5 bg-[#27273B] rounded-sm overflow-hidden">
                    <div
                      className={`h-full rounded-sm transition-all ${
                        wins === winsToRankResult.safeWins
                          ? "bg-emerald-500"
                          : probability >= 0.95
                          ? "bg-emerald-400"
                          : probability >= 0.5
                          ? "bg-amber-400"
                          : "bg-red-400"
                      }`}
                      style={{ width: `${Math.min(probability * 100, 100)}%` }}
                    />
                  </div>
                  <span className="w-16 text-xs text-slate-400 shrink-0">
                    {(probability * 100).toFixed(1)}%
                  </span>
                  {wins === winsToRankResult.safeWins && (
                    <Badge variant="outline" className="text-xs shrink-0 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      95% 安全
                    </Badge>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 模式3：鲁棒性分析 */}
      {activeTab === 'mode3' && (
        <div className="rounded-2xl bg-[#1E1C35] border border-purple-900/40 p-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="mode3-wins-input" className="text-xs text-slate-300 font-semibold">胜场数</Label>
              <Input
                id="mode3-wins-input"
                type="number"
                min={0}
                value={wins3}
                onChange={(e) => setWins3(Math.max(0, parseInt(e.target.value) || 0))}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mode3-n-min-input" className="text-xs text-slate-300 font-semibold">N 最小值</Label>
              <Input
                id="mode3-n-min-input"
                type="number"
                min={1000}
                value={nMin}
                onChange={(e) => setNMin(Math.max(1000, parseInt(e.target.value) || 1000))}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mode3-n-max-input" className="text-xs text-slate-300 font-semibold">N 最大值</Label>
              <Input
                id="mode3-n-max-input"
                type="number"
                min={1000}
                value={nMax}
                onChange={(e) => setNMax(Math.max(nMin + 1, parseInt(e.target.value) || nMin + 1))}
                className="h-8 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="grid grid-cols-3 text-xs text-slate-400 font-semibold pb-1 border-b border-purple-900/40">
              <span>参与人数</span>
              <span>晋级概率</span>
              <span>状态</span>
            </div>
            {sweepPoints.map(({ N, prob, safe }) => (
              <div key={N} className="grid grid-cols-3 text-sm py-0.5">
                <span className="text-slate-300">{N.toLocaleString()}</span>
                <span className={safe ? "text-emerald-400 font-medium" : "text-red-400 font-medium"}>
                  {(prob * 100).toFixed(1)}%
                </span>
                <span>
                  <Badge
                    className={`text-xs ${safe ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}
                  >
                    {safe ? "安全" : "危险"}
                  </Badge>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 模式4：安全人数上限 */}
      {activeTab === 'mode4' && (
        <div className="rounded-2xl bg-[#1E1C35] border border-purple-900/40 p-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mode4-wins-input" className="text-slate-300 font-semibold">胜场数</Label>
            <Input
              id="mode4-wins-input"
              type="number"
              min={0}
              value={wins4}
              onChange={(e) => setWins4(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-32 h-8"
            />
          </div>

          {safeCount && (
            <div className="space-y-3">
              <p className="text-sm text-slate-400">
                {wins4} 胜能稳进前 {params.targetRank.toLocaleString()} 名的最大参与人数：
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-purple-900/40 p-3 text-center">
                  <div className="text-xl font-extrabold text-amber-400">
                    {safeCount.maxPlayers80.toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">80% 置信</div>
                </div>
                <div className="rounded-xl border border-purple-900/40 p-3 text-center bg-[#27273B]/50">
                  <div className="text-xl font-extrabold text-amber-400">
                    {safeCount.maxPlayers.toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">95% 置信</div>
                </div>
                <div className="rounded-xl border border-purple-900/40 p-3 text-center">
                  <div className="text-xl font-extrabold text-amber-400">
                    {safeCount.maxPlayers99.toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">99% 置信</div>
                </div>
              </div>
              <p className="text-xs text-slate-400">
                即：当参与人数不超过上述数值时，{wins4} 胜有对应置信度能进入前{" "}
                {params.targetRank.toLocaleString()} 名
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
