/**
 * SimulationPanel — 蒙特卡罗模拟控制面板
 * 参赛人数/命数/满局率/目标排名 从左侧共享参数读取
 * κ（实力差异）和模拟次数是模拟专属参数，直接在此面板配置
 */
import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { useSimulation } from '@/hooks/useSimulation'
import type { TournamentParams } from '@/components/ParameterPanel'

interface SimulationPanelProps {
  params: TournamentParams
  playerCount: number
  targetRank: number
}

const MAX_SIM_PLAYERS = 500_000
const RUN_OPTIONS = [1, 5, 10, 20, 50]

export function SimulationPanel({ params, playerCount, targetRank }: SimulationPanelProps) {
  const { run, cancel, running, progress, result } = useSimulation()

  // 模拟专属参数
  const [simKappa, setSimKappa] = useState(params.kappa)
  const [runs, setRuns] = useState(5)
  // 送分模拟
  const [simCheaterPct, setSimCheaterPct] = useState(0)   // 百分比，如 0.5 = 0.5%
  const [simAltsPerCheater, setSimAltsPerCheater] = useState(2)

  const effectiveN = Math.min(playerCount, MAX_SIM_PLAYERS)

  const simConfig = useMemo(() => ({
    playerCount: effectiveN,
    lives: params.lives,
    fullPlayRatio: params.fullPlayRatio,
    kappa: simKappa,
    seed: Date.now(),
    runs,
    cheaterFraction: simCheaterPct / 100,
    altsPerCheater: simCheaterPct > 0 ? simAltsPerCheater : 0,
  }), [effectiveN, params.lives, params.fullPlayRatio, simKappa, runs, simCheaterPct, simAltsPerCheater])

  const handleRun = () => {
    run({ ...simConfig, seed: Date.now() })
  }

  // 目标排名胜场统计
  const targetRankStats = useMemo(() => {
    if (!result) return undefined
    const idx = targetRank - 1
    if (idx >= 0 && idx < result.avgTopPlayerWins.length) {
      return {
        avg: result.avgTopPlayerWins[idx],
        min: result.minTopPlayerWins[idx],
        max: result.maxTopPlayerWins[idx],
      }
    }
    return undefined
  }, [result, targetRank])

  // κ 描述文字
  const kappaDesc = useMemo(() => {
    if (simKappa === 0) return '无差异（纯运气）'
    if (simKappa < 0.5) return '微弱'
    if (simKappa < 1.0) return '中等'
    if (simKappa < 2.0) return '显著'
    return '极大'
  }, [simKappa])

  // 胜率计算
  const topVsAvgWinRate = useMemo(() => {
    if (simKappa === 0) return 50
    return Math.round(100 / (1 + Math.exp(-2 * simKappa)))
  }, [simKappa])

  // 抽取关键排名的数据
  const keyRankData = useMemo(() => {
    if (!result) return []
    const ranks = [1, 5, 10, 20, 50, 100, 200, 500, targetRank].filter(
      (r, i, arr) => r <= result.avgTopPlayerWins.length && arr.indexOf(r) === i
    ).sort((a, b) => a - b)

    return ranks.map(rank => {
      const idx = rank - 1
      return {
        rank,
        avg: result.avgTopPlayerWins[idx],
        min: result.minTopPlayerWins[idx],
        max: result.maxTopPlayerWins[idx],
        isTarget: rank === targetRank,
      }
    })
  }, [result, targetRank])

  // 胜场分布（模拟结果）
  const winDistData = useMemo(() => {
    if (!result) return []
    return result.avgWinDistribution
      .map((count, wins) => ({ wins, count }))
      .filter(d => d.count > 0)
  }, [result])

  const pct = Math.round(progress * 100)

  return (
    <div className="cr-card">
      <div className="pb-3 flex items-center gap-2">
        <h3 className="section-title text-base mb-0">蒙特卡罗模拟</h3>
        <span className="badge-gold text-xs">实验性</span>
      </div>
      <p className="text-sm text-gray-500 mb-4 leading-relaxed">
        通过模拟整场比赛验证理论计算。当 κ &gt; 0（有实力差异）时，理论公式不适用，必须通过模拟获得结果。
      </p>

      {/* 模拟参数区 */}
      <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-5">
        {/* 玩家实力差异 κ */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            玩家实力差异 κ
            <span className="ml-2 text-base font-semibold text-gray-900 normal-case tracking-normal">
              {kappaDesc}
            </span>
          </label>
          <Slider
            min={0}
            max={300}
            step={1}
            value={[Math.round(simKappa * 100)]}
            onValueChange={([v]) => setSimKappa(v / 100)}
            disabled={running}
            aria-label="玩家实力差异（κ）"
          />
          <p className="text-xs text-gray-500">
            κ = {simKappa.toFixed(2)}。
            {simKappa > 0
              ? `顶尖玩家(+2σ) vs 普通玩家胜率 ≈ ${topVsAvgWinRate}%`
              : '所有人胜率均为 50%，纯靠运气'}
          </p>
          <p className="text-xs text-gray-400">
            控制玩家之间的实力差异程度。κ=0 表示所有人实力相同（纯靠运气），κ 越大表示高手和菜鸟差距越大。
            仅影响蒙特卡罗模拟，理论计算始终假设 50% 胜率。
          </p>
        </div>

        {/* 模拟次数 */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">模拟次数</label>
          <div className="flex gap-1.5 flex-wrap">
            {RUN_OPTIONS.map(n => (
              <button
                key={n}
                onClick={() => setRuns(n)}
                disabled={running}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer
                  ${runs === n
                    ? 'bg-amber-100 text-amber-800 border-2 border-amber-400'
                    : 'bg-white text-gray-600 border border-gray-300 hover:border-gray-400'
                  } ${running ? 'opacity-50' : ''}`}
              >
                {n}次
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400">多次模拟后取平均值，次数越多结果越稳定，但耗时更长。</p>
        </div>

        {/* 送分模拟 */}
        <div className="space-y-2 pt-3 border-t border-gray-200">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            送分模拟
            <span className="ml-2 text-base font-semibold text-gray-900 normal-case tracking-normal">
              {simCheaterPct === 0 ? '关闭' : `${simCheaterPct.toFixed(1)}% × ${simAltsPerCheater} 小号`}
            </span>
          </label>
          <Slider
            min={0}
            max={200}
            step={5}
            value={[Math.round(simCheaterPct * 100)]}
            onValueChange={([v]) => setSimCheaterPct(v / 100)}
            disabled={running}
            aria-label="送分者占比"
          />
          <p className="text-xs text-gray-500">
            {simCheaterPct === 0
              ? '不模拟送分行为。开启后模拟真实 ±1 匹配约束下的小号送分。'
              : `${simCheaterPct.toFixed(1)}% 的玩家带小号（约 ${Math.round(effectiveN * simCheaterPct / 100)} 组，共 ${Math.round(effectiveN * simCheaterPct / 100 * simAltsPerCheater)} 个小号）`}
          </p>

          {simCheaterPct > 0 && (
            <div className="mt-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">每人小号数</label>
              <div className="flex gap-1.5 flex-wrap">
                {[1, 2, 3, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => setSimAltsPerCheater(n)}
                    disabled={running}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer
                      ${simAltsPerCheater === n
                        ? 'bg-red-100 text-red-800 border-2 border-red-400'
                        : 'bg-white text-gray-600 border border-gray-300 hover:border-gray-400'
                      } ${running ? 'opacity-50' : ''}`}
                  >
                    {n}个
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                大号优先匹配自己的小号（±1 胜场内），小号故意输。小号用完命就自然淘汰。
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 当前参数概览（从左侧读取） */}
      <p className="text-xs text-gray-400 mb-3">
        使用左侧参数：{effectiveN.toLocaleString()} 人 · {params.lives} 命 · 满局率 {Math.round(params.fullPlayRatio * 100)}%
        {playerCount > MAX_SIM_PLAYERS && (
          <span className="text-amber-600 ml-1">（人数已限制为 {MAX_SIM_PLAYERS.toLocaleString()}）</span>
        )}
      </p>

      <div className="space-y-4">
        {/* 运行按钮 */}
        <div className="flex items-center gap-3">
          {running ? (
            <Button variant="destructive" size="sm" onClick={cancel} className="cursor-pointer">取消</Button>
          ) : (
            <button
              onClick={handleRun}
              className="bg-amber-400 hover:bg-amber-500 text-black font-bold border-2 border-black shadow-[2px_2px_0px_#1A1A1A] rounded-full px-6 py-2.5 cursor-pointer transition-all duration-200 hover:shadow-[3px_3px_0px_#1A1A1A] active:shadow-[1px_1px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px]"
            >
              运行模拟（{runs}次）
            </button>
          )}
        </div>

        {/* 进度条 */}
        {running && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-500">
              <span>模拟进行中…（共 {runs} 次）</span>
              <span>{pct}%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-amber-400 rounded-full transition-all duration-200" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        {/* 结果展示 */}
        {result && !running && (
          <div className="space-y-6 pt-2">
            <p className="text-xs text-gray-400">
              耗时 {(result.elapsed / 1000).toFixed(1)}s · {runs} 次模拟 · {effectiveN.toLocaleString()} 人
            </p>

            {/* 核心指标卡片 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 冠军胜场 */}
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">冠军平均胜场</p>
                <p className="text-2xl font-bold" style={{fontFamily: "'Righteous', sans-serif"}}>
                  {result.championWins.avg.toFixed(1)} 胜
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  范围 {result.championWins.min}~{result.championWins.max}
                </p>
              </div>

              {/* 送分效果 */}
              {result.cheaterBoost > 0 && (
                <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                  <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">送分实际效果</p>
                  <p className="text-2xl font-bold" style={{fontFamily: "'Righteous', sans-serif"}}>
                    +{result.cheaterBoost.toFixed(1)} 胜
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    大号均值 {result.cheaterMainAvgWins.toFixed(1)} 胜 · 受 ±1 匹配约束
                  </p>
                </div>
              )}

              {/* 目标排名胜场 */}
              {targetRankStats && (
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">
                    第 {targetRank} 名平均胜场
                  </p>
                  <p className="text-2xl font-bold" style={{fontFamily: "'Righteous', sans-serif"}}>
                    {targetRankStats.avg.toFixed(1)} 胜
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    范围 {targetRankStats.min}~{targetRankStats.max}
                  </p>
                </div>
              )}
            </div>

            {/* 关键排名数据表 */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">关键排名胜场一览</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">排名</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">平均胜场</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">最少</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">最多</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">波动</th>
                    </tr>
                  </thead>
                  <tbody>
                    {keyRankData.map(d => (
                      <tr
                        key={d.rank}
                        className={`border-b border-gray-100 ${d.isTarget ? 'bg-blue-50 font-semibold' : 'hover:bg-gray-50'}`}
                      >
                        <td className="py-1.5 px-3">
                          #{d.rank.toLocaleString()}
                          {d.isTarget && <span className="ml-1 text-xs text-blue-600">← 目标</span>}
                        </td>
                        <td className="text-right py-1.5 px-3">{d.avg.toFixed(1)}</td>
                        <td className="text-right py-1.5 px-3 text-gray-400">{d.min}</td>
                        <td className="text-right py-1.5 px-3 text-gray-400">{d.max}</td>
                        <td className="text-right py-1.5 px-3 text-gray-400">±{((d.max - d.min) / 2).toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 胜场分布（模拟结果） */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">胜场人数分布（模拟）</p>
              <div className="overflow-x-auto">
                <div className="flex gap-1 items-end min-h-[80px]">
                  {winDistData.map(d => {
                    const maxCount = Math.max(...winDistData.map(x => x.count))
                    const height = maxCount > 0 ? Math.max(2, (d.count / maxCount) * 80) : 2
                    return (
                      <div key={d.wins} className="flex flex-col items-center min-w-[24px]" title={`${d.wins} 胜: ${d.count.toLocaleString()} 人`}>
                        <div
                          className="w-4 bg-amber-400 rounded-t"
                          style={{ height: `${height}px` }}
                        />
                        <span className="text-[10px] text-gray-400 mt-1">{d.wins}</span>
                      </div>
                    )
                  })}
                </div>
                <p className="text-[10px] text-gray-400 mt-1 text-center">胜场数 →</p>
              </div>
              {/* 分布明细表 */}
              <details className="mt-2">
                <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">展开详细数据</summary>
                <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1 text-xs">
                  {winDistData.map(d => (
                    <div key={d.wins} className="flex justify-between bg-gray-50 rounded px-2 py-1">
                      <span className="text-gray-500">{d.wins}胜</span>
                      <span className="font-medium">{d.count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </details>
            </div>

            {/* 前20名详细 */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">前 20 名胜场</p>
              <div className="flex gap-2 flex-wrap">
                {result.avgTopPlayerWins.slice(0, 20).map((w: number, i: number) => (
                  <span key={i} className={`text-xs px-2 py-1 rounded-full border font-medium ${
                    i < 3
                      ? 'badge-gold'
                      : 'bg-gray-50 text-gray-600 border-gray-200'
                  }`}>
                    #{i + 1}: {w.toFixed(1)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
