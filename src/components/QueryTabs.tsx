import { useState } from "react"
import { Input } from "@/components/ui/input"
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
  playerCount: number
  targetRank: number
}

const TABS = [
  { id: 'mode1', label: '胜场 → 排名' },
  { id: 'mode2', label: '名次 → 胜场' },
  { id: 'mode3', label: '鲁棒性分析' },
  { id: 'mode4', label: '安全人数' },
]

/**
 * 每个 Tab 内联输入行的统一容器
 */
function InputRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 flex-wrap p-4 bg-amber-50/50 rounded-xl border border-amber-200/50 mb-4">
      {children}
    </div>
  )
}

/**
 * 带 label 的单个输入字段
 */
function InputField({
  label,
  id,
  value,
  min,
  max,
  onChange,
  className = "w-32",
}: {
  label: string
  id: string
  value: number
  min?: number
  max?: number
  onChange: (v: number) => void
  className?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-gray-600 whitespace-nowrap">
        {label}
      </label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const v = parseInt(e.target.value)
          if (!isNaN(v)) onChange(v)
        }}
        className={`${className} h-8 text-sm`}
      />
    </div>
  )
}

export function QueryTabs({ params, playerCount, targetRank }: QueryTabsProps) {
  const { rFull, alpha } = paramsToMathArgs(params)
  const [activeTab, setActiveTab] = useState('mode1')

  // ========== 模式1：胜场→排名 ==========
  const [m1Wins, setM1Wins] = useState(12)

  const m1RankResult = m1Wins >= 0 ? queryRankFromWins(m1Wins, rFull, alpha, playerCount) : null
  const m1PromoProb = m1Wins >= 0
    ? promotionProbability(m1Wins, rFull, alpha, playerCount, targetRank)
    : 0

  // ========== 模式2：名次→胜场 ==========
  const m2WinsResult = queryWinsToRank(rFull, alpha, playerCount, targetRank, 0.95)

  // ========== 模式3：鲁棒性分析 ==========
  const [m3Wins, setM3Wins] = useState(12)
  const [m3NMin, setM3NMin] = useState(100000)
  const [m3NMax, setM3NMax] = useState(500000)
  const [m3TargetRank, setM3TargetRank] = useState(900)

  const m3SweepPoints: Array<{ N: number; prob: number; safe: boolean }> = (() => {
    if (m3NMin >= m3NMax) return []
    const step = (m3NMax - m3NMin) / 9
    return Array.from({ length: 10 }, (_, i) => {
      const N = Math.round(m3NMin + i * step)
      const prob = promotionProbability(m3Wins, rFull, alpha, N, m3TargetRank)
      return { N, prob, safe: prob >= 0.95 }
    })
  })()

  // ========== 模式4：安全人数 ==========
  const [m4Wins, setM4Wins] = useState(12)

  const m4SafeCount = m4Wins >= 0
    ? querySafePlayerCount(m4Wins, rFull, alpha, targetRank, 0.95)
    : null

  return (
    <div className="space-y-3">
      {/* Tab Bar */}
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

      {/* ===== 模式1：胜场→排名 ===== */}
      {activeTab === 'mode1' && (
        <div className="cr-card space-y-0">
          <div className="text-sm text-gray-500 mb-3 leading-relaxed">
            输入你的参赛人数和当前胜场数，计算你在所有玩家中的预估排名。
            <br/>
            <span className="text-gray-400">
              「乐观排名」假设你在同胜场玩家中负场最少；「保守排名」假设你负场最多（已打满所有命）。
              晋级概率基于二项分布计算，考虑了随机波动。
            </span>
          </div>
          <InputRow>
            <InputField
              label="我的胜场"
              id="m1-wins"
              value={m1Wins}
              min={0}
              max={100}
              onChange={(v) => setM1Wins(Math.max(0, v))}
            />
          </InputRow>

          {/* 输出区 */}
          {m1RankResult && (
            <div className="space-y-3 bg-white rounded-xl p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border-2 border-gray-200 bg-gray-50 p-4 text-center">
                  <div className="stat-number font-mono-data text-2xl">
                    #{m1RankResult.optimisticRank.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 mt-2 font-medium tracking-wide">乐观排名（期望）</div>
                </div>
                <div className="rounded-xl border-2 border-gray-200 bg-gray-50 p-4 text-center">
                  <div className="stat-number font-mono-data text-2xl">
                    #{m1RankResult.conservativeRank.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 mt-2 font-medium tracking-wide">保守排名（95% 置信）</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">晋级概率：</span>
                <span
                  className={
                    m1PromoProb >= 0.95
                      ? 'badge-safe'
                      : m1PromoProb >= 0.5
                      ? 'badge-gold'
                      : 'badge-danger'
                  }
                >
                  <span className="font-mono-data">{(m1PromoProb * 100).toFixed(1)}%</span>
                </span>
                <span className="text-xs text-gray-500">
                  （进入前 {targetRank.toLocaleString()} 名）
                </span>
              </div>

              <div className="text-sm text-gray-500">
                百分位：你超过了{" "}
                <strong className="text-gray-900">{m1RankResult.percentile.toFixed(1)}%</strong> 的玩家
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== 模式2：名次→胜场 ===== */}
      {activeTab === 'mode2' && (
        <div className="cr-card space-y-0">
          <div className="text-sm text-gray-500 mb-3 leading-relaxed">
            输入参赛人数和目标名次，计算你至少需要多少胜场才能大概率晋级。
            <br/>
            <span className="text-gray-400">
              下方显示各胜场数的晋级概率。标记「95% 安全」的胜场意味着在 95% 的情况下你都能进入目标名次。
              概率越高越安全，建议以 95% 为目标。
            </span>
          </div>
          {/* 输出区 */}
          <div className="space-y-4 bg-white rounded-xl p-4">
            <div className="text-sm text-gray-500">
              目标排名：<strong className="text-gray-900">前 {targetRank.toLocaleString()} 名</strong>
              {" "}所需胜场分析（95% 安全胜场：
              <strong className="text-emerald-600 ml-1">
                {m2WinsResult.safeWins} 胜
              </strong>
              ）
            </div>

            <div className="space-y-1 max-h-64 overflow-y-auto">
              {m2WinsResult.probByWins
                .filter(r => r.probability > 0.001 && r.wins >= m2WinsResult.safeWins - 3)
                .filter((_, i, arr) => i <= arr.findIndex(r => r.wins === m2WinsResult.safeWins) + 5)
                .map(({ wins, probability }) => (
                  <div key={wins} className="flex items-center gap-2">
                    <span className="w-16 text-xs text-right text-gray-500 shrink-0">
                      {wins} 胜
                    </span>
                    <div className="flex-1 prob-bar">
                      <div
                        className={`prob-bar-fill ${
                          wins === m2WinsResult.safeWins
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
                    <span className="w-16 text-xs text-gray-500 shrink-0 font-mono-data">
                      {(probability * 100).toFixed(1)}%
                    </span>
                    {wins === m2WinsResult.safeWins && (
                      <span className="badge-safe text-xs shrink-0">
                        95% 安全
                      </span>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== 模式3：鲁棒性分析 ===== */}
      {activeTab === 'mode3' && (
        <div className="cr-card space-y-0">
          <div className="text-sm text-gray-500 mb-3 leading-relaxed">
            不确定有多少人参赛？输入你的胜场和预估人数范围，查看在不同参赛规模下你是否安全晋级。
            <br/>
            <span className="text-gray-400">
              绿色「安全」表示晋级概率 ≥ 95%，红色「危险」表示不足 50%。
              如果整个范围都是安全的，说明你的胜场足够稳。
            </span>
          </div>
          <InputRow>
            <InputField
              label="我的胜场"
              id="m3-wins"
              value={m3Wins}
              min={0}
              max={100}
              onChange={(v) => setM3Wins(Math.max(0, v))}
            />
            <InputField
              label="人数下限"
              id="m3-n-min"
              value={m3NMin}
              min={1000}
              onChange={(v) => setM3NMin(Math.max(1000, v))}
            />
            <InputField
              label="人数上限"
              id="m3-n-max"
              value={m3NMax}
              min={1000}
              onChange={(v) => setM3NMax(Math.max(m3NMin + 1, v))}
            />
            <InputField
              label="目标排名"
              id="m3-target-rank"
              value={m3TargetRank}
              min={1}
              max={100000}
              onChange={(v) => setM3TargetRank(Math.max(1, v))}
            />
          </InputRow>

          {/* 输出区 */}
          <div className="space-y-1 bg-white rounded-xl p-4">
            <div className="grid grid-cols-3 text-xs text-gray-900 font-bold pb-1 border-b-2 border-black">
              <span>参与人数</span>
              <span>晋级概率</span>
              <span>状态</span>
            </div>
            {m3SweepPoints.map(({ N, prob, safe }) => (
              <div key={N} className="grid grid-cols-3 text-sm py-0.5">
                <span className="text-gray-700">{N.toLocaleString()}</span>
                <span className={`font-mono-data ${safe ? "text-emerald-600 font-medium" : "text-red-600 font-medium"}`}>
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

      {/* ===== 模式4：安全人数上限 ===== */}
      {activeTab === 'mode4' && (
        <div className="cr-card space-y-0">
          <div className="text-sm text-gray-500 mb-3 leading-relaxed">
            输入你的胜场和目标名次，计算最多可以有多少人参赛你仍然安全晋级。
            <br/>
            <span className="text-gray-400">
              例如「95% 安全上限 = 350,000 人」意味着只要参赛人数不超过 35 万，你就有 95% 以上的概率进入目标名次。
              同时提供 80% 和 99% 的参考值。
            </span>
          </div>
          <InputRow>
            <InputField
              label="我的胜场"
              id="m4-wins"
              value={m4Wins}
              min={0}
              max={100}
              onChange={(v) => setM4Wins(Math.max(0, v))}
            />
          </InputRow>

          {/* 输出区 */}
          {m4SafeCount && (
            <div className="space-y-3 bg-white rounded-xl p-4">
              <p className="text-sm text-gray-500">
                {m4Wins} 胜能稳进前 {targetRank.toLocaleString()} 名的最大参与人数：
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border-2 border-gray-200 bg-gray-50 p-4 text-center">
                  <div className="stat-number font-mono-data text-xl">
                    {m4SafeCount.maxPlayers80.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 mt-2 font-medium tracking-wide">80% 置信</div>
                </div>
                <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-center">
                  <div className="stat-number font-mono-data text-xl">
                    {m4SafeCount.maxPlayers.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 mt-2 font-medium tracking-wide">95% 置信</div>
                </div>
                <div className="rounded-xl border-2 border-gray-200 bg-gray-50 p-4 text-center">
                  <div className="stat-number font-mono-data text-xl">
                    {m4SafeCount.maxPlayers99.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 mt-2 font-medium tracking-wide">99% 置信</div>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                即：当参与人数不超过上述数值时，{m4Wins} 胜有对应置信度能进入前{" "}
                {targetRank.toLocaleString()} 名
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
