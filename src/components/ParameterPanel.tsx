import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
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
  // kappa 是连续的 r 参数
  // rFull = ceil(kappa)，alpha = ceil(kappa) - kappa（这样 alpha*rFull + (1-alpha)*(rFull-1) = kappa）
  const rFull = Math.max(2, Math.ceil(params.kappa))
  const alpha = rFull - params.kappa // alpha in [0,1]

  // 参与玩家中只有 fullPlayRatio 比例打满场（影响等效人数）
  const n = Math.round(params.playerCount * params.fullPlayRatio)

  return { rFull, alpha, n }
}

/**
 * 对数滑块：将线性 [0,1] 映射到对数刻度 [min, max]
 */
function logScale(value: number, min: number, max: number): number {
  return Math.round(Math.exp(Math.log(min) + value * (Math.log(max) - Math.log(min))))
}
function inverseLogScale(val: number, min: number, max: number): number {
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

  // 对数滑块：playerCount
  const LOG_MIN = 1000
  const LOG_MAX = 5000000
  const sliderVal = inverseLogScale(params.playerCount, LOG_MIN, LOG_MAX)

  // kappa 对应的胜率（NegBin 均值 = r/r = 0.5 固定，但 kappa 影响分布形状）
  // 显示提示：r 越大分布越集中，均值胜场 = r（因为 p=0.5 时 E[W]=r）
  const expectedWins = params.kappa.toFixed(2)

  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">参数配置</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* 参与人数 */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            参与人数
            <span className="ml-2 text-muted-foreground font-normal">
              {params.playerCount.toLocaleString()}
            </span>
          </Label>
          <div className="flex items-center gap-2">
            <Slider
              className="flex-1"
              min={0}
              max={1}
              step={0.001}
              value={[sliderVal]}
              onValueChange={([v]) => update({ playerCount: logScale(v, LOG_MIN, LOG_MAX) })}
            />
          </div>
          <Input
            type="number"
            value={params.playerCount}
            min={1000}
            max={5000000}
            onChange={(e) => {
              const v = parseInt(e.target.value)
              if (!isNaN(v) && v >= 1000 && v <= 5000000) {
                update({ playerCount: v })
              }
            }}
            className="h-8 text-sm"
          />
        </div>

        {/* 命数（失败次数上限） */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">命数（最大失败次数）</Label>
          <Select
            value={String(params.lives)}
            onValueChange={(v) => update({ lives: parseInt(v) })}
          >
            <SelectTrigger className="h-8 text-sm">
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
          <Label className="text-sm font-medium">
            满局率
            <span className="ml-2 text-muted-foreground font-normal">
              {(params.fullPlayRatio * 100).toFixed(0)}%
            </span>
          </Label>
          <Slider
            min={50}
            max={100}
            step={1}
            value={[Math.round(params.fullPlayRatio * 100)]}
            onValueChange={([v]) => update({ fullPlayRatio: v / 100 })}
          />
          <p className="text-xs text-muted-foreground">
            真正打完比赛的玩家比例
          </p>
        </div>

        {/* 目标排名 */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">目标排名</Label>
          <Input
            type="number"
            value={params.targetRank}
            min={1}
            max={100000}
            onChange={(e) => {
              const v = parseInt(e.target.value)
              if (!isNaN(v) && v >= 1) update({ targetRank: v })
            }}
            className="h-8 text-sm"
          />
        </div>

        {/* 高级选项 */}
        <div className="border-t pt-3">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <span>{showAdvanced ? "▾" : "▸"}</span>
            高级选项
          </button>
          {showAdvanced && (
            <div className="mt-3 space-y-2">
              <Label className="text-sm font-medium">
                κ（分布形状参数）
                <span className="ml-2 text-muted-foreground font-normal">
                  {params.kappa.toFixed(2)}
                </span>
              </Label>
              <Slider
                min={0}
                max={300}
                step={1}
                value={[Math.round(params.kappa * 100)]}
                onValueChange={([v]) => update({ kappa: v / 100 })}
              />
              <p className="text-xs text-muted-foreground">
                期望胜场 ≈ <strong>{expectedWins}</strong>（NegBin r 参数）
              </p>
              <p className="text-xs text-muted-foreground">
                κ 越大 → 分布越平缓，高胜场玩家越多
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
