/**
 * SimulationPanel — 蒙特卡罗模拟控制面板
 * 参赛人数/命数/满局率/目标排名 从左侧共享参数读取
 * 仅 κ（实力差异）和模拟次数是模拟专属参数
 */
import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
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

  const effectiveN = Math.min(playerCount, MAX_SIM_PLAYERS)

  const simConfig = useMemo(() => ({
    playerCount: effectiveN,
    lives: params.lives,
    fullPlayRatio: params.fullPlayRatio,
    kappa: simKappa,
    seed: Date.now(),
    runs,
  }), [effectiveN, params.lives, params.fullPlayRatio, simKappa, runs])

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

  // κ 含义
  const kappaLabel = useMemo(() => {
    if (simKappa === 0) return '无差异（纯运气）'
    const winRate = Math.round(100 / (1 + Math.exp(-2 * simKappa)))
    return `顶尖 vs 普通 ≈ ${winRate}% 胜率`
  }, [simKappa])

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

      {/* 模拟专属参数 */}
      <div className="flex items-center gap-6 flex-wrap mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
        {/* 玩家实力差异 κ */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-500">玩家实力差异 κ</label>
          <input
            type="number"
            value={simKappa}
            step={0.1}
            min={0}
            max={3}
            onChange={e => setSimKappa(Number(e.target.value))}
            disabled={running}
            className={`h-9 w-24 px-3 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 ${running ? 'opacity-50' : ''}`}
          />
          <p className="text-xs text-gray-400">{kappaLabel}</p>
        </div>

        {/* 模拟次数 */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-500">模拟次数</label>
          <div className="flex gap-1 flex-wrap">
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
          <div className="space-y-4 pt-2">
            <p className="text-xs text-gray-400">
              耗时 {(result.elapsed / 1000).toFixed(1)}s · {runs} 次模拟
            </p>

            {/* 冠军胜场 */}
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">冠军平均胜场</p>
              <p className="text-2xl font-bold" style={{fontFamily: "'Righteous', sans-serif"}}>
                {result.championWins.avg.toFixed(1)} 胜
                <span className="text-sm font-normal text-gray-500 ml-2">
                  （{result.championWins.min}~{result.championWins.max}）
                </span>
              </p>
            </div>

            {/* 目标排名胜场 */}
            {targetRankStats && (
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">
                  第 {targetRank} 名平均胜场
                </p>
                <p className="text-2xl font-bold" style={{fontFamily: "'Righteous', sans-serif"}}>
                  {targetRankStats.avg.toFixed(1)} 胜
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    （{targetRankStats.min}~{targetRankStats.max}）
                  </span>
                </p>
              </div>
            )}

            {/* 前10名 */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">前 10 名平均胜场</p>
              <div className="flex gap-2 flex-wrap">
                {result.avgTopPlayerWins.slice(0, 10).map((w: number, i: number) => (
                  <span key={i} className="badge-gold text-xs">
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
