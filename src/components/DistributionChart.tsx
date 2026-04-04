import { useState } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts"
import { Button } from "@/components/ui/button"
import type { DistributionRow } from "@/lib/math"

interface DistributionChartProps {
  distribution: DistributionRow[]
  targetWins?: number
}

interface TooltipPayload {
  dataKey: string
  value: number
  payload: DistributionRow
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayload[]
  label?: number
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const row = payload[0].payload as DistributionRow
  return (
    <div className="bg-background border rounded-lg p-2 shadow-lg text-xs space-y-1">
      <div className="font-semibold">{row.wins} 胜</div>
      <div className="text-muted-foreground">
        预期人数：<strong>{Math.round(row.count).toLocaleString()}</strong>
      </div>
      <div className="text-muted-foreground">
        累计人数（≥{row.wins} 胜）：<strong>{Math.round(row.tailCount).toLocaleString()}</strong>
      </div>
      <div className="text-muted-foreground">
        概率：{(row.pmf * 100).toFixed(3)}%
      </div>
    </div>
  )
}

export function DistributionChart({ distribution, targetWins }: DistributionChartProps) {
  const [logScale, setLogScale] = useState(false)

  const data = distribution.map((row) => ({
    ...row,
    displayCount: logScale ? (row.count > 0 ? Math.log10(row.count) : 0) : row.count,
  }))

  const yLabel = logScale ? "log₁₀(人数)" : "人数"

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">胜场分布</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLogScale(!logScale)}
          className="h-7 text-xs"
        >
          {logScale ? "线性刻度" : "对数刻度"}
        </Button>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="wins"
            tick={{ fontSize: 11 }}
            label={{ value: "胜场数", position: "insideBottom", offset: -2, fontSize: 11 }}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            label={{ value: yLabel, angle: -90, position: "insideLeft", fontSize: 11 }}
          />
          <Tooltip content={<CustomTooltip />} />
          {targetWins !== undefined && (
            <ReferenceLine
              x={targetWins}
              stroke="#f97316"
              strokeDasharray="4 2"
              label={{ value: `目标 ${targetWins} 胜`, position: "top", fontSize: 10, fill: "#f97316" }}
            />
          )}
          <Bar dataKey="displayCount" fill="#3b82f6" radius={[2, 2, 0, 0]} maxBarSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
