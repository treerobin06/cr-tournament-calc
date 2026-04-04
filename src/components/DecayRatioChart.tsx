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
    <div className="bg-[#1E1C35] border border-purple-900/40 rounded-xl p-2 shadow-lg text-xs space-y-1">
      <div className="font-semibold text-amber-400">{row.wins} 胜</div>
      <div className="text-slate-400">
        衰减比：<strong>{pct}%</strong>
      </div>
      <div className="text-muted-foreground">
        即 {row.wins - 1} 胜者中每 <strong className="text-slate-200">{ratio}</strong> 人才有 1 人多赢一场
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
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-amber-400" style={{fontFamily:'Fredoka'}}>衰减比 P(k)/P(k−1)</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(76,29,149,0.3)" />
          <XAxis
            dataKey="wins"
            tick={{ fontSize: 11, fill: '#94A3B8' }}
            label={{ value: "胜场数", position: "insideBottom", offset: -2, fontSize: 11, fill: '#94A3B8' }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#94A3B8' }}
            unit="%"
            domain={[0, 100]}
            label={{ value: "衰减比", angle: -90, position: "insideLeft", fontSize: 11, fill: '#94A3B8' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            y={50}
            stroke="#F59E0B"
            strokeDasharray="4 2"
            label={{ value: "50%", position: "right", fontSize: 10, fill: "#F59E0B" }}
          />
          <Line
            type="monotone"
            dataKey="decayPercent"
            stroke="#A78BFA"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-xs text-slate-400 text-center">
        衰减比趋近 50% 说明每多一胜的玩家数量减半（NegBin 尾部性质）
      </p>
    </div>
  )
}
