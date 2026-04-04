/**
 * SimulationPanel — 蒙特卡罗模拟控制面板
 * 显示运行/取消按钮、进度条、模拟结果
 */
import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useSimulation } from '@/hooks/useSimulation'
import type { TournamentParams } from '@/components/ParameterPanel'

interface SimulationPanelProps {
  params: TournamentParams
}

/** 最大模拟人数（超出则截断，保护性能） */
const MAX_SIM_PLAYERS = 500_000

export function SimulationPanel({ params }: SimulationPanelProps) {
  const { run, cancel, running, progress, result } = useSimulation()

  // 构建发给 Worker 的配置（playerCount 上限 50 万）
  const simConfig = useMemo(() => ({
    playerCount: Math.min(params.playerCount, MAX_SIM_PLAYERS),
    lives: params.lives,
    fullPlayRatio: params.fullPlayRatio,
    kappa: params.kappa,
    seed: Date.now(),  // 每次 run 时 seed 由 useMemo key 外层决定
  }), [params])  // eslint-disable-line react-hooks/exhaustive-deps

  const handleRun = () => {
    run({ ...simConfig, seed: Date.now() })
  }

  // 找到目标排名对应的胜场（从 topPlayerWins 中读取）
  const targetRankWins = useMemo(() => {
    if (!result) return undefined
    const { topPlayerWins } = result
    const idx = params.targetRank - 1
    if (idx >= 0 && idx < topPlayerWins.length) {
      return topPlayerWins[idx]
    }
    return undefined
  }, [result, params.targetRank])

  // 进度百分比
  const pct = Math.round(progress * 100)

  return (
    <div className="rounded-2xl bg-[#1E1C35] border border-purple-900/40 p-5">
      <div className="pb-3 flex items-center gap-2">
        <h3 className="text-lg font-bold text-amber-400 mb-0" style={{fontFamily:'Fredoka'}}>蒙特卡罗模拟</h3>
        <Badge variant="outline" className="text-xs font-normal border-purple-700/50 text-slate-400">
          实验性
        </Badge>
      </div>
      <div className="space-y-4">
        {/* kappa 模式说明 */}
        {params.kappa === 0 ? (
          <p className="text-xs text-slate-400">
            当前 κ=0（纯随机对局），模拟结果可直接对比理论值验证模型正确性。
          </p>
        ) : (
          <p className="text-xs text-slate-400">
            当前 κ={params.kappa.toFixed(2)}（Bradley-Terry 技能模型），技能服从 N(0,1)。
            结果仅供参考，与理论模型存在差异属于正常现象。
          </p>
        )}

        {/* 人数超限提示 */}
        {params.playerCount > MAX_SIM_PLAYERS && (
          <p className="text-xs text-amber-400">
            注意：模拟人数已限制为 {MAX_SIM_PLAYERS.toLocaleString()}（实际参数为 {params.playerCount.toLocaleString()}）。
          </p>
        )}

        {/* 操作按钮 */}
        <div className="flex items-center gap-3">
          {running ? (
            <Button variant="destructive" size="sm" onClick={cancel} className="cursor-pointer">
              取消
            </Button>
          ) : (
            <button
              onClick={handleRun}
              className="px-6 py-2.5 rounded-xl font-bold bg-gradient-to-b from-amber-400 to-amber-600 text-gray-900 hover:from-amber-300 hover:to-amber-500 cursor-pointer transition-all duration-200"
            >
              运行模拟
            </button>
          )}
          <span className="text-xs text-slate-400">
            模拟 {Math.min(params.playerCount, MAX_SIM_PLAYERS).toLocaleString()} 人 ·{' '}
            {params.lives} 命 · 满局率 {(params.fullPlayRatio * 100).toFixed(0)}%
          </span>
        </div>

        {/* 进度条 */}
        {running && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-400">
              <span>模拟进行中…</span>
              <span>{pct}%</span>
            </div>
            <div className="w-full h-2 bg-[#27273B] rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full transition-all duration-200"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {/* 结果展示 */}
        {result && !running && (
          <div className="space-y-3">
            {/* 基本信息 */}
            <div className="flex flex-wrap gap-3 text-sm">
              <div className="text-slate-400">
                耗时：<span className="font-medium text-slate-200">{result.elapsed.toFixed(0)} ms</span>
              </div>
              {targetRankWins !== undefined && (
                <div className="text-slate-400">
                  第 {params.targetRank} 名胜场：
                  <span className="font-bold text-emerald-400 ml-1">
                    {targetRankWins} 胜
                  </span>
                </div>
              )}
            </div>

            {/* 前 10 名胜场 Badges */}
            <div>
              <p className="text-xs text-slate-400 mb-2">前 10 名胜场数：</p>
              <div className="flex flex-wrap gap-1.5">
                {result.topPlayerWins.slice(0, 10).map((w, i) => (
                  <Badge key={i} variant="secondary" className="text-xs tabular-nums bg-purple-900/40 text-slate-200 border border-purple-700/40">
                    #{i + 1}：{w} 胜
                  </Badge>
                ))}
              </div>
            </div>

            {/* 胜场分布 */}
            <div>
              <p className="text-xs text-slate-400 mb-2">
                胜场分布（模拟 {Math.min(params.playerCount, MAX_SIM_PLAYERS).toLocaleString()} 人）：
              </p>
              <div className="flex flex-wrap gap-1.5">
                {result.winDistribution.map((count, w) => (
                  <div
                    key={w}
                    className="text-xs rounded-lg px-2 py-0.5 bg-[#27273B] border border-purple-900/40"
                  >
                    <span className="font-medium text-slate-200">{w}胜</span>
                    <span className="text-slate-400 ml-1">×{count.toLocaleString()}</span>
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
