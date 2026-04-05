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
    <div className="bg-white border-2 border-black rounded-xl p-2 shadow-[2px_2px_0px_#1A1A1A] text-xs space-y-1">
      <div className="font-semibold text-amber-600">{row.wins} 胜</div>
      <div className="text-gray-500">
        预期人数：<strong className="text-gray-900">{Math.round(row.count).toLocaleString()}</strong>
      </div>
      <div className="text-gray-500">
        累计人数（≥{row.wins} 胜）：<strong className="text-gray-900">{Math.round(row.tailCount).toLocaleString()}</strong>
      </div>
      <div className="text-gray-500">
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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="section-title text-base">胜场分布</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLogScale(!logScale)}
          className="h-7 text-xs cursor-pointer border-gray-300 text-gray-600 hover:text-black hover:border-black"
        >
          {logScale ? "线性刻度" : "对数刻度"}
        </Button>
      </div>
      <ResponsiveContainer width="100%" height={380}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <defs>
            <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#D97706" stopOpacity={0.8} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis
            dataKey="wins"
            tick={{ fontSize: 12, fill: '#6B7280' }}
            label={{ value: "胜场数", position: "insideBottom", offset: -2, fontSize: 12, fill: '#6B7280' }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#6B7280' }}
            label={{ value: yLabel, angle: -90, position: "insideLeft", fontSize: 12, fill: '#6B7280' }}
          />
          <Tooltip content={<CustomTooltip />} />
          {targetWins !== undefined && (
            <ReferenceLine
              x={targetWins}
              stroke="#DC2626"
              strokeDasharray="4 2"
              label={{ value: `目标 ${targetWins} 胜`, position: "top", fontSize: 10, fill: "#DC2626" }}
            />
          )}
          <Bar dataKey="displayCount" fill="url(#goldGradient)" radius={[3, 3, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
