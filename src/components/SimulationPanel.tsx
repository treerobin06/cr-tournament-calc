/**
 * SimulationPanel — 蒙特卡罗模拟控制面板（自包含版本）
 * 显示运行/取消按钮、进度条、模拟结果
 * 所有参数均内联管理，无需依赖侧边栏
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

/** 满局率选项 */
const ALPHA_OPTIONS = [0.7, 0.8, 0.9, 0.95, 1.0]

/** 命数选项 */
const LIVES_OPTIONS = [3, 4, 5, 6, 7]

/** 通用 select/input 样式 */
const INPUT_CLASS = 'h-9 px-3 rounded-lg border border-gray-300 bg-white text-sm w-full focus:outline-none focus:ring-2 focus:ring-amber-300'

export function SimulationPanel({ params }: SimulationPanelProps) {
  const { run, cancel, running, progress, result } = useSimulation()

  // ── 内联参数（从 props 初始化，之后独立） ──────────────────────────
  const [simPlayerCount, setSimPlayerCount] = useState(
    Math.min(params.playerCount, MAX_SIM_PLAYERS)
  )
  const [simLives, setSimLives] = useState(params.lives)
  const [simAlpha, setSimAlpha] = useState(params.fullPlayRatio)
  const [simKappa, setSimKappa] = useState(params.kappa)
  const [runs, setRuns] = useState(1)
  const [simTargetRank, setSimTargetRank] = useState(params.targetRank ?? 900)

  // ── 构建发给 Worker 的配置 ────────────────────────────────────────
  const simConfig = useMemo(() => ({
    playerCount: Math.min(simPlayerCount, MAX_SIM_PLAYERS),
    lives: simLives,
    fullPlayRatio: simAlpha,
    kappa: simKappa,
    seed: Date.now(),
    runs,
  }), [simPlayerCount, simLives, simAlpha, simKappa, runs])

  const handleRun = () => {
    run({ ...simConfig, seed: Date.now() })
  }

  // ── 目标排名对应的胜场统计 ────────────────────────────────────────
  const targetRankStats = useMemo(() => {
    if (!result) return undefined
    const idx = simTargetRank - 1
    if (idx >= 0 && idx < result.avgTopPlayerWins.length) {
      return {
        avg: result.avgTopPlayerWins[idx],
        min: result.minTopPlayerWins[idx],
        max: result.maxTopPlayerWins[idx],
      }
    }
    return undefined
  }, [result, simTargetRank])

  // κ 含义说明
  const kappaLabel = useMemo(() => {
    if (simKappa === 0) return '无差异（纯运气）'
    const winRate = Math.round(100 / (1 + Math.exp(-2 * simKappa)))
    return `顶尖 vs 普通 ≈ ${winRate}% 胜率`
  }, [simKappa])

  // 进度百分比
  const pct = Math.round(progress * 100)

  return (
    <div className="cr-card">
      <div className="pb-4 flex items-center gap-2">
        <h3 className="section-title text-base mb-0">蒙特卡罗模拟</h3>
        <span className="badge-gold text-xs">实验性</span>
      </div>
      <p className="text-sm text-gray-500 mb-4 leading-relaxed">
        蒙特卡罗模拟通过在电脑上模拟整场比赛（每对玩家逐场对战），验证理论计算的准确性。
        当开启「玩家实力差异」（κ &gt; 0）时，理论公式不再适用，必须通过模拟获得结果。
        <span className="text-gray-400">
          模拟次数越多，结果越稳定。推荐至少 5 次以获得可靠的平均值。
        </span>
      </p>

      {/* ── 内联参数网格 ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-5 p-4 bg-gray-50 rounded-xl border border-gray-200">
        {/* 参赛人数 */}
        <div>
          <label className="text-xs font-semibold text-gray-500">参赛人数</label>
          <input
            type="number"
            value={simPlayerCount}
            min={2}
            max={MAX_SIM_PLAYERS}
            step={10000}
            onChange={e => setSimPlayerCount(Number(e.target.value))}
            disabled={running}
            className={`${INPUT_CLASS} mt-1 ${running ? 'opacity-50 cursor-not-allowed' : ''}`}
          />
        </div>

        {/* 命数 */}
        <div>
          <label className="text-xs font-semibold text-gray-500">命数</label>
          <select
            value={simLives}
            onChange={e => setSimLives(Number(e.target.value))}
            disabled={running}
            className={`${INPUT_CLASS} mt-1 ${running ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {LIVES_OPTIONS.map(v => (
              <option key={v} value={v}>{v} 命</option>
            ))}
          </select>
        </div>

        {/* 满局率 */}
        <div>
          <label className="text-xs font-semibold text-gray-500">满局率</label>
          <select
            value={simAlpha}
            onChange={e => setSimAlpha(Number(e.target.value))}
            disabled={running}
            className={`${INPUT_CLASS} mt-1 ${running ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {ALPHA_OPTIONS.map(v => (
              <option key={v} value={v}>{Math.round(v * 100)}%</option>
            ))}
          </select>
        </div>

        {/* 玩家实力差异 κ */}
        <div>
          <label className="text-xs font-semibold text-gray-500">玩家实力差异 κ</label>
          <input
            type="number"
            value={simKappa}
            step={0.1}
            min={0}
            max={3}
            onChange={e => setSimKappa(Number(e.target.value))}
            disabled={running}
            className={`${INPUT_CLASS} mt-1 ${running ? 'opacity-50 cursor-not-allowed' : ''}`}
          />
          <p className="text-xs text-gray-400 mt-0.5">{kappaLabel}</p>
        </div>

        {/* 模拟次数 */}
        <div>
          <label className="text-xs font-semibold text-gray-500">模拟次数</label>
          <div className="flex gap-1 mt-1 flex-wrap">
            {RUN_OPTIONS.map(n => (
              <button
                key={n}
                onClick={() => setRuns(n)}
                disabled={running}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer
                  ${runs === n
                    ? 'bg-amber-100 text-amber-800 border-2 border-amber-400'
                    : 'bg-white text-gray-600 border border-gray-300 hover:border-gray-400 hover:text-gray-800'
                  }
                  ${running ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* 目标排名 */}
        <div>
          <label className="text-xs font-semibold text-gray-500">目标排名</label>
          <input
            type="number"
            value={simTargetRank}
            min={1}
            step={100}
            onChange={e => setSimTargetRank(Number(e.target.value))}
            disabled={running}
            className={`${INPUT_CLASS} mt-1 ${running ? 'opacity-50 cursor-not-allowed' : ''}`}
          />
          <p className="text-xs text-gray-400 mt-0.5">第 N 名需要多少胜</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* 人数超限提示 */}
        {simPlayerCount > MAX_SIM_PLAYERS && (
          <p className="text-xs text-amber-600">
            注意：模拟人数已限制为 {MAX_SIM_PLAYERS.toLocaleString()}（当前输入 {simPlayerCount.toLocaleString()}）。
          </p>
        )}

        {/* 运行按钮 + 参数概览 */}
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

          <span className="text-xs text-gray-500">
            {Math.min(simPlayerCount, MAX_SIM_PLAYERS).toLocaleString()} 人 ·{' '}
            {simLives} 命 · 满局率 {Math.round(simAlpha * 100)}% · κ={simKappa.toFixed(2)}
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
                <div className="stat-number font-mono-data text-xl">
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
                    第 {simTargetRank} 名胜场
                  </div>
                  <div className="stat-number font-mono-data text-xl" style={{ color: '#16A34A' }}>
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
                {result.runs > 1 ? '平均' : ''}胜场分布（{Math.min(simPlayerCount, MAX_SIM_PLAYERS).toLocaleString()} 人）：
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
