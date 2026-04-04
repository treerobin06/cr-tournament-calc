import { useRef, useEffect } from "react"
import { promotionProbability } from "@/lib/math"
import type { TournamentParams } from "@/components/ParameterPanel"
import { paramsToMathArgs } from "@/components/ParameterPanel"

interface RobustnessHeatmapProps {
  params: TournamentParams
}

// 颜色插值：柔和橙(危险) → 琥珀(边缘) → 青蓝(安全)
function probToColor(prob: number): [number, number, number, number] {
  let r: number, g: number, b: number, a: number
  if (prob >= 0.95) {
    // 柔和青蓝 sky-400
    r = 56; g = 189; b = 248; a = 0.6
  } else if (prob >= 0.5) {
    // 琥珀到青蓝渐变
    const t = (prob - 0.5) / 0.45
    r = Math.round(251 * (1 - t) + 56 * t)
    g = Math.round(146 * (1 - t) + 189 * t)
    b = Math.round(60 * (1 - t) + 248 * t)
    a = 0.5 + 0.1 * t
  } else {
    // 柔和暖橙
    const t = prob / 0.5
    r = Math.round(239 * (1 - t) + 251 * t)
    g = Math.round(68 * (1 - t) + 146 * t)
    b = Math.round(68 * (1 - t) + 60 * t)
    a = 0.4 + 0.1 * t
  }
  return [r, g, b, a]
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

    const CANVAS_W = 560
    const CANVAS_H = 340
    // 留边距给坐标轴标签
    const MARGIN_LEFT = 56
    const MARGIN_RIGHT = 16
    const MARGIN_TOP = 16
    const MARGIN_BOTTOM = 48

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
    ctx.fillStyle = "#1E1C35"
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

    // 绘制热力图格子
    WINS_VALUES.forEach((wins, rowIdx) => {
      N_VALUES.forEach((n, colIdx) => {
        const prob = promotionProbability(wins, rFull, alpha, n, params.targetRank)
        const [r, g, b, a] = probToColor(prob)
        ctx.fillStyle = `rgba(${r},${g},${b},${a})`
        ctx.fillRect(
          MARGIN_LEFT + colIdx * cellW,
          MARGIN_TOP + rowIdx * cellH,
          cellW + 0.5, // 稍微溢出半像素避免缝隙
          cellH + 0.5
        )
      })
    })

    // 绘制 X 轴标签（参与人数）
    ctx.fillStyle = "#CBD5E1"
    ctx.font = "bold 11px 'Nunito', sans-serif"
    ctx.textAlign = "center"
    // 选取 5 个刻度显示
    const xTickIndices = [0, 5, 9, 14, 19]
    xTickIndices.forEach((idx) => {
      if (idx >= N_VALUES.length) return
      const x = MARGIN_LEFT + idx * cellW + cellW / 2
      const tickY = MARGIN_TOP + plotH
      const n = N_VALUES[idx]
      const label = n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : `${Math.round(n / 1000)}k`
      // 画刻度线
      ctx.strokeStyle = "#64748B"
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, tickY)
      ctx.lineTo(x, tickY + 4)
      ctx.stroke()
      ctx.fillText(label, x, tickY + 18)
    })
    // X 轴标题
    ctx.textAlign = "center"
    ctx.fillStyle = "#F59E0B"
    ctx.font = "bold 12px 'Nunito', sans-serif"
    ctx.fillText("参与人数", MARGIN_LEFT + plotW / 2, CANVAS_H - 4)

    // 绘制 Y 轴标签（胜场数）
    ctx.textAlign = "right"
    ctx.fillStyle = "#CBD5E1"
    ctx.font = "bold 11px 'Nunito', sans-serif"
    WINS_VALUES.forEach((wins, rowIdx) => {
      if (wins % 2 !== 0 && wins !== WINS_MIN && wins !== WINS_MAX) return
      const y = MARGIN_TOP + rowIdx * cellH + cellH / 2 + 4
      // 画刻度线
      ctx.strokeStyle = "#64748B"
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(MARGIN_LEFT - 4, y - 4)
      ctx.lineTo(MARGIN_LEFT, y - 4)
      ctx.stroke()
      ctx.fillText(`${wins}W`, MARGIN_LEFT - 6, y)
    })

    // Y 轴标题（旋转）
    ctx.save()
    ctx.translate(12, MARGIN_TOP + plotH / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.textAlign = "center"
    ctx.fillStyle = "#F59E0B"
    ctx.font = "bold 12px 'Nunito', sans-serif"
    ctx.fillText("胜场数", 0, 0)
    ctx.restore()
  }, [rFull, alpha, params.targetRank, N_VALUES, WINS_VALUES])

  return (
    <div className="card-premium p-6">
      <div className="pb-3">
        <h3 className="section-title text-gold text-base mb-1">鲁棒性热力图</h3>
        <p className="text-xs text-slate-400">
          各胜场数在不同参与人数下进入前{" "}
          <strong className="text-slate-200">{params.targetRank.toLocaleString()}</strong> 名的概率
        </p>
      </div>
      <div className="space-y-3">
        <canvas
          ref={canvasRef}
          className="w-full rounded-xl border border-purple-900/40"
          style={{ maxWidth: "560px", display: "block", margin: "0 auto" }}
        />

        {/* 图例 */}
        <div className="flex items-center justify-center gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-1">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ backgroundColor: "rgba(56,189,248,0.6)" }}
            />
            <span>安全（≥95%）</span>
          </div>
          <div className="flex items-center gap-1">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ backgroundColor: "rgba(251,146,60,0.5)" }}
            />
            <span>边缘（50%~95%）</span>
          </div>
          <div className="flex items-center gap-1">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ backgroundColor: "rgba(239,68,68,0.4)" }}
            />
            <span>危险（&lt;50%）</span>
          </div>
        </div>
      </div>
    </div>
  )
}
