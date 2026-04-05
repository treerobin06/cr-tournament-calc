import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts"
import type { DistributionRow } from "@/lib/math"

interface DecayRatioChartProps {
  distribution: DistributionRow[]
}

interface TooltipPayload {
  dataKey: string
  value: number
  payload: DistributionRow
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayload[]
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const row = payload[0].payload as DistributionRow
  if (isNaN(row.decayRatio)) return null

  const pct = (row.decayRatio * 100).toFixed(1)
  const ratio = row.decayRatio > 0 ? (1 / row.decayRatio).toFixed(1) : "∞"

  return (
    <div className="bg-white border-2 border-black rounded-xl p-2 shadow-[2px_2px_0px_#1A1A1A] text-xs space-y-1">
      <div className="font-semibold text-purple-600">{row.wins} 胜</div>
      <div className="text-gray-500">
        衰减比：<strong className="text-gray-900">{pct}%</strong>
      </div>
      <div className="text-gray-500">
        即 {row.wins - 1} 胜者中每 <strong className="text-gray-900">{ratio}</strong> 人才有 1 人多赢一场
      </div>
    </div>
  )
}

export function DecayRatioChart({ distribution }: DecayRatioChartProps) {
  const data = distribution
    .filter((row) => row.wins > 0 && !isNaN(row.decayRatio) && isFinite(row.decayRatio))
    .map((row) => ({
      ...row,
      decayPercent: row.decayRatio * 100,
    }))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="section-title text-base">衰减比 P(k)/P(k-1)</span>
      </div>
      <ResponsiveContainer width="100%" height={380}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis
            dataKey="wins"
            tick={{ fontSize: 12, fill: '#6B7280' }}
            label={{ value: "胜场数", position: "insideBottom", offset: -2, fontSize: 12, fill: '#6B7280' }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#6B7280' }}
            unit="%"
            domain={[0, 100]}
            label={{ value: "衰减比", angle: -90, position: "insideLeft", fontSize: 12, fill: '#6B7280' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            y={50}
            stroke="#DC2626"
            strokeDasharray="4 2"
            label={{ value: "50%", position: "right", fontSize: 10, fill: "#DC2626" }}
          />
          <Line
            type="monotone"
            dataKey="decayPercent"
            stroke="#7C3AED"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5, fill: '#7C3AED', stroke: '#6D28D9', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-xs text-gray-500 text-center">
        衰减比趋近 50% 说明每多一胜的玩家数量减半（NegBin 尾部性质）
      </p>
    </div>
  )
}
