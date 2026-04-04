import { useRef, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { promotionProbability } from "@/lib/math"
import type { TournamentParams } from "@/components/ParameterPanel"
import { paramsToMathArgs } from "@/components/ParameterPanel"

interface RobustnessHeatmapProps {
  params: TournamentParams
}

// 颜色插值：红(危险) → 黄(边缘) → 绿(安全)
function probToColor(prob: number): [number, number, number] {
  // 绿：rgb(34, 197, 94)  prob >= 0.95
  // 黄：rgb(234, 179, 8)  prob ≈ 0.5
  // 红：rgb(239, 68, 68)  prob < 0.5
  if (prob >= 0.95) {
    return [34, 197, 94]
  } else if (prob >= 0.5) {
    // 0.5 ~ 0.95 之间：从黄渐变到绿
    const t = (prob - 0.5) / 0.45
    const r = Math.round(234 + t * (34 - 234))
    const g = Math.round(179 + t * (197 - 179))
    const b = Math.round(8 + t * (94 - 8))
    return [r, g, b]
  } else {
    // 0 ~ 0.5：从红渐变到黄
    const t = prob / 0.5
    const r = Math.round(239 + t * (234 - 239))
    const g = Math.round(68 + t * (179 - 68))
    const b = Math.round(68 + t * (8 - 68))
    return [r, g, b]
  }
}

// 生成对数刻度的 N 值（20 步，50,000 ~ 2,000,000）
function logSteps(min: number, max: number, steps: number): number[] {
  return Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1)
    return Math.round(Math.exp(Math.log(min) + t * (Math.log(max) - Math.log(min))))
  })
}

export function RobustnessHeatmap({ params }: RobustnessHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { rFull, alpha } = paramsToMathArgs(params)

  // 坐标轴定义
  const N_MIN = 50_000
  const N_MAX = 2_000_000
  const N_STEPS = 20
  const WINS_MIN = 8
  const WINS_MAX = 25
  // Y 轴：wins 从 WINS_MAX（顶部）到 WINS_MIN（底部），共 WINS_MAX - WINS_MIN + 1 = 18 步
  const WINS_VALUES = Array.from(
    { length: WINS_MAX - WINS_MIN + 1 },
    (_, i) => WINS_MAX - i // 顶部高胜场，底部低胜场
  )
  const N_VALUES = logSteps(N_MIN, N_MAX, N_STEPS)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const CANVAS_W = 500
    const CANVAS_H = 300
    // 留边距给坐标轴标签
    const MARGIN_LEFT = 48
    const MARGIN_RIGHT = 12
    const MARGIN_TOP = 12
    const MARGIN_BOTTOM = 40

    const plotW = CANVAS_W - MARGIN_LEFT - MARGIN_RIGHT
    const plotH = CANVAS_H - MARGIN_TOP - MARGIN_BOTTOM

    const cellW = plotW / N_STEPS
    const cellH = plotH / WINS_VALUES.length

    // 高 DPI 支持
    const dpr = window.devicePixelRatio || 1
    canvas.width = CANVAS_W * dpr
    canvas.height = CANVAS_H * dpr
    canvas.style.width = `${CANVAS_W}px`
    canvas.style.height = `${CANVAS_H}px`
    ctx.scale(dpr, dpr)

    // 背景
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

    // 绘制热力图格子
    WINS_VALUES.forEach((wins, rowIdx) => {
      N_VALUES.forEach((n, colIdx) => {
        const prob = promotionProbability(wins, rFull, alpha, n, params.targetRank)
        const [r, g, b] = probToColor(prob)
        ctx.fillStyle = `rgb(${r},${g},${b})`
        ctx.fillRect(
          MARGIN_LEFT + colIdx * cellW,
          MARGIN_TOP + rowIdx * cellH,
          cellW + 0.5, // 稍微溢出半像素避免缝隙
          cellH + 0.5
        )
      })
    })

    // 绘制 X 轴标签（参与人数）
    ctx.fillStyle = "#6b7280"
    ctx.font = `${10 * Math.min(1, 1)}px sans-serif`
    ctx.textAlign = "center"
    // 选取 5 个刻度显示
    const xTickIndices = [0, 5, 9, 14, 19]
    xTickIndices.forEach((idx) => {
      if (idx >= N_VALUES.length) return
      const x = MARGIN_LEFT + idx * cellW + cellW / 2
      const n = N_VALUES[idx]
      const label = n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : `${Math.round(n / 1000)}k`
      ctx.fillText(label, x, CANVAS_H - MARGIN_BOTTOM + 14)
    })
    ctx.textAlign = "center"
    ctx.fillStyle = "#374151"
    ctx.font = "11px sans-serif"
    ctx.fillText("参与人数", MARGIN_LEFT + plotW / 2, CANVAS_H - 4)

    // 绘制 Y 轴标签（胜场数）
    ctx.textAlign = "right"
    ctx.fillStyle = "#6b7280"
    ctx.font = "10px sans-serif"
    // 每隔几行标一个
    WINS_VALUES.forEach((wins, rowIdx) => {
      if (wins % 2 !== 0 && wins !== WINS_MIN && wins !== WINS_MAX) return
      const y = MARGIN_TOP + rowIdx * cellH + cellH / 2 + 3.5
      ctx.fillText(`${wins}W`, MARGIN_LEFT - 4, y)
    })

    // Y 轴标题（旋转）
    ctx.save()
    ctx.translate(10, MARGIN_TOP + plotH / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.textAlign = "center"
    ctx.fillStyle = "#374151"
    ctx.font = "11px sans-serif"
    ctx.fillText("胜场数", 0, 0)
    ctx.restore()
  }, [rFull, alpha, params.targetRank, N_VALUES, WINS_VALUES])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">鲁棒性热力图</CardTitle>
        <p className="text-xs text-muted-foreground">
          各胜场数在不同参与人数下进入前{" "}
          <strong>{params.targetRank.toLocaleString()}</strong> 名的概率
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <canvas
          ref={canvasRef}
          className="w-full rounded border"
          style={{ maxWidth: "500px", display: "block", margin: "0 auto" }}
        />

        {/* 图例 */}
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ backgroundColor: "rgb(34,197,94)" }}
            />
            <span>安全（≥95%）</span>
          </div>
          <div className="flex items-center gap-1">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ backgroundColor: "rgb(234,179,8)" }}
            />
            <span>边缘（50%~95%）</span>
          </div>
          <div className="flex items-center gap-1">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ backgroundColor: "rgb(239,68,68)" }}
            />
            <span>危险（&lt;50%）</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
