import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { predictFinalRank } from "@/lib/math"
import type { TournamentParams } from "@/components/ParameterPanel"
import { paramsToMathArgs } from "@/components/ParameterPanel"

interface PredictRankProps {
  params: TournamentParams
}

export function PredictRank({ params }: PredictRankProps) {
  const { rFull, alpha, n } = paramsToMathArgs(params)

  const [currentWins, setCurrentWins] = useState(15)
  const [currentLosses, setCurrentLosses] = useState(0)
  // 胜率滑块：30%-80%，默认 50%
  const [personalWinRatePct, setPersonalWinRatePct] = useState(50)

  // 限制当前失败数不超过命数
  const lives = params.lives
  const clampedLosses = Math.min(currentLosses, lives)
  const remainingLives = lives - clampedLosses
  const isActive = remainingLives > 0 // 还有命（比赛未结束）

  const personalWinRate = personalWinRatePct / 100

  const result = useMemo(() => {
    return predictFinalRank(
      currentWins,
      clampedLosses,
      rFull,
      alpha,
      n,
      isActive ? personalWinRate : 0.5
    )
  }, [currentWins, clampedLosses, rFull, alpha, n, personalWinRate, isActive])

  return (
    <details className="rounded-2xl bg-[#1E1C35] border border-purple-900/40 group">
      <summary className="p-4 cursor-pointer text-lg font-bold text-amber-400 select-none list-none flex items-center gap-2 transition-colors duration-200 hover:bg-white/[0.03] rounded-2xl" style={{fontFamily:'Fredoka'}}>
        <span className="text-sm transition-transform duration-200 group-open:rotate-90">&#9654;</span>
        预测最终排名
      </summary>
      <div className="px-5 pb-5 space-y-4">
        {/* 输入区域 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="current-wins-input" className="text-xs text-slate-300 font-semibold">当前胜场</Label>
            <Input
              id="current-wins-input"
              type="number"
              min={0}
              max={500}
              value={currentWins}
              onChange={(e) => setCurrentWins(Math.max(0, parseInt(e.target.value) || 0))}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="current-losses-input" className="text-xs text-slate-300 font-semibold">当前失败场（最大 {lives}）</Label>
            <Input
              id="current-losses-input"
              type="number"
              min={0}
              max={lives}
              value={currentLosses}
              onChange={(e) =>
                setCurrentLosses(Math.min(lives, Math.max(0, parseInt(e.target.value) || 0)))
              }
              className="h-8 text-sm"
            />
          </div>
        </div>

        {/* 剩余命数提示 */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">剩余命数：</span>
          <div className="flex gap-1">
            {Array.from({ length: lives }).map((_, i) => (
              <span
                key={i}
                className={`text-base ${i < remainingLives ? "text-red-400" : "text-slate-600"}`}
              >
                ♥
              </span>
            ))}
          </div>
          <span className="text-sm font-medium">{remainingLives} / {lives}</span>
        </div>

        {/* 个人胜率滑块（仅比赛未结束时显示） */}
        {isActive && (
          <div className="space-y-2">
            <Label className="text-xs text-slate-300 font-semibold">
              预计后续每局胜率
              <span className="ml-2 text-slate-400 font-normal">
                {personalWinRatePct}%
              </span>
            </Label>
            <Slider
              min={30}
              max={80}
              step={1}
              value={[personalWinRatePct]}
              onValueChange={([v]) => setPersonalWinRatePct(v)}
              aria-label="预计后续每局胜率"
            />
            <div className="flex justify-between text-xs text-slate-400">
              <span>30%</span>
              <span>50%</span>
              <span>80%</span>
            </div>
          </div>
        )}

        {/* 预测结果 */}
        <div className="border-t border-purple-900/40 pt-3 space-y-3">
          {/* 中位排名（p50） */}
          <div className="rounded-xl bg-[#27273B]/60 p-3 text-center">
            <div className="text-3xl font-extrabold text-amber-400">
              #{result.p50RankRange[0].toLocaleString()} ~ #{result.p50RankRange[1].toLocaleString()}
            </div>
            <div className="text-xs text-slate-400 mt-1">预测中位排名（p50 区间）</div>
          </div>

          {/* 置信区间 */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl border border-purple-900/40 p-2">
              <div className="text-xs text-slate-400 mb-1">80% 置信区间</div>
              <div className="font-extrabold text-amber-400 text-sm">
                #{result.p80RankRange[0].toLocaleString()}
                <span className="text-slate-400 mx-1">~</span>
                #{result.p80RankRange[1].toLocaleString()}
              </div>
            </div>
            <div className="rounded-xl border border-purple-900/40 p-2">
              <div className="text-xs text-slate-400 mb-1">95% 置信区间</div>
              <div className="font-extrabold text-violet-400 text-sm">
                #{result.p95RankRange[0].toLocaleString()}
                <span className="text-slate-400 mx-1">~</span>
                #{result.p95RankRange[1].toLocaleString()}
              </div>
            </div>
          </div>

          {/* 期望最终胜场 */}
          <div className="text-sm text-slate-400 text-center">
            期望最终胜场：<strong className="text-amber-400">{result.expectedFinalWins} 胜</strong>
          </div>
        </div>

        {/* 警告横幅（仅比赛未结束时显示） */}
        {isActive && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-300">
            此预测假设后续每局胜率为 {personalWinRatePct}%。如果你已经连胜，真实实力可能高于平均。
          </div>
        )}
      </div>
    </details>
  )
}
