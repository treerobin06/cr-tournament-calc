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

interface CumulativeRankChartProps {
  distribution: DistributionRow[]
  targetRank: number
}

interface TooltipPayload {
  dataKey: string
  value: number
  payload: DistributionRow & { logTailCount: number }
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayload[]
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const row = payload[0].payload as DistributionRow
  return (
    <div className="bg-[#1E1C35] border border-purple-900/40 rounded-xl p-2 shadow-lg text-xs space-y-1">
      <div className="font-semibold text-amber-400">{row.wins} 胜</div>
      <div className="text-slate-400">
        累计人数（≥{row.wins} 胜）：<strong>{Math.round(row.tailCount).toLocaleString()}</strong>
      </div>
      <div className="text-muted-foreground">
        约为第 <strong className="text-slate-200">{Math.round(row.tailCount).toLocaleString()}</strong> 名
      </div>
    </div>
  )
}

export function CumulativeRankChart({ distribution, targetRank }: CumulativeRankChartProps) {
  const data = distribution
    .filter((row) => row.tailCount >= 0.5)
    .map((row) => ({
      ...row,
      logTailCount: row.tailCount > 0 ? Math.log10(row.tailCount) : 0,
    }))

  // 找到 targetRank 对应的 wins（tailCount 最接近 targetRank 的那行）
  const targetLogRank = Math.log10(targetRank)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-amber-400" style={{fontFamily:'Fredoka'}}>累计排名曲线（对数刻度）</span>
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
            tickFormatter={(v) => `10^${v.toFixed(0)}`}
            label={{ value: "log₁₀(累计人数)", angle: -90, position: "insideLeft", fontSize: 10, fill: '#94A3B8' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            y={targetLogRank}
            stroke="#F59E0B"
            strokeDasharray="4 2"
            label={{
              value: `前 ${targetRank.toLocaleString()} 名`,
              position: "right",
              fontSize: 10,
              fill: "#F59E0B",
            }}
          />
          <Line
            type="monotone"
            dataKey="logTailCount"
            stroke="#A78BFA"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
