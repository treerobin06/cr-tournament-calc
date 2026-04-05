import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
      {/* Tab Bar — KAWE.SKI 风格按钮 */}
      <div className="flex gap-3 flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 rounded-full font-bold text-sm border-2 transition-all duration-200 cursor-pointer
              ${activeTab === tab.id
                ? 'bg-amber-100 border-black text-black shadow-[2px_2px_0px_#1A1A1A]'
                : 'bg-white border-gray-300 text-gray-600 hover:border-black hover:text-black'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 模式1：给定胜场，查询期望排名 */}
      {activeTab === 'mode1' && (
        <div className="cr-card space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mode1-wins-input" className="text-xs font-medium tracking-wide uppercase text-gray-500">胜场数</Label>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border-2 border-gray-200 bg-gray-50 p-4 text-center">
                  <div className="stat-number text-2xl">
                    #{rankResult.optimisticRank.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 mt-2 font-medium tracking-wide">乐观排名（期望）</div>
                </div>
                <div className="rounded-xl border-2 border-gray-200 bg-gray-50 p-4 text-center">
                  <div className="stat-number text-2xl">
                    #{rankResult.conservativeRank.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 mt-2 font-medium tracking-wide">保守排名（95% 置信）</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">晋级概率：</span>
                <span
                  className={
                    promoProb >= 0.95
                      ? 'badge-safe'
                      : promoProb >= 0.5
                      ? 'badge-gold'
                      : 'badge-danger'
                  }
                >
                  {(promoProb * 100).toFixed(1)}%
                </span>
                <span className="text-xs text-gray-500">
                  （进入前 {params.targetRank.toLocaleString()} 名）
                </span>
              </div>

              <div className="text-sm text-gray-500">
                百分位：你超过了{" "}
                <strong className="text-gray-900">{rankResult.percentile.toFixed(1)}%</strong> 的玩家
              </div>
            </div>
          )}
        </div>
      )}

      {/* 模式2：名次→胜场，概率条 */}
      {activeTab === 'mode2' && (
        <div className="cr-card space-y-4">
          <div className="text-sm text-gray-500">
            目标排名：<strong className="text-gray-900">前 {params.targetRank.toLocaleString()} 名</strong>
            所需胜场分析（95% 安全胜场：
            <strong className="text-emerald-600 ml-1">
              {winsToRankResult.safeWins} 胜
            </strong>
            ）
          </div>

          <div className="space-y-1 max-h-64 overflow-y-auto">
            {winsToRankResult.probByWins
              .filter(r => r.probability > 0.001 && r.wins >= winsToRankResult.safeWins - 3)
              .filter((_, i, arr) => i <= arr.findIndex(r => r.wins === winsToRankResult.safeWins) + 5)
              .map(({ wins, probability }) => (
                <div key={wins} className="flex items-center gap-2">
                  <span className="w-16 text-xs text-right text-gray-500 shrink-0">
                    {wins} 胜
                  </span>
                  <div className="flex-1 prob-bar">
                    <div
                      className={`prob-bar-fill ${
                        wins === winsToRankResult.safeWins
                          ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                          : probability >= 0.95
                          ? "bg-gradient-to-r from-emerald-400 to-emerald-300"
                          : probability >= 0.5
                          ? "bg-gradient-to-r from-amber-400 to-amber-300"
                          : "bg-gradient-to-r from-red-400 to-red-300"
                      }`}
                      style={{ width: `${Math.min(probability * 100, 100)}%` }}
                    />
                  </div>
                  <span className="w-16 text-xs text-gray-500 shrink-0">
                    {(probability * 100).toFixed(1)}%
                  </span>
                  {wins === winsToRankResult.safeWins && (
                    <span className="badge-safe text-xs shrink-0">
                      95% 安全
                    </span>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 模式3：鲁棒性分析 */}
      {activeTab === 'mode3' && (
        <div className="cr-card space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="mode3-wins-input" className="text-xs font-medium tracking-wide uppercase text-gray-500">胜场数</Label>
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
              <Label htmlFor="mode3-n-min-input" className="text-xs font-medium tracking-wide uppercase text-gray-500">N 最小值</Label>
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
              <Label htmlFor="mode3-n-max-input" className="text-xs font-medium tracking-wide uppercase text-gray-500">N 最大值</Label>
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
            <div className="grid grid-cols-3 text-xs text-gray-900 font-bold pb-1 border-b-2 border-black">
              <span>参与人数</span>
              <span>晋级概率</span>
              <span>状态</span>
            </div>
            {sweepPoints.map(({ N, prob, safe }) => (
              <div key={N} className="grid grid-cols-3 text-sm py-0.5">
                <span className="text-gray-700">{N.toLocaleString()}</span>
                <span className={safe ? "text-emerald-600 font-medium" : "text-red-600 font-medium"}>
                  {(prob * 100).toFixed(1)}%
                </span>
                <span>
                  <span className={safe ? 'badge-safe text-xs' : 'badge-danger text-xs'}>
                    {safe ? "安全" : "危险"}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 模式4：安全人数上限 */}
      {activeTab === 'mode4' && (
        <div className="cr-card space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mode4-wins-input" className="text-xs font-medium tracking-wide uppercase text-gray-500">胜场数</Label>
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
              <p className="text-sm text-gray-500">
                {wins4} 胜能稳进前 {params.targetRank.toLocaleString()} 名的最大参与人数：
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border-2 border-gray-200 bg-gray-50 p-4 text-center">
                  <div className="stat-number text-xl">
                    {safeCount.maxPlayers80.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 mt-2 font-medium tracking-wide">80% 置信</div>
                </div>
                <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-center">
                  <div className="stat-number text-xl">
                    {safeCount.maxPlayers.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 mt-2 font-medium tracking-wide">95% 置信</div>
                </div>
                <div className="rounded-xl border-2 border-gray-200 bg-gray-50 p-4 text-center">
                  <div className="stat-number text-xl">
                    {safeCount.maxPlayers99.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 mt-2 font-medium tracking-wide">99% 置信</div>
                </div>
              </div>
              <p className="text-xs text-gray-500">
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
