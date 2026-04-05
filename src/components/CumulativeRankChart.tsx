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
    <div className="bg-white border-2 border-black rounded-xl p-2 shadow-[2px_2px_0px_#1A1A1A] text-xs space-y-1">
      <div className="font-semibold text-blue-600">{row.wins} 胜</div>
      <div className="text-gray-500">
        累计人数（≥{row.wins} 胜）：<strong className="text-gray-900">{Math.round(row.tailCount).toLocaleString()}</strong>
      </div>
      <div className="text-gray-500">
        约为第 <strong className="text-gray-900">{Math.round(row.tailCount).toLocaleString()}</strong> 名
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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="section-title text-base">累计排名曲线（对数刻度）</span>
          <p className="text-xs text-gray-400 mt-1">
            纵轴为「≥ 该胜场的累计人数」，即你的排名。红色虚线为目标名次，曲线与虚线的交点就是所需胜场。
          </p>
        </div>
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
            tickFormatter={(v) => `10^${v.toFixed(0)}`}
            label={{ value: "log₁₀(累计人数)", angle: -90, position: "insideLeft", fontSize: 11, fill: '#6B7280' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            y={targetLogRank}
            stroke="#DC2626"
            strokeDasharray="4 2"
            label={{
              value: `前 ${targetRank.toLocaleString()} 名`,
              position: "right",
              fontSize: 10,
              fill: "#DC2626",
            }}
          />
          <Line
            type="monotone"
            dataKey="logTailCount"
            stroke="#2563EB"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5, fill: '#2563EB', stroke: '#1D4ED8', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
