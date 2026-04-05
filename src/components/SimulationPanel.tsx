/**
 * SimulationPanel — 蒙特卡罗模拟控制面板
 * 显示运行/取消按钮、进度条、模拟结果
 * 支持多次模拟并展示汇总统计
 */
import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { useSimulation } from '@/hooks/useSimulation'
import type { TournamentParams } from '@/components/ParameterPanel'

interface SimulationPanelProps {
  params: TournamentParams
}

/** 最大模拟人数（超出则截断，保护性能） */
const MAX_SIM_PLAYERS = 500_000

/** 可选的模拟次数 */
const RUN_OPTIONS = [1, 5, 10, 20, 50]

export function SimulationPanel({ params }: SimulationPanelProps) {
  const { run, cancel, running, progress, result } = useSimulation()
  const [runs, setRuns] = useState(1)

  // 构建发给 Worker 的配置（playerCount 上限 50 万）
  const simConfig = useMemo(() => ({
    playerCount: Math.min(params.playerCount, MAX_SIM_PLAYERS),
    lives: params.lives,
    fullPlayRatio: params.fullPlayRatio,
    kappa: params.kappa,
    seed: Date.now(),
    runs,
  }), [params, runs])  // eslint-disable-line react-hooks/exhaustive-deps

  const handleRun = () => {
    run({ ...simConfig, seed: Date.now() })
  }

  // 找到目标排名对应的胜场统计（从多次模拟结果中提取）
  const targetRankStats = useMemo(() => {
    if (!result) return undefined
    const idx = params.targetRank - 1
    if (idx >= 0 && idx < result.avgTopPlayerWins.length) {
      return {
        avg: result.avgTopPlayerWins[idx],
        min: result.minTopPlayerWins[idx],
        max: result.maxTopPlayerWins[idx],
      }
    }
    return undefined
  }, [result, params.targetRank])

  // 进度百分比
  const pct = Math.round(progress * 100)

  return (
    <div className="cr-card">
      <div className="pb-4 flex items-center gap-2">
        <h3 className="section-title text-base mb-0">蒙特卡罗模拟</h3>
        <span className="badge-gold text-xs">实验性</span>
      </div>
      <div className="space-y-4">
        {/* kappa 模式说明 */}
        {params.kappa === 0 ? (
          <p className="text-xs text-gray-500">
            当前 κ=0（纯随机对局），模拟结果可直接对比理论值验证模型正确性。
          </p>
        ) : (
          <p className="text-xs text-gray-500">
            当前 κ={params.kappa.toFixed(2)}（Bradley-Terry 技能模型），技能服从 N(0,1)。
            结果仅供参考，与理论模型存在差异属于正常现象。
          </p>
        )}

        {/* 人数超限提示 */}
        {params.playerCount > MAX_SIM_PLAYERS && (
          <p className="text-xs text-amber-600">
            注意：模拟人数已限制为 {MAX_SIM_PLAYERS.toLocaleString()}（实际参数为 {params.playerCount.toLocaleString()}）。
          </p>
        )}

        {/* 模拟次数选择 + 操作按钮 */}
        <div className="flex items-center gap-3 flex-wrap">
          {running ? (
            <Button variant="destructive" size="sm" onClick={cancel} className="cursor-pointer">
              取消
            </Button>
          ) : (
            <button
              onClick={handleRun}
              className="bg-amber-400 hover:bg-amber-500 text-black font-bold border-2 border-black shadow-[2px_2px_0px_#1A1A1A] rounded-full px-6 py-2.5 cursor-pointer transition-all duration-200 hover:shadow-[3px_3px_0px_#1A1A1A] active:shadow-[1px_1px_0px_#1A1A1A] active:translate-x-[1px] active:translate-y-[1px]"
            >
              运行模拟
            </button>
          )}

          {/* 模拟次数选择器 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">模拟次数：</span>
            <div className="flex gap-1">
              {RUN_OPTIONS.map(n => (
                <button
                  key={n}
                  onClick={() => setRuns(n)}
                  disabled={running}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer
                    ${runs === n
                      ? 'bg-amber-100 text-amber-800 border-2 border-amber-400'
                      : 'bg-gray-100 text-gray-600 border border-gray-300 hover:border-gray-400 hover:text-gray-800'
                    }
                    ${running ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <span className="text-xs text-gray-500">
            {Math.min(params.playerCount, MAX_SIM_PLAYERS).toLocaleString()} 人 ·{' '}
            {params.lives} 命 · 满局率 {(params.fullPlayRatio * 100).toFixed(0)}%
          </span>
        </div>

        {/* 进度条 */}
        {running && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-500">
              <span>模拟进行中…（共 {simConfig.runs} 次）</span>
              <span>{pct}%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full transition-all duration-200"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {/* 结果展示 */}
        {result && !running && (
          <div className="space-y-4">
            {/* 基本信息 */}
            <div className="flex flex-wrap gap-3 text-sm">
              <div className="text-gray-500">
                完成 <span className="font-medium text-gray-900">{result.runs}</span> 次模拟 ·
                总耗时 <span className="font-medium text-gray-900">{result.elapsed.toFixed(0)} ms</span>
              </div>
            </div>

            {/* 关键统计 — 卡片式 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* 冠军统计 */}
              <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
                <div className="text-xs text-gray-500 mb-1 font-medium tracking-wide">冠军胜场</div>
                <div className="stat-number text-xl">
                  {result.championWins.avg.toFixed(1)}
                </div>
                {result.runs > 1 && (
                  <div className="text-xs text-gray-500 mt-1">
                    范围：{result.championWins.min} - {result.championWins.max}
                  </div>
                )}
              </div>

              {/* 目标排名统计 */}
              {targetRankStats && (
                <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4">
                  <div className="text-xs text-gray-500 mb-1 font-medium tracking-wide">
                    第 {params.targetRank} 名胜场
                  </div>
                  <div className="stat-number text-xl" style={{ color: '#16A34A' }}>
                    {targetRankStats.avg.toFixed(1)}
                  </div>
                  {result.runs > 1 && (
                    <div className="text-xs text-gray-500 mt-1">
                      范围：{targetRankStats.min} - {targetRankStats.max}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 前 10 名胜场 Badges */}
            <div>
              <p className="text-xs text-gray-500 mb-2">
                前 10 名{result.runs > 1 ? '平均' : ''}胜场数：
              </p>
              <div className="flex flex-wrap gap-1.5">
                {result.avgTopPlayerWins.slice(0, 10).map((w, i) => (
                  <span key={i} className="badge-gold text-xs tabular-nums">
                    #{i + 1}：{typeof w === 'number' ? (result.runs > 1 ? w.toFixed(1) : w) : w}
                    {result.runs > 1 && (
                      <span className="text-amber-700 ml-0.5">
                        ({result.minTopPlayerWins[i]}-{result.maxTopPlayerWins[i]})
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>

            {/* 胜场分布 */}
            <div>
              <p className="text-xs text-gray-500 mb-2">
                {result.runs > 1 ? '平均' : ''}胜场分布（{Math.min(params.playerCount, MAX_SIM_PLAYERS).toLocaleString()} 人）：
              </p>
              <div className="flex flex-wrap gap-1.5">
                {result.avgWinDistribution.map((count, w) => (
                  <div
                    key={w}
                    className="text-xs rounded-lg px-2 py-0.5 bg-gray-100 border border-gray-300"
                  >
                    <span className="font-medium text-gray-900">{w}胜</span>
                    <span className="text-gray-500 ml-1">x{typeof count === 'number' ? count.toLocaleString() : count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
