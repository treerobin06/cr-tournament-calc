import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {} from "react"

export interface TournamentParams {
  playerCount: number   // 默认 240000，范围 10-5000000
  lives: number         // 默认 5，可选 3/4/5/6/7
  fullPlayRatio: number // 默认 0.9，范围 0.5-1.0
  targetRank: number    // 默认 900
  kappa: number         // 默认 1.47，范围 0-3.0
  cheaterIntensity: number  // 默认 50，送分强度 0~100
}

export const DEFAULT_PARAMS: TournamentParams = {
  playerCount: 240000,
  lives: 5,
  fullPlayRatio: 0.9,
  targetRank: 900,
  kappa: 1.47,
  cheaterIntensity: 50,
}

/**
 * 从送分强度（0~100）映射到内部参数 cheaterRatio 和 cheaterBoost
 * 0 = 无送分，50 = 去年平均水平（ratio=0.55%, boost=12），100 = 极端
 */
export function cheaterParams(intensity: number): { cheaterRatio: number; cheaterBoost: number } {
  if (intensity <= 0) return { cheaterRatio: 0, cheaterBoost: 0 }
  // 线性插值：intensity 0→100 映射到 ratio 0→1.5%, boost 6→20
  const ratio = (intensity / 100) * 0.015
  const boost = Math.round(6 + (intensity / 100) * 14)
  return { cheaterRatio: ratio, cheaterBoost: boost }
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
  const update = (partial: Partial<TournamentParams>) => {
    onChange({ ...params, ...partial })
  }

  return (
    <div className="cr-card h-fit">
      <h2 className="section-title text-xl mb-6">参数配置</h2>
      <div className="space-y-6">
        {/* 命数（失败次数上限） */}
        <div className="space-y-2">
          <Label className="text-xs font-medium tracking-wide uppercase text-gray-500">命数（最大失败次数）</Label>
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
          <p className="text-xs text-gray-400 mt-1">每位玩家最多可以输的场数。输满即淘汰出局。皇室战争锦标赛通常为 5 命。</p>
        </div>

        {/* 满局率 */}
        <div className="space-y-2">
          <Label className="text-xs font-medium tracking-wide uppercase text-gray-500">
            满局率
            <span className="ml-2 text-lg font-semibold text-gray-900 normal-case tracking-normal">
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
          <p className="text-xs text-gray-400">打满所有命的玩家比例。部分玩家可能提前放弃，只打了 4 命就不打了。90% 表示大约 10% 的人提前退出。</p>
        </div>

        {/* 送分修正 */}
        <div className="space-y-2 pt-3 border-t border-gray-200">
          <Label className="text-xs font-medium tracking-wide uppercase text-gray-500">
            送分修正
            <span className="ml-2 text-base font-semibold text-gray-900 normal-case tracking-normal">
              {params.cheaterIntensity === 0 ? '关闭' :
               params.cheaterIntensity <= 30 ? '轻微' :
               params.cheaterIntensity <= 70 ? '中等' : '严重'}
            </span>
          </Label>
          <Slider
            min={0}
            max={100}
            step={1}
            value={[params.cheaterIntensity]}
            onValueChange={([v]) => update({ cheaterIntensity: v })}
            aria-label="送分修正强度"
          />
          <p className="text-xs text-gray-400">
            {params.cheaterIntensity === 0
              ? '不考虑送分/买分行为，使用纯理论分布。'
              : `强度 ${params.cheaterIntensity}%。50% 对应去年实际水平（≥20 胜人数拟合误差 <1%）。数值越高，高胜场区间人数越多。`}
          </p>
        </div>
      </div>
    </div>
  )
}
