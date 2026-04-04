import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useState } from "react"

export interface TournamentParams {
  playerCount: number   // 默认 240000，范围 1000-5000000
  lives: number         // 默认 5，可选 3/4/5/6/7
  fullPlayRatio: number // 默认 0.9，范围 0.5-1.0
  targetRank: number    // 默认 900
  kappa: number         // 默认 1.47，范围 0-3.0
}

export const DEFAULT_PARAMS: TournamentParams = {
  playerCount: 240000,
  lives: 5,
  fullPlayRatio: 0.9,
  targetRank: 900,
  kappa: 1.47,
}

/**
 * 由 lives 和 kappa 计算 rFull 和 alpha
 * kappa = rFull - 1 + alpha，其中 alpha in [0,1)
 * 即 kappa = 1.47 → rFull=2, alpha=0.47（当 lives=5 时 rFull 取决于 lives）
 *
 * 实际上 rFull = lives（失败次数上限），kappa 是调整"有效局数"的参数
 * 这里直接用 kappa 作为 NegBin 的 r 参数进行插值：
 * rFull = floor(lives * kappa / 2) + 1，alpha = kappa - floor(kappa)
 *
 * 根据 math.ts 文档：r = rFull 或 rFull-1，alpha 插值
 * 我们约定：kappa 直接作为连续 r，rFull = ceil(kappa)，alpha = ceil(kappa) - kappa
 */
export function paramsToMathArgs(params: TournamentParams): {
  rFull: number
  alpha: number
  n: number
} {
  // rFull = 命数（如 5 条命）
  // alpha = 打满比例（如 0.9 表示 90% 玩家打满 5 命，10% 打 4 命放弃）
  // n = 总参赛人数
  const rFull = params.lives
  const alpha = params.fullPlayRatio

  return { rFull, alpha, n: params.playerCount }
}

/**
 * 对数滑块：将线性 [0,1] 映射到对数刻度 [min, max]
 */
export function logScale(value: number, min: number, max: number): number {
  return Math.round(Math.exp(Math.log(min) + value * (Math.log(max) - Math.log(min))))
}
export function inverseLogScale(val: number, min: number, max: number): number {
  return (Math.log(val) - Math.log(min)) / (Math.log(max) - Math.log(min))
}

interface ParameterPanelProps {
  params: TournamentParams
  onChange: (params: TournamentParams) => void
}

export function ParameterPanel({ params, onChange }: ParameterPanelProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  const update = (partial: Partial<TournamentParams>) => {
    onChange({ ...params, ...partial })
  }

  return (
    <div className="card-premium p-6 h-fit">
      <h2 className="section-title text-gold text-xl mb-6">参数配置</h2>
      <div className="space-y-6">
        {/* 命数（失败次数上限） */}
        <div className="space-y-2">
          <Label className="text-xs font-medium tracking-wide uppercase text-slate-400">命数（最大失败次数）</Label>
          <Select
            value={String(params.lives)}
            onValueChange={(v) => update({ lives: parseInt(v) })}
          >
            <SelectTrigger className="h-8 text-sm" aria-label="命数（最大失败次数）">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[3, 4, 5, 6, 7].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} 命
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 满局率 */}
        <div className="space-y-2">
          <Label className="text-xs font-medium tracking-wide uppercase text-slate-400">
            满局率
            <span className="ml-2 text-lg font-semibold text-slate-200 normal-case tracking-normal">
              {(params.fullPlayRatio * 100).toFixed(0)}%
            </span>
          </Label>
          <Slider
            min={50}
            max={100}
            step={1}
            value={[Math.round(params.fullPlayRatio * 100)]}
            onValueChange={([v]) => update({ fullPlayRatio: v / 100 })}
            aria-label="满局率"
          />
          <p className="text-xs text-slate-400">
            真正打完比赛的玩家比例
          </p>
        </div>

        {/* 高级选项 */}
        <div className="border-t border-purple-900/20 pt-4">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>{showAdvanced ? "▾" : "▸"}</span>
            高级选项
          </button>
          {showAdvanced && (
            <div className="mt-3 space-y-3">
              <Label className="text-xs font-medium tracking-wide uppercase text-slate-400">
                玩家实力差异
                <span className="ml-2 text-base font-semibold text-slate-200 normal-case tracking-normal">
                  {params.kappa === 0 ? '无差异（纯运气）' :
                   params.kappa < 0.5 ? '微弱' :
                   params.kappa < 1.0 ? '中等' :
                   params.kappa < 2.0 ? '显著' : '极大'}
                </span>
              </Label>
              <Slider
                min={0}
                max={300}
                step={1}
                value={[Math.round(params.kappa * 100)]}
                onValueChange={([v]) => update({ kappa: v / 100 })}
                aria-label="玩家实力差异（κ）"
              />
              <p className="text-xs text-slate-400">
                κ = {params.kappa.toFixed(2)}。
                {params.kappa > 0 && `顶尖玩家(+2σ) vs 普通玩家胜率 ≈ ${Math.round(100 / (1 + Math.exp(-2 * params.kappa)))}%`}
                {params.kappa === 0 && '所有人胜率均为 50%，纯靠运气'}
              </p>
              <p className="text-xs text-slate-500">
                此参数仅在蒙特卡罗模拟中生效。理论计算始终假设 50% 胜率。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
