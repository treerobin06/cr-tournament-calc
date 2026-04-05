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
    <details className="cr-card group">
      <summary className="cursor-pointer select-none list-none flex items-center gap-2.5 transition-colors duration-200 hover:bg-gray-50 rounded-2xl -m-6 p-5">
        <span className="text-sm transition-transform duration-200 group-open:rotate-90 text-amber-500">&#9654;</span>
        <span className="section-title text-lg">预测最终排名</span>
      </summary>
      <div className="pt-4 space-y-4">
        {/* 输入区域 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="current-wins-input" className="text-xs font-medium tracking-wide uppercase text-gray-500">当前胜场</Label>
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
            <Label htmlFor="current-losses-input" className="text-xs font-medium tracking-wide uppercase text-gray-500">当前失败场（最大 {lives}）</Label>
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
          <span className="text-sm text-gray-500">剩余命数：</span>
          <div className="flex gap-1">
            {Array.from({ length: lives }).map((_, i) => (
              <span
                key={i}
                className={`text-base ${i < remainingLives ? "text-red-500" : "text-gray-300"}`}
              >
                ♥
              </span>
            ))}
          </div>
          <span className="text-sm font-medium text-gray-700">{remainingLives} / {lives}</span>
        </div>

        {/* 个人胜率滑块（仅比赛未结束时显示） */}
        {isActive && (
          <div className="space-y-2">
            <Label className="text-xs font-medium tracking-wide uppercase text-gray-500">
              预计后续每局胜率
              <span className="ml-2 text-lg font-semibold text-gray-900 normal-case tracking-normal">
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
            <div className="flex justify-between text-xs text-gray-500">
              <span>30%</span>
              <span>50%</span>
              <span>80%</span>
            </div>
          </div>
        )}

        {/* 预测结果 */}
        <div className="border-t border-gray-200 pt-4 space-y-3">
          {/* 中位排名（p50） */}
          <div className="rounded-xl bg-gray-50 border-2 border-gray-200 p-4 text-center">
            <div className="stat-number text-3xl">
              #{result.p50RankRange[0].toLocaleString()} ~ #{result.p50RankRange[1].toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 mt-2 font-medium tracking-wide">预测中位排名（p50 区间）</div>
          </div>

          {/* 置信区间 */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-2">
              <div className="text-xs text-gray-500 mb-1">80% 置信区间</div>
              <div className="font-extrabold text-amber-600 text-sm">
                #{result.p80RankRange[0].toLocaleString()}
                <span className="text-gray-400 mx-1">~</span>
                #{result.p80RankRange[1].toLocaleString()}
              </div>
            </div>
            <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-2">
              <div className="text-xs text-gray-500 mb-1">95% 置信区间</div>
              <div className="font-extrabold text-blue-600 text-sm">
                #{result.p95RankRange[0].toLocaleString()}
                <span className="text-gray-400 mx-1">~</span>
                #{result.p95RankRange[1].toLocaleString()}
              </div>
            </div>
          </div>

          {/* 期望最终胜场 */}
          <div className="text-sm text-gray-500 text-center">
            期望最终胜场：<strong className="text-gray-900">{result.expectedFinalWins} 胜</strong>
          </div>
        </div>

        {/* 警告横幅（仅比赛未结束时显示） */}
        {isActive && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
            此预测假设后续每局胜率为 {personalWinRatePct}%。如果你已经连胜，真实实力可能高于平均。
          </div>
        )}
      </div>
    </details>
  )
}
